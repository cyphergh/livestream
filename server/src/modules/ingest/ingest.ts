import { Elysia, t } from 'elysia';
import { prisma } from '../../lib/db';
import { config } from '../../config';
import { mediaServer } from '../../lib/mediaserver';
import { jwtPlugin } from '../../lib/jwt-plugin';
import { resolveUser } from '../../lib/user';

// Ingest URLs advertised to encoders (OBS etc). Public address + port.
const rtmpUrl = () => `rtmp://${config.MEDIAMTX_RTMP_ADDR}`;
const rtspUrl = () => `rtsp://${config.MEDIAMTX_RTSP_ADDR}`;
const srtUrl = () => `srt://${config.MEDIAMTX_SRT_ADDR}`;
const whipUrl = (channelId: string) => `${config.PUBLIC_URL}/api/media/whip/${channelId}`;

const ingestInfo = async (channelId: string) => {
  const keys = await prisma.ingestKey.findMany({
    where: { channelId },
    orderBy: { createdAt: 'asc' },
  });
  const primary = keys.find((k) => k.protocol === 'rtmp') ?? keys[0];
  return {
    rtmp: { url: rtmpUrl(), streamKey: primary ? `${channelId}?key=${primary.password}` : null },
    rtsp: { url: rtspUrl(), streamKey: primary ? `${channelId}` : null },
    srt: { url: srtUrl(), streamKey: primary ? `${channelId}?key=${primary.password}` : null },
    whip: whipUrl(channelId),
    keys,
  };
};

export const ingest = new Elysia({ prefix: "/api/admin/channels/:id" })
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }))
  .get('/ingest', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    const info = await ingestInfo(params.id);
    return { ...info, live: await mediaServer.isLive(params.id) };
  })
  .post(
    '/ingest',
    async ({ params, body, user, set }) => {
      if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
      const key = await prisma.ingestKey.create({
        data: {
          channelId: params.id,
          name: body.name,
          protocol: body.protocol,
          password: crypto.randomUUID().replaceAll('-', '').slice(0, 24),
        },
      });
      return { key };
    },
    {
      body: t.Object({
        name: t.String(),
        protocol: t.Enum({ rtmp: 'rtmp', rtsp: 'rtsp', srt: 'srt', whep: 'whep' }),
      }),
    }
  )
  .delete('/ingest/:keyId', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    await prisma.ingestKey.deleteMany({ where: { id: params.keyId, channelId: params.id } });
    return { ok: true };
  })
  // Restream targets — push our stream out to external platforms.
  .get('/restreams', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    const items = await prisma.restreamTarget.findMany({ where: { channelId: params.id } });
    return { items };
  })
  .post(
    '/restreams',
    async ({ params, body, user, set }) => {
      if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
      const item = await prisma.restreamTarget.create({
        data: { channelId: params.id, name: body.name, url: body.url },
      });
      await syncRestreams(params.id);
      return { item };
    },
    {
      body: t.Object({ name: t.String(), url: t.String() }),
    }
  )
  .delete('/restreams/:rid', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    await prisma.restreamTarget.deleteMany({ where: { id: params.rid, channelId: params.id } });
    await syncRestreams(params.id);
    return { ok: true };
  })
  // Pull sources — import external streams (URLs) as channels.
  .get('/pulls', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    const items = await prisma.pullSource.findMany({ where: { channelId: params.id } });
    return { items };
  })
  .post(
    '/pulls',
    async ({ params, body, user, set }) => {
      if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
      const item = await prisma.pullSource.create({
        data: { channelId: params.id, name: body.name, url: body.url },
      });
      await mediaServer.addPath(params.id, { source: body.url });
      return { item };
    },
    {
      body: t.Object({ name: t.String(), url: t.String() }),
    }
  )
  .delete('/pulls/:pid', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    await prisma.pullSource.deleteMany({ where: { id: params.pid, channelId: params.id } });
    const remaining = await prisma.pullSource.findMany({ where: { channelId: params.id } });
    if (remaining.length === 0) await mediaServer.deletePath(params.id).catch(() => {});
    return { ok: true };
  })
  // Sessions — go-live / stop-live records.
  .get('/sessions', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    const sessions = await prisma.session.findMany({
      where: { channelId: params.id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return { items: sessions };
  })
  .post('/sessions', async ({ params, body, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    // End any open session for this channel first.
    await prisma.session.updateMany({
      where: { channelId: params.id, isLive: true },
      data: { isLive: false, endedAt: new Date() },
    });
    const session = await prisma.session.create({
      data: { channelId: params.id, title: body.title, scheduled: body.scheduled ?? false },
    });
    return { session };
  }, {
    body: t.Object({
      title: t.Optional(t.String()),
      scheduled: t.Optional(t.Boolean()),
      scheduledFor: t.Optional(t.String()),
    }),
  })
  .post('/sessions/stop', async ({ params, user, set }) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'PRODUCER')) return forbid(set);
    const stopped = await prisma.session.updateMany({
      where: { channelId: params.id, isLive: true },
      data: { isLive: false, endedAt: new Date() },
    });
    return { ok: true, stopped: stopped.count };
  });

function forbid(set: any) {
  set.status = 403;
  return { message: 'Forbidden' };
}

// Write enabled restream targets into the MediaMTX path config so it pushes out.
async function syncRestreams(channelId: string) {
  const targets = await prisma.restreamTarget.findMany({ where: { channelId, enabled: true } });
  const body = {
    runOnReady: undefined as string | undefined,
  };
  // MediaMTX supports runOnReady to spawn ffmpeg; we use rtspSimulcast alternative via restream URL config below.
  await mediaServer.patchPath(channelId, {
    runOnReady: targets.length
      ? targets
          .map((t) =>
            `ffmpeg -re -stream_loop -1 -i rtsp://localhost:8554/${channelId} -c copy -f flv ${t.url} -nostdin -loglevel quiet &`
          )
          .join(' ')
      : undefined,
  });
}
