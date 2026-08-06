import { create } from 'zustand';
import type { Overlay } from '../types';

// Live-status bus. Connects once to the backend WebSocket and keeps a map of
// channelId -> live so any page can update badges/players without reloading.
// Also carries real-time overlay (logo/ticker/image/text) updates broadcast
// by admins from the Studio.

interface LiveState {
  live: Record<string, boolean>;
  overlays: Record<string, Overlay>;
  connect: () => void;
  setLive: (id: string, live: boolean) => void;
  setOverlay: (id: string, overlay: Overlay) => void;
}

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

export const useLiveStore = create<LiveState>((set, get) => ({
  live: {},
  overlays: {},

  connect: () => {
    if (socket || socket !== null) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${window.location.host}/ws`);

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'channel:live') get().setLive(msg.id, msg.live);
        else if (msg.type === 'channel:overlay') get().setOverlay(msg.id, msg.overlay);
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
  setOverlay: (id, overlay) => set((s) => ({ overlays: { ...s.overlays, [id]: overlay } })),
}));

export function disconnectLive() {
  if (retry) clearTimeout(retry);
  socket?.close();
  socket = null;
}
