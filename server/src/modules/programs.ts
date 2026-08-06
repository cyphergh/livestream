import { Elysia, t } from 'elysia';
import { prisma } from '../lib/db';
import { mediaServer } from '../lib/mediaserver';
import { isProducer } from '../lib/auth';
import { jwtPlugin } from '../lib/jwt-plugin';
import { resolveUser } from '../lib/user';
import { publishPrograms } from './realtime';

const serializeProgram = (p: any) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  genre: p.genre,
  startsAt: p.startsAt,
  endsAt: p.endsAt,
});

// Recompute today's schedule for a channel and push it to connected viewers.
async function broadcastToday(channelId: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  const programs = await prisma.program.findMany({
    where: { channelId, startsAt: { lt: end }, endsAt: { gte: start } },
    orderBy: { startsAt: 'asc' },
  });
  publishPrograms(channelId, programs.map(serializeProgram));
}

// Public EPG: every visible channel with its schedule for today.
export const publicGuide = new Elysia({ prefix: '/api' })
  .use(jwtPlugin())
  .derive(async (ctx) => {
    let viewer;
    try {
      viewer = await resolveUser(ctx);
    } catch {
      viewer = undefined;
    }
    return { viewer };
  })
  .get('/guide', async ({ viewer }) => {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const channels = await prisma.channel.findMany({
      where: { visibility: 'PUBLIC', ...(viewer ? {} : { accessType: 'FREE' }) },
      orderBy: { name: 'asc' },
    });
    const items = await Promise.all(
      channels.map(async (c) => {
        const [programs, live] = await Promise.all([
          prisma.program.findMany({
            where: { channelId: c.id, startsAt: { lt: dayEnd }, endsAt: { gte: dayStart } },
            orderBy: { startsAt: 'asc' },
          }),
          mediaServer.isLive(c.id),
        ]);
        return {
          slug: c.slug,
          name: c.name,
          type: c.type,
          logoUrl: c.logoUrl,
          live,
          programs: programs.map(serializeProgram),
        };
      })
    );
    return { items };
  });

// Admin schedule management for a channel's Electronic Program Guide.
export const adminPrograms = new Elysia({ prefix: '/api/admin' })
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }))

  .get('/channels/:id/programs', async ({ params, user, set }) => {
    const c = await prisma.channel.findUnique({ where: { id: params.id } });
    if (!c || !isProducer(user) || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    const programs = await prisma.program.findMany({
      where: { channelId: c.id },
      orderBy: { startsAt: 'asc' },
    });
    return { items: programs.map(serializeProgram) };
  })
  .post(
    '/channels/:id/programs',
    async ({ params, body, user, set }) => {
      const c = await prisma.channel.findUnique({ where: { id: params.id } });
      if (!c || !isProducer(user) || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      if (new Date(body.endsAt) <= new Date(body.startsAt)) {
        set.status = 422;
        return { message: 'endsAt must be after startsAt' };
      }
      const program = await prisma.program.create({
        data: {
          channelId: c.id,
          title: body.title,
          description: body.description,
          genre: body.genre,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
        },
});
      await broadcastToday(c.id);
      return { program: serializeProgram(program) };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        genre: t.Optional(t.String()),
        startsAt: t.String(),
        endsAt: t.String(),
      }),
    }
  )
  .patch(
    '/programs/:id',
    async ({ params, body, user, set }) => {
      const p = await prisma.program.findUnique({ where: { id: params.id } });
      if (!p) {
        set.status = 404;
        return { message: 'Not found' };
      }
      const c = await prisma.channel.findUnique({ where: { id: p.channelId } });
      if (!c || !isProducer(user) || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const data: any = { ...body };
      if (body.startsAt) data.startsAt = new Date(body.startsAt);
      if (body.endsAt) data.endsAt = new Date(body.endsAt);
      if (data.endsAt && data.startsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
        set.status = 422;
        return { message: 'endsAt must be after startsAt' };
      }
      const program = await prisma.program.update({ where: { id: p.id }, data });
      await broadcastToday(p.channelId);
      return { program: serializeProgram(program) };
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.String()),
        genre: t.Optional(t.String()),
        startsAt: t.Optional(t.String()),
        endsAt: t.Optional(t.String()),
      }),
    }
  )
  .delete('/programs/:id', async ({ params, user, set }) => {
    const p = await prisma.program.findUnique({ where: { id: params.id } });
    if (!p) {
      set.status = 404;
      return { message: 'Not found' };
    }
    const c = await prisma.channel.findUnique({ where: { id: p.channelId } });
    if (!c || !isProducer(user) || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    await prisma.program.delete({ where: { id: p.id } });
    await broadcastToday(p.channelId);
    return { ok: true };
  });