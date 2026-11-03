import { Elysia } from 'elysia';
import { prisma } from '../../lib/db';
import { config } from '../../config';

// Same-origin WHEP read gateway. The viewer's browser POSTs its SDP offer to
// /api/media/whep/:channelId; we forward it to MediaMTX's WHEP endpoint and
// rewrite MediaMTX's absolute Location (http://host:8889/.../whep/<session>)
// to OUR origin so the client's PATCH (trickle-ICE) / DELETE (teardown) go
// through us instead of a hardcoded host. Readers of PUBLIC channels are
// already authorized by the external-auth handler, so no credentials needed.

const whepBase = (path: string) =>
  `${config.MEDIAMTX_WHEP_URL}/${encodeURIComponent(path)}/whep`;

export const whepProxy = new Elysia({ prefix: '/api/media/whep' })
  .post('/:channelId', async ({ params, request, set }) => {
    const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
    if (!channel || channel.visibility !== 'PUBLIC') {
      set.status = 401;
      return { message: 'Unauthorized' };
    }

    const sdp = await request.text();
    const res = await fetch(whepBase(params.channelId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sdp,
    });
    if (!res.ok) {
      set.status = res.status;
      return { message: 'Media server rejected read', detail: await res.text() };
    }

    // Rewrite MediaMTX's absolute Location to our same-origin resource so ICE
    // trickle (PATCH) and teardown (DELETE) come back through this gateway.
    const session = res.headers.get('Location')?.split('/').filter(Boolean).pop();
    if (session) set.headers['Location'] = `/api/media/whep/${params.channelId}/${session}`;
    set.status = res.status;
    return res.body;
  })
  .patch('/:channelId/:session', async ({ params, request, set }) => {
    const ice = await request.text();
    const res = await fetch(`${whepBase(params.channelId)}/${params.session}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/trickle-ice-sdpfrag' },
      body: ice,
    });
    set.status = res.status;
    if (!res.ok) return { message: await res.text() };
    return res.body;
  })
  .delete('/:channelId/:session', async ({ params, set }) => {
    const res = await fetch(`${whepBase(params.channelId)}/${params.session}`, {
      method: 'DELETE',
    });
    set.status = res.status;
    return res.body;
  });