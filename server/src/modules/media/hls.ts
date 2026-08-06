import { Elysia } from 'elysia';
import { config } from '../../config';

// Single-origin HLS proxy. MediaMTX is configured with `hlsCDNSecret`; when we
// present that secret as a Bearer token, MediaMTX identifies us as a CDN and
// disables its HLS session/cookie hotlink check entirely, so manifests and
// segments stream straight through with no 302 dance.

const AUTH = `Bearer ${config.MEDIAMTX_HLS_SECRET}`;

export const hlsProxy = new Elysia().all('/api/hls/*', async ({ request, set }) => {
  const url = new URL(request.url);
  const rest = decodeURIComponent(url.pathname.replace(/^\/api\/hls\//, '') || '');
  if (!rest) {
    set.status = 404;
    return { message: 'Not found' };
  }

  try {
    const res = await fetch(`${config.MEDIAMTX_HLS_URL}/${rest}?${url.searchParams}`, {
      headers: { Authorization: AUTH },
      redirect: 'manual',
    });

    if (!res.ok && res.status !== 404) {
      console.error('[hls-proxy]', rest, '->', res.status);
    }

    const body = await res.arrayBuffer();
    set.status = res.status;
    set.headers['Content-Type'] = res.headers.get('content-type') ?? 'application/octet-stream';
    set.headers['Cache-Control'] = res.status === 200 ? 'max-age=30' : 'no-store';
    return new Response(body);
  } catch (e) {
    console.error('[hls-proxy] error', rest, (e as Error).message);
    set.status = 502;
    return { message: 'Media server unreachable' };
  }
});
