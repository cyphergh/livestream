import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../lib/api';
import { useLiveStore } from '../../stores/liveStore';
import type { GuideRow } from '../../types';

export default function EPG() {
  const [rows, setRows] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const programs = useLiveStore((s) => s.programs);
  const connect = useLiveStore((s) => s.connect);

  const load = () =>
    http
      .get<{ items: GuideRow[] }>('/guide')
      .then((d) => setRows(d.items))
      .finally(() => setLoading(false));

  // Re-fetch whenever an admin adds/edits/deletes any program so the guide
  // stays in sync in real time.
  useEffect(() => {
    connect();
    load();
  }, [programs, connect]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Electronic Program Guide</h1>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-zinc-500">No guide available yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link
              key={r.slug}
              to={`/channel/${r.slug}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-blue-600/40"
            >
              <div className="mb-2 flex items-center gap-3">
                {r.logoUrl ? (
                  <img src={r.logoUrl} alt={r.name} className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-700">
                    {r.name.charAt(0)}
                  </div>
                )}
                <span className="font-semibold text-zinc-800">{r.name}</span>
                <span className="text-xs text-zinc-500">{r.type === 'TV' ? 'TV' : 'Radio'}</span>
                {r.live && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
                  </span>
                )}
              </div>

              {r.programs.length === 0 ? (
                <p className="text-sm text-zinc-500">No programs today.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {r.programs.map((p) => (
                    <div key={p.id} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm">
                      <span className="text-zinc-500">
                        {new Date(p.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·
                      </span>{' '}
                      <span className="font-medium">{p.title}</span>
                      {p.genre && (
                        <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600">
                          {p.genre}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}