import { useEffect } from 'react';
import { http } from '../../lib/api';
import type { Channel } from '../../types';
import { Link } from 'react-router-dom';
import { create } from 'zustand';
import { useLiveStore } from '../../stores/liveStore';

interface ChannelsState {
  channels: Channel[];
  loading: boolean;
  load: () => Promise<void>;
}

const useChannels = create<ChannelsState>((set) => ({
  channels: [],
  loading: false,
  async load() {
    set({ loading: true });
    const data = await http.get<{ items: Channel[] }>('/channels');
    set({ channels: data.items, loading: false });
  },
}));

function ChannelCard({ channel, live }: { channel: Channel; live: boolean }) {
  return (
    <Link
      to={`/channel/${channel.slug}`}
      className="group rounded-xl bg-zinc-900 p-4 transition hover:bg-zinc-800"
    >
      <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-zinc-800">
        {channel.coverUrl ? (
          <img src={channel.coverUrl} alt={channel.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-zinc-700">
            {channel.name.charAt(0)}
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-semibold ${
            live ? 'bg-red-600 text-white' : 'bg-zinc-700/80 text-zinc-200'
          }`}
        >
          {live ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{channel.name}</h3>
          <p className="text-sm text-zinc-400">{channel.type === 'RADIO' ? 'Radio' : 'TV'}</p>
        </div>
        <span className="text-xs uppercase tracking-wide text-brand-600">{channel.type}</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { channels, loading, load } = useChannels();
  const live = useLiveStore((s) => s.live);
  const connect = useLiveStore((s) => s.connect);

  useEffect(() => {
    connect();
    load();
  }, [connect, load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">LiveStream</h1>
        <nav className="flex gap-4 text-sm text-zinc-300">
          <Link to="/radio">Radio</Link>
          <Link to="/epg">EPG</Link>
          <Link to="/login" className="text-brand-600">
            Sign in
          </Link>
        </nav>
      </header>

      <h2 className="mb-4 text-lg font-semibold text-zinc-300">Channels</h2>
      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} live={live[c.id] ?? c.live} />
          ))}
        </div>
      )}
    </div>
  );
}