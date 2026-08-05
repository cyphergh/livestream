import { Elysia, t } from 'elysia';
import { createHash } from 'node:crypto';
import { prisma } from '../../lib/db';
import { jwtPlugin } from '../../lib/jwt-plugin';
import { resolveUser } from '../../lib/user';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const REFRESH_COOKIE = 'refresh';
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

const setRefreshCookie = (ctx: { cookie: Record<string, any> }, token: string) => {
  ctx.cookie[REFRESH_COOKIE].set({
    value: token,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: REFRESH_MS / 1000,
    secure: Bun.env.NODE_ENV === 'production',
  });
};

export const publicAuth = new Elysia({ prefix: '/api/auth' })
  .use(jwtPlugin())
  .post(
    '/register',
    async ({ body, set }) => {
      const exists = await prisma.user.findUnique({ where: { email: body.email } });
      if (exists) {
        set.status = 409;
        return { message: 'Email already registered' };
      }

      const user = await prisma.user.create({
        data: {
          email: body.email,
          name: body.name,
          password: await Bun.password.hash(body.password),
        },
      });

      return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        name: t.String({ minLength: 2 }),
        password: t.String({ minLength: 8 }),
      }),
    }
  )
  .post(
    '/login',
    async ({ body, set, accessJwt, refreshJwt, cookie }) => {
      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user || !(await Bun.password.verify(body.password, user.password))) {
        set.status = 401;
        return { message: 'Invalid credentials' };
      }

      const access = await accessJwt.sign({
        uid: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        type: 'access',
      });
      const refresh = await refreshJwt.sign({ uid: user.id, type: 'refresh', jti: crypto.randomUUID() });

      await prisma.refreshToken.create({
        data: {
          tokenHash: hashToken(refresh),
          userId: user.id,
          expiresAt: new Date(Date.now() + REFRESH_MS),
        },
      });

      setRefreshCookie({ cookie }, refresh);

      return {
        accessToken: access,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      };
    },
    {
      body: t.Object({ email: t.String(), password: t.String() }),
    }
  );

export const authedAuth = new Elysia({ prefix: '/api/auth' })
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }))
  .post('/refresh', async ({ cookie, set, accessJwt, refreshJwt }) => {
    const token = cookie[REFRESH_COOKIE]?.value;
    if (typeof token !== 'string' || !token) {
      set.status = 401;
      return { message: 'Missing refresh token' };
    }

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      set.status = 401;
      return { message: 'Refresh token invalid' };
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      set.status = 401;
      return { message: 'User not found' };
    }

    const access = await accessJwt.sign({
      uid: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      type: 'access',
    });
    const refresh = await refreshJwt.sign({ uid: user.id, type: 'refresh', jti: crypto.randomUUID() });

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refresh),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_MS),
      },
    });

    setRefreshCookie({ cookie }, refresh);

    return {
      accessToken: access,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  })
  .post('/logout', async ({ cookie }) => {
    const token = cookie[REFRESH_COOKIE]?.value;
    if (typeof token === 'string' && token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(token), revoked: false },
        data: { revoked: true },
      });
    }
    cookie[REFRESH_COOKIE].set({ value: '', httpOnly: true, path: '/', maxAge: 0 });
    return { ok: true };
  })
  .get('/me', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

// Resolves `user` from the Authorization header. Include before admin routes.
export const authResolver = new Elysia()
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }));

export const auth = new Elysia()
  .use(jwtPlugin())
  .use(publicAuth)
  .use(authResolver)
  .use(authedAuth);
