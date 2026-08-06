import { Elysia, t } from 'elysia';
import { prisma } from '../../lib/db';
import { config } from '../../config';

// MediaMTX "external (HTTP) authentication" callback.
// MediaMTX POSTs form-encoded fields: user, pass, ip, action, path, protocol, id, query.
// HTTP 200 = allow, HTTP 401 = deny.
// Docs: https://github.com/bluenviron/mediamtx#authentication
export const mediaAuth = new Elysia().post('/api/media/auth', async ({ body, set }) => {
  const get = (k: keyof typeof body) => String((body as any)[k] ?? '');

  const action = get('action'); // publish | read | playback | api
  const path = get('path');
  const user = get('user');
  const pass = get('password') || get('pass');
  const query = get('query');
  const apikey = get('apikey');

  if (Bun.env.NODE_ENV !== 'production') console.log('[media-auth]', action, path);

  // API calls authorized by the static API key (used when apiAddress is public).
  if (action === 'api') {
    if (apikey === config.MEDIAMTX_API_KEY) return 'OK';
    set.status = 401;
    return 'Unauthorized';
  }

  if (!path) {
    set.status = 401;
    return 'Unauthorized';
  }

  const channelId = path.split('/')[0];

  // Publishing (RTMP/RTSP/SRT from encoders, or WHIP via our proxy).
  if (action === 'publish') {
    if (await authorizePublish(channelId, user, pass, query)) return 'OK';
    set.status = 401;
    return 'Unauthorized';
  }

  // Reading (HLS segments/playlists, WebRTC WHEP).
  if (action === 'read' || action === 'player' || action === 'playlist') {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (channel?.visibility === 'PUBLIC') return 'OK';
    if (user && (await authorizePublish(channelId, user, pass, query))) return 'OK';
    set.status = 401;
    return 'Unauthorized';
  }

  set.status = 401;
  return 'Unauthorized';
}, {
  body: t.Object(
    {
      user: t.Optional(t.String()),
      password: t.Optional(t.String()),
      pass: t.Optional(t.String()),
      token: t.Optional(t.String()),
      ip: t.Optional(t.String()),
      action: t.Optional(t.String()),
      path: t.Optional(t.String()),
      protocol: t.Optional(t.String()),
      id: t.Optional(t.String()),
      query: t.Optional(t.String()),
      userAgent: t.Optional(t.String()),
      apikey: t.Optional(t.String()),
    },
    { additionalProperties: true }
  ),
});

const keyFromQuery = (query: string): string | null =>
  new URLSearchParams(query).get('key');

async function authorizePublish(
  channelId: string,
  user: string,
  pass: string,
  query = ''
): Promise<boolean> {
  const secret = pass || keyFromQuery(query) || '';
  if (!secret) return false;
  const key = await prisma.ingestKey.findFirst({
    where: { channelId, password: secret, enabled: true },
  });
  if (!key) return false;
  // Accept channel-id match or anonymous publisher with a valid channel key.
  return !user || user === channelId || user === key.id;
}