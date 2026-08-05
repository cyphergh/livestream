import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../lib/api';
import type { Channel } from '../../types';

export default function AdminDashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http
      .get<{ items: Channel[] }>('/admin/channels')
      .then((d) => setChannels(d.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Dashboard</h1>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-zinc-900 p-4">
          <div className="text-2xl font-bold">{channels.length}</div>
          <div className="text-sm text-zinc-500">Channels</div>
        </div>
        <div className="rounded-xl bg-zinc-900 p-4">
          <div className="text-2xl font-bold text-green-500">{channels.filter((c) => c.live).length}</div>
          <div className="text-sm text-zinc-500">Live now</div>
        </div>
        <div className="rounded-xl bg-zinc-900 p-4">
          <div className="text-2xl font-bold text-red-500">{channels.filter((c) => !c.live).length}</div>
          <div className="text-sm text-zinc-500">Offline</div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Your channels</h2>
        <button
          onClick={async () => {
            const name = prompt('Channel name');
            if (!name) return;
            const type = prompt('Type (TV or RADIO)', 'TV')?.toUpperCase();
            await http.post('/admin/channels', { name, type });
            const d = await http.get<{ items: Channel[] }>('/admin/channels');
            setChannels(d.items);
          }}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold hover:bg-brand-700"
        >
          + New channel
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <Link key={c.id} to={`/admin/studio/${c.slug}`} className="rounded-xl bg-zinc-900 p-4 hover:bg-zinc-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{c.name}</h3>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    c.live ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {c.live ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-sm text-zinc-500">{c.type}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}