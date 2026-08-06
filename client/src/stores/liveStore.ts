import { create } from 'zustand';

// Live-status bus. Connects once to the backend WebSocket and keeps a map of
// channelId -> live so any page can update badges/players without reloading.

interface LiveState {
  live: Record<string, boolean>;
  connect: () => void;
  setLive: (id: string, live: boolean) => void;
}

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

export const useLiveStore = create<LiveState>((set, get) => ({
  live: {},

  connect: () => {
    if (socket || socket !== null) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${window.location.host}/ws`);

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'channel:live') get().setLive(msg.id, msg.live);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = () => {
      socket = null;
      retry = setTimeout(() => get().connect(), 3000);
    };
  },

  setLive: (id, live) => set((s) => ({ live: { ...s.live, [id]: live } })),
}));

export function disconnectLive() {
  if (retry) clearTimeout(retry);
  socket?.close();
  socket = null;
}
