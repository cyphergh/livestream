import { create } from 'zustand';
import type { Channel, Overlay, Program } from '../types';

// Live-status bus. Connects once to the backend WebSocket and keeps a map of
// channelId -> live so any page can update badges/players without reloading.
// Also carries real-time overlay (logo/ticker/image/text), channel metadata
// (thumbnail/logo), and program-guide schedule updates.

interface LiveState {
  live: Record<string, boolean>;
  overlays: Record<string, Overlay>;
  channels: Record<string, Channel>;
  programs: Record<string, Program[]>;
  connect: () => void;
  setLive: (id: string, live: boolean) => void;
  setOverlay: (id: string, overlay: Overlay) => void;
  setChannel: (id: string, channel: Channel) => void;
  setPrograms: (id: string, programs: Program[]) => void;
}

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

export const useLiveStore = create<LiveState>((set, get) => ({
  live: {},
  overlays: {},
  channels: {},
  programs: {},

  connect: () => {
    if (socket || socket !== null) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${window.location.host}/ws`);

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'channel:live') get().setLive(msg.id, msg.live);
        else if (msg.type === 'channel:overlay') get().setOverlay(msg.id, msg.overlay);
        else if (msg.type === 'channel:update') get().setChannel(msg.id, msg.channel);
        else if (msg.type === 'channel:programs') get().setPrograms(msg.id, msg.programs);
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
  setChannel: (id, channel) => set((s) => ({ channels: { ...s.channels, [id]: channel } })),
  setPrograms: (id, programs) => set((s) => ({ programs: { ...s.programs, [id]: programs } })),
}));

export function disconnectLive() {
  if (retry) clearTimeout(retry);
  socket?.close();
  socket = null;
}
