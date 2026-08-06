import { create } from 'zustand';
import type { Ticker } from '../types';

// Live-status bus. Connects once to the backend WebSocket and keeps a map of
// channelId -> live so any page can update badges/players without reloading.
// Also carries real-time ticker (marquee) updates broadcast by admins.

interface LiveState {
  live: Record<string, boolean>;
  tickers: Record<string, Ticker>;
  connect: () => void;
  setLive: (id: string, live: boolean) => void;
  setTicker: (id: string, ticker: Ticker) => void;
}

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

export const useLiveStore = create<LiveState>((set, get) => ({
  live: {},
  tickers: {},

  connect: () => {
    if (socket || socket !== null) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${window.location.host}/ws`);

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'channel:live') get().setLive(msg.id, msg.live);
        else if (msg.type === 'channel:ticker') get().setTicker(msg.id, msg.ticker);
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
  setTicker: (id, ticker) => set((s) => ({ tickers: { ...s.tickers, [id]: ticker } })),
}));

export function disconnectLive() {
  if (retry) clearTimeout(retry);
  socket?.close();
  socket = null;
}
