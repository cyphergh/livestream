import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../lib/api';
import type { Channel } from '../../types';

export default function Radio() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [current, setCurrent] = useState<Channel | null>(null);

  useEffect(() => {
    http
      .get<{ items: Channel[] }>('/channels')
      .then((d) => setChannels(d.items.filter((c) => c.type === 'RADIO')));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Radio</h1>

      <ul className="divide-y divide-zinc-800 rounded-xl bg-zinc-900">
        {channels.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => setCurrent(c)}
              className={`flex w-full items-center gap-4 p-4 text-left transition hover:bg-zinc-800 ${
                current?.id === c.id ? 'bg-zinc-800' : ''
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  c.live ? 'bg-red-500' : 'bg-zinc-600'
                }`}
              />
              <span className="font-medium">{c.name}</span>
              {current?.id === c.id && <span className="ml-auto text-sm text-brand-600">Playing</span>}
            </button>
          </li>
        ))}
      </ul>

      {current?.hls && (
        <div className="sticky bottom-0 mt-6 rounded-t-xl bg-zinc-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">{current.name}</span>
            <span className="text-xs text-red-500">LIVE</span>
          </div>
          <audio controls autoPlay src={current.hls} className="w-full" />
        </div>
      )}
    </div>
  );
}