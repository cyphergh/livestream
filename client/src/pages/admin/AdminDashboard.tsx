import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../lib/api';
import type { AccessType, Channel, ChannelType } from '../../types';

const statCards = [
  { key: 'total', label: 'Channels', accent: 'from-indigo-500 to-violet-500', icon: '📡' },
  { key: 'live', label: 'Live now', accent: 'from-red-500 to-rose-500', icon: '🔴' },
  { key: 'offline', label: 'Offline', accent: 'from-zinc-500 to-zinc-700', icon: '⏸' },
] as const;

export default function AdminDashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = () =>
    http.get<{ items: Channel[] }>('/admin/channels').then((d) => setChannels(d.items));

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const removeChannel = async (c: Channel) => {
    if (!window.confirm(`Delete station "${c.name}"? This cannot be undone.`)) return;
    try {
      await http.del(`/admin/channels/${c.id}`);
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete station');
    }
  };

  const stats = {
    total: channels.length,
    live: channels.filter((c) => c.live).length,
    offline: channels.filter((c) => !c.live).length,
  };

  return (
    <div className="relative">
      {/* cinematic ambience */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#4f46e5_0%,transparent_50%),radial-gradient(circle_at_bottom_left,#a855f7_0%,transparent_45%)]" />
        <div className="absolute right-0 top-1/4 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-fuchsia-600/15 blur-3xl" />
      </div>

      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-400">Control room</p>
        <h1 className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-3xl font-bold text-transparent">
          Broadcasting dashboard
        </h1>
      </header>

      {/* stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {statCards.map((s) => (
          <div
            key={s.key}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
          >
            <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${s.accent}`} />
            <div className="mb-2 flex items-center justify-between">
              <span className="text-3xl">{s.icon}</span>
              <span className="text-xs text-zinc-400">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`bg-gradient-to-r ${s.accent} bg-clip-text text-4xl font-bold text-transparent`}
              >
                {stats[s.key]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Your stations</h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-110"
        >
          + New channel
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : channels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-zinc-400 backdrop-blur">
          No channels yet. Create your first TV or radio station.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <div
              key={c.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-600/10"
            >
              <Link
                to={`/admin/studio/${c.slug}`}
                aria-label={`Open studio for ${c.name}`}
                className="absolute inset-0 z-0"
              />
              <div className="pointer-events-none relative z-10 p-4">
                <div className="mb-2 flex items-center gap-3">
                  {c.logoUrl ? (
                    <img
                      src={c.logoUrl}
                      alt={c.name}
                      className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-fuchsia-600 text-sm font-bold text-white">
                      {c.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{c.name}</h3>
                    <p className="text-xs text-zinc-400">{c.type}</p>
                  </div>
                  <span
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      c.live ? 'bg-red-500/20 text-red-300' : 'bg-zinc-700/50 text-zinc-300'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        c.live ? 'animate-pulse bg-red-500' : 'bg-zinc-500'
                      }`}
                    />
                    {c.live ? 'LIVE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex gap-2 text-[11px] text-zinc-400">
                  {c.type === 'TV' && (
                    <span className="rounded-md bg-black/30 px-2 py-0.5">
                      {c.accessType === 'SUBSCRIPTION' ? '🔒 Subscription' : '📡 Free to air'}
                    </span>
                  )}
                  <span className="ml-auto text-zinc-500 opacity-0 transition group-hover:opacity-100">
                    Open studio →
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeChannel(c)}
                aria-label={`Delete ${c.name}`}
                title="Delete station"
                className="absolute right-2 top-2 z-20 rounded-md bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300 opacity-0 transition hover:bg-red-500/40 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && <CreateChannelModal onClose={() => setCreating(false)} onCreated={refresh} />}
    </div>
  );
}

function CreateChannelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('TV');
  const [accessType, setAccessType] = useState<AccessType>('FREE');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      setLogoUrl('');
      setLogoFile(file);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let finalLogo: string | undefined = logoUrl.trim() || undefined;
      if (logoFile) {
        const res = await http.upload<{ url: string }>('/uploads/logo', logoFile);
        finalLogo = res.url;
      }
      await http.post('/admin/channels', {
        name: name.trim(),
        type,
        accessType: type === 'TV' ? accessType : undefined,
        logoUrl: finalLogo,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create channel');
      setSaving(false);
    }
  };

  const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm';
  const label = 'mb-1 block text-xs font-medium text-zinc-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New channel</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className={label}>Channel name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as ChannelType)} className={input}>
                <option value="TV">TV</option>
                <option value="RADIO">Radio</option>
              </select>
            </label>
            {type === 'TV' && (
              <label className="block">
                <span className={label}>Access</span>
                <select
                  value={accessType}
                  onChange={(e) => setAccessType(e.target.value as AccessType)}
                  className={input}
                >
                  <option value="FREE">Free to air</option>
                  <option value="SUBSCRIPTION">Subscription</option>
                </select>
              </label>
            )}
          </div>

          <label className="block">
            <span className={label}>Logo</span>
            <div className="flex items-center gap-3">
              <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/30">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-zinc-500">Upload</span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              </label>
              <input
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  if (e.target.value) {
                    setLogoFile(null);
                    setLogoPreview(null);
                  }
                }}
                placeholder="…or paste an image URL"
                className={input}
              />
            </div>
          </label>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-brand-600 to-fuchsia-600 px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create channel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}