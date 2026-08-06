import { Elysia } from 'elysia';
import { prisma } from '../lib/db';
import { mediaServer } from '../lib/mediaserver';

// Real-time live-status bus. Clients connect via a WebSocket and receive
// `channel:live` events whenever a channel goes on/off air, so viewers don't
// need to refresh. A background poller diffs MediaMTX path states against the
// last known set and broadcasts only actual transitions.

type Client = {
  send: (data: string) => void;
};

const clients = new Set<Client>();
let known = new Set<string>();

const broadcast = (payload: unknown) => {
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      /* ignore dropped clients */
    }
  }
};

// Poll every few seconds and emit transitions. Reuses the same isLive() check
// used by the REST channel endpoints, keeping both views consistent.
let timer: ReturnType<typeof setTimeout> | null = null;
async function poll() {
  try {
    const channels = await prisma.channel.findMany({ select: { id: true } });
    const live = new Set<string>();
    for (const c of channels) if (await mediaServer.isLive(c.id)) live.add(c.id);

    for (const id of live) if (!known.has(id)) broadcast({ type: 'channel:live', id, live: true });
    for (const id of known) if (!live.has(id)) broadcast({ type: 'channel:live', id, live: false });
    known = live;
  } catch {
    // transient — retry next tick
  }
}

export const realtime = new Elysia()
  .ws('/ws', {
    open(ws) {
      clients.add(ws);
    },
    close(ws) {
      clients.delete(ws);
    },
  })
  .onStart(() => {
    timer = setInterval(poll, 4000);
    poll();
  });

export function stopRealtime() {
  if (timer) clearInterval(timer);
  timer = null;
}