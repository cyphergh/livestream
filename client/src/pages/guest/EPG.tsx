import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../lib/api';
import type { Channel } from '../../types';

interface Row {
  id: string;
  name: string;
  type: Channel['type'];
  programs: { title: string; startsAt: Date; endsAt: Date }[];
}

export default function EPG() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    http
      .get<{ items: Channel[] }>('/channels')
      .then(({ items }) =>
        Promise.all(
          items.map(async (c) => {
            const full = c.hls
              ? await http.get<Channel>(`/channels/${c.slug}`).catch(() => c)
              : await http.get<Channel>(`/channels/${c.slug}`).catch(() => c);
            return {
              id: c.id,
              name: c.name,
              type: c.type,
              programs: (full.programs ?? []).map((p) => ({
                title: p.title,
                startsAt: new Date(p.startsAt),
                endsAt: new Date(p.endsAt),
              })),
            };
          })
        )
      )
      .then(setRows);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Electronic Program Guide</h1>
      <div className="overflow-x-auto rounded-xl bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="p-3 font-medium">Channel</th>
              <th className="p-3 font-medium">Program</th>
              <th className="p-3 font-medium">Starts</th>
              <th className="p-3 font-medium">Ends</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((r) =>
              r.programs.map((p, i) => (
                <tr key={`${r.id}-${i}`}>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{p.title}</td>
                  <td className="p-3 text-zinc-400">
                    {p.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 text-zinc-400">
                    {p.endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}