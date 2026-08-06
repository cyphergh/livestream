import { Elysia, t } from 'elysia';
import { prisma } from '../../lib/db';
import { mediaServer, hlsUrl, whepUrl } from '../../lib/mediaserver';
import { isProducer } from '../../lib/auth';
import { jwtPlugin } from '../../lib/jwt-plugin';
import { resolveUser } from '../../lib/user';
import { slugify } from '../../lib/slug';
import { publishTicker } from '../realtime';

const serializeChannel = async (c: any) => {
  const live = await mediaServer.isLive(c.id);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    type: c.type,
    visibility: c.visibility,
    logoUrl: c.logoUrl,
    coverUrl: c.coverUrl,
    live,
    hls: live ? hlsUrl(c.id) : null,
    whep: live ? whepUrl(c.id) : null,
    ticker: c.ticker?.enabled ? serializeTicker(c.ticker) : null,
  };
};

const serializeTicker = (t: any) => ({
  enabled: t.enabled,
  text: t.text,
  opacity: t.opacity,
  position: t.position,
  fontSize: t.fontSize,
  color: t.color,
  bgColor: t.bgColor,
  speed: t.speed,
});

export const publicChannels = new Elysia({ prefix: '/api/channels' })
  .get('/', async () => {
    const channels = await prisma.channel.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'asc' },
      include: { ticker: true },
    });
    return { items: await Promise.all(channels.map(serializeChannel)) };
  })
  .get('/:slug', async ({ params, set }) => {
    const c = await prisma.channel.findUnique({ where: { slug: params.slug }, include: { ticker: true } });
    if (!c || c.visibility !== 'PUBLIC') {
      set.status = 404;
      return { message: 'Channel not found' };
    }
    const programs = await prisma.program.findMany({
      where: { channelId: c.id, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 10,
    });
    return { ...(await serializeChannel(c)), programs };
  });

export const adminChannels = new Elysia({ prefix: '/api/admin/channels' })
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }))
  .get('/', async ({ user, set }) => {
    if (!isProducer(user)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    const where = user!.role === 'ADMIN' ? {} : { ownerId: user!.id };
    const channels = await prisma.channel.findMany({ where, orderBy: { createdAt: 'asc' }, include: { ticker: true } });
    return { items: await Promise.all(channels.map(serializeChannel)) };
  })
  .post(
    '/',
    async ({ body, user, set }) => {
      if (!isProducer(user)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }

      let slug = slugify(body.name);
      const existing = await prisma.channel.findUnique({ where: { slug } });
      if (existing) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;

      const channel = await prisma.channel.create({
        data: {
          slug,
          name: body.name,
          description: body.description,
          type: body.type,
          visibility: body.visibility,
          ownerId: user!.id,
        },
      });

      await prisma.ingestKey.create({
        data: {
          channelId: channel.id,
          name: 'Primary RTMP',
          protocol: 'rtmp',
          password: crypto.randomUUID().replaceAll('-', '').slice(0, 24),
        },
      });

      return { channel: await serializeChannel(channel) };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        description: t.Optional(t.String()),
        type: t.Enum({ RADIO: 'RADIO', TV: 'TV' }),
        visibility: t.Optional(t.Enum({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' })),
      }),
    }
  )
  .patch(
    '/:id',
    async ({ params, body, user, set }) => {
      const c = await prisma.channel.findUnique({ where: { id: params.id } });
      if (!c) {
        set.status = 404;
        return { message: 'Not found' };
      }
      if (!isProducer(user) || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const updated = await prisma.channel.update({
        where: { id: c.id },
        data: { ...body },
        include: { ticker: true },
      });
      return { channel: await serializeChannel(updated) };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 2 })),
        description: t.Optional(t.String()),
        type: t.Optional(t.Enum({ RADIO: 'RADIO', TV: 'TV' })),
        visibility: t.Optional(t.Enum({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' })),
        logoUrl: t.Optional(t.String()),
        coverUrl: t.Optional(t.String()),
      }),
    }
  )
  .delete('/:id', async ({ params, user, set }) => {
    const c = await prisma.channel.findUnique({ where: { id: params.id } });
    if (!c) {
      set.status = 404;
      return { message: 'Not found' };
    }
    if (!isProducer(user) || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    await mediaServer.deletePath(c.id).catch(() => {});
    await prisma.channel.delete({ where: { id: c.id } });
    return { ok: true };
  })
  // Scrolling ticker/marquee config (rendered over the video for viewers).
  .get('/:id/ticker', async ({ params, user, set }) => {
    if (!isProducer(user)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    const c = await prisma.channel.findUnique({ where: { id: params.id }, include: { ticker: true } });
    if (!c || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    return { ticker: c.ticker ? serializeTicker(c.ticker) : null };
  })
  .put(
    '/:id/ticker',
    async ({ params, body, user, set }) => {
      if (!isProducer(user)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const c = await prisma.channel.findUnique({ where: { id: params.id } });
      if (!c || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const ticker = await prisma.ticker.upsert({
        where: { channelId: c.id },
        update: { ...body, text: body.text ?? '' },
        create: { channelId: c.id, ...body, text: body.text ?? '' },
      });
      const serialized = serializeTicker(ticker);
      publishTicker(c.id, serialized);
      return { ticker: serialized };
    },
    {
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        text: t.Optional(t.String()),
        opacity: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
        position: t.Optional(t.Enum({ bottom: 'bottom', top: 'top' })),
        fontSize: t.Optional(t.Number({ minimum: 8, maximum: 120 })),
        color: t.Optional(t.String()),
        bgColor: t.Optional(t.String()),
        speed: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
      }),
    }
  );
