import { create } from 'zustand';
import { http } from '../lib/api';
import type { Channel } from '../types';

interface ChannelsState {
  channels: Channel[];
  loading: boolean;
  load: () => Promise<void>;
}

export const useChannelsStore = create<ChannelsState>((set) => ({
  channels: [],
  loading: false,
  async load() {
    set({ loading: true });
    try {
      const data = await http.get<{ items: Channel[] }>('/channels');
      set({ channels: data.items, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));