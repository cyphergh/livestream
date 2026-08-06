import { Elysia } from 'elysia';
import { prisma } from '../../lib/db';
import { config } from '../../config';
import { jwtPlugin } from '../../lib/jwt-plugin';

// Proxies WHIP publish/ICE/teardown to MediaMTX after JWT validation.
// The browser studio POSTs its SDP offer to /api/media/whip/:channelId with
// the admin access token; we append Basic credentials so MediaMTX's external
// auth authorizes the publish.
const whipBase = (path: string) => `${config.MEDIAMTX_WHEP_URL}/${encodeURIComponent(path)}/whip`;
const basic = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

export const whip = new Elysia({ prefix: '/api/media/whip' })
  .use(jwtPlugin())
  .derive(async ({ headers, accessJwt }) => {
    const token = headers.authorization?.replace('Bearer ', '');
    if (!token) return { actor: undefined };
    const payload = await accessJwt.verify(token);
    if (!payload || payload.type !== 'access') return { actor: undefined };
    return { actor: payload };
  })
  .post('/:channelId', async ({ params, request, actor, set }) => {
    const denied = () => {
      set.status = 401;
      return { message: 'Unauthorized' };
    };
    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'PRODUCER')) return denied();

    const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
    if (!channel || (actor.role !== 'ADMIN' && channel.ownerId !== actor.uid)) return denied();

    const key = await prisma.ingestKey.findFirst({
      where: { channelId: channel.id, enabled: true },
      orderBy: { protocol: 'desc' }, // prefer 'whep', else fall back to rtmp/rtsp/srt
    });
    if (!key) return denied();

    // Forward the offer (SDP body) to MediaMTX.
    const sdp = await request.text();
    const res = await fetch(whipBase(params.channelId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        Authorization: basic(channel.id, key.password),
      },
      body: sdp,
    });
    if (!res.ok) {
      set.status = res.status;
      return { message: 'Media server rejected publish', detail: await res.text() };
    }
    const location = res.headers.get('Location');
    // Rewrite MediaMTX's Location (http://host:8889/.../whip/<session>) to OUR
    // origin so the client's PATCH (ICE) / DELETE (teardown) go through us and
    // we can re-attach the MediaMTX Basic credentials.
    const session = location?.split('/').filter(Boolean).pop();
    set.status = res.status;
    set.headers['Location'] = session ? `/api/media/whip/${params.channelId}/${session}` : '';
    return res.body;
  })
  .patch('/:channelId/:session', async ({ params, request, actor, set }) => {
    if (!actor) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }
    const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
    if (!channel) return denied(401);
    const key = await prisma.ingestKey.findFirst({
      where: { channelId: channel.id, enabled: true },
      orderBy: { protocol: 'desc' },
    });
    if (!key) return denied(401);

    const ice = await request.text();
    const res = await fetch(`${whipBase(params.channelId)}/${params.session}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/trickle-ice-sdpfrag',
        Authorization: basic(channel.id, key.password),
      },
      body: ice,
    });
    set.status = res.status;
    if (!res.ok) return { message: await res.text() };
    return res.body;
  })
  .delete('/:channelId/:session', async ({ params, request, actor, set }) => {
    if (!actor) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }
    const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
    if (!channel) return denied(401);
    const key = await prisma.ingestKey.findFirst({
      where: { channelId: channel.id, enabled: true },
      orderBy: { protocol: 'desc' },
    });
    if (!key) return denied(401);

    const res = await fetch(`${whipBase(params.channelId)}/${params.session}`, {
      method: 'DELETE',
      headers: { Authorization: basic(channel.id, key.password) },
    });
    set.status = res.status;
    return res.body;
  });

function denied(code: number) {
  return { status: code, message: 'Unauthorized' } as never;
}
