import { Elysia, t } from 'elysia';
import { prisma } from '../lib/db';
import { jwtPlugin } from '../lib/jwt-plugin';
import { resolveUser } from '../lib/user';
import { isAdmin } from '../lib/auth';

// Editable landing-page content. Admin upserts key/value settings from the
// CMS; the public endpoint flattens them into a plain object the guest site
// merges over its client-side defaults, so nothing breaks on first load.

export const publicContent = new Elysia({ prefix: '/api' })
  .get('/content', async () => {
    const [settings, media] = await Promise.all([
      prisma.setting.findMany(),
      prisma.mediaAsset.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const map: Record<string, unknown> = {};
    for (const s of settings) map[s.key] = s.value;
    return { settings: map };
  });

export const adminSettings = new Elysia({ prefix: '/api/admin/settings' })
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }))
  .get('/', async ({ user, set }) => {
    if (!isAdmin(user)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    const settings = await prisma.setting.findMany();
    return { items: settings };
  })
  .put(
    '/:key',
    async ({ params, body, user, set }) => {
      if (!isAdmin(user)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const setting = await prisma.setting.upsert({
        where: { key: params.key },
        update: { value: body.value },
        create: { key: params.key, value: body.value },
      });
      return { setting };
    },
    {
      body: t.Object({ value: t.Any() }),
    }
  )
  .delete('/:key', async ({ params, user, set }) => {
    if (!isAdmin(user)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    await prisma.setting.deleteMany({ where: { key: params.key } });
    return { ok: true };
  });