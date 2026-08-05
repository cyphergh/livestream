import { Elysia } from 'elysia';
import { prisma } from '../../lib/db';
import { config } from '../../config';

// MediaMTX "external authentication" callback.
// MediaMTX POSTs form-encoded fields: user, pass, ip, action, path, protocol, id, query.
// HTTP 200 = allow, HTTP 401 = deny.
// Docs: https://github.com/bluenviron/mediamtx#external-authentication
export const mediaAuth = new Elysia()
  .post('/api/media/auth', async ({ request, set }) => {
    const form = await request.formData();
    const get = (k: string) => String(form.get(k) ?? '');

    const action = get('action'); // publish | read | playlist | api
    const path = get('path');
    const user = get('user');
    const pass = get('pass');
    const protocol = get('protocol'); // rtmp | rtsp | srt | hls | websc | whep | ...
    const query = get('query');
    const apiKey = get('apikey');

    // API calls are authorized by the static API key.
    if (action === 'api') {
      if (apiKey === config.MEDIAMTX_API_KEY) return 'OK';
      set.status = 401;
      return 'Unauthorized';
    }

    if (!path) {
      set.status = 401;
      return 'Unauthorized';
    }

    const channelId = path.split('/')[0];

    // Publishing (RTMP/RTSP/SRT from OBS/encoders, or WHIP via our proxy).
    if (action === 'publish') {
      const allowed = await authorizePublish(channelId, user, pass);
      if (allowed) return 'OK';
      set.status = 401;
      return 'Unauthorized';
    }

    // Reading (HLS segments/playlists, WebRTC WHEP).
    if (action === 'read' || action === 'playlist') {
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (channel?.visibility === 'PUBLIC') return 'OK';
      // Private channels: allow with a valid ingest key (user/pass) as a backstage link.
      if (user) {
        const allowed = await authorizePublish(channelId, user, pass);
        if (allowed) return 'OK';
      }
      set.status = 401;
      return 'Unauthorized';
    }

    set.status = 401;
    return 'Unauthorized';
  });

async function authorizePublish(channelId: string, user: string, pass: string): Promise<boolean> {
  // Match credentials as <channelId> : <ingestKey.password>
  const key = await prisma.ingestKey.findFirst({
    where: {
      channelId,
      password: pass,
      enabled: true,
    },
  });
  if (key && user === channelId) return true;

  // Allow password-only match on any enabled key of the channel (simpler for encoders).
  if (key && !user) return true;

  return false;
}
