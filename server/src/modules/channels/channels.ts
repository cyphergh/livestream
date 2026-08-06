import { Elysia, t } from 'elysia';
import { prisma } from '../../lib/db';
import { mediaServer, hlsUrl, whepUrl } from '../../lib/mediaserver';
import { isProducer } from '../../lib/auth';
import { jwtPlugin } from '../../lib/jwt-plugin';
import { resolveUser } from '../../lib/user';
import { slugify } from '../../lib/slug';
import { publishOverlay } from '../realtime';

const serializeChannel = async (c: any) => {
  const live = await mediaServer.isLive(c.id);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    type: c.type,
    visibility: c.visibility,
    accessType: c.accessType ?? 'FREE',
    logoUrl: c.logoUrl,
    coverUrl: c.coverUrl,
    live,
    hls: live ? hlsUrl(c.id) : null,
    whep: live ? whepUrl(c.id) : null,
    overlay: c.overlay ? serializeOverlay(c.overlay) : null,
  };
};

const serializeOverlay = (o: any) => ({
  mode: o.mode,
  logoVisible: o.logoVisible,
  text: o.text,
  position: o.position,
  fontSize: o.fontSize,
  color: o.color,
  bgColor: o.bgColor,
  speed: o.speed,
  opacity: o.opacity,
  imageUrl: o.imageUrl,
  width: o.width,
  height: o.height,
  borderRadius: o.borderRadius,
});

export const publicChannels = new Elysia({ prefix: '/api/channels' })
  .get('/', async () => {
    const channels = await prisma.channel.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'asc' },
      include: { overlay: true },
    });
    return { items: await Promise.all(channels.map(serializeChannel)) };
  })
  .get('/:slug', async ({ params, set }) => {
    const c = await prisma.channel.findUnique({ where: { slug: params.slug }, include: { overlay: true } });
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
    const channels = await prisma.channel.findMany({ where, orderBy: { createdAt: 'asc' }, include: { overlay: true } });
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
          accessType: body.accessType,
          logoUrl: body.logoUrl,
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
        accessType: t.Optional(t.Enum({ FREE: 'FREE', SUBSCRIPTION: 'SUBSCRIPTION' })),
        logoUrl: t.Optional(t.String()),
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
        include: { overlay: true },
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
  // Overlay config: scrolling ticker / static image / static text rendered
  // over the video for viewers, plus the channel-logo overlay toggle.
  .get('/:id/overlay', async ({ params, user, set }) => {
    if (!isProducer(user)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    const c = await prisma.channel.findUnique({ where: { id: params.id }, include: { overlay: true } });
    if (!c || (user!.role !== 'ADMIN' && c.ownerId !== user!.id)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    return { overlay: c.overlay ? serializeOverlay(c.overlay) : null };
  })
  .put(
    '/:id/overlay',
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
      const overlay = await prisma.overlay.upsert({
        where: { channelId: c.id },
        update: { ...body, text: body.text ?? '' },
        create: { channelId: c.id, ...body, text: body.text ?? '' },
      });
      const serialized = serializeOverlay(overlay);
      publishOverlay(c.id, serialized);
      return { overlay: serialized };
    },
    {
      body: t.Object({
        mode: t.Optional(t.Enum({ off: 'off', ticker: 'ticker', image: 'image', text: 'text' })),
        logoVisible: t.Optional(t.Boolean()),
        text: t.Optional(t.String()),
        position: t.Optional(
          t.Enum({
            bottom: 'bottom',
            top: 'top',
            'top-left': 'top-left',
            'top-right': 'top-right',
            'bottom-left': 'bottom-left',
            'bottom-right': 'bottom-right',
            center: 'center',
          })
        ),
        fontSize: t.Optional(t.Number({ minimum: 8, maximum: 160 })),
        color: t.Optional(t.String()),
        bgColor: t.Optional(t.String()),
        speed: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
        opacity: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
        imageUrl: t.Optional(t.String()),
        width: t.Optional(t.Number({ minimum: 8, maximum: 2000 })),
        height: t.Optional(t.Number({ minimum: 8, maximum: 2000 })),
        borderRadius: t.Optional(t.Number({ minimum: 0, maximum: 500 })),
      }),
    }
  );
