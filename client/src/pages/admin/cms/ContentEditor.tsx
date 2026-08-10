import { useEffect, useState } from 'react';
import { http } from '../../../lib/api';
import { DEFAULT_CONTENT, type ServiceTime } from '../../../config';
import type { MediaAsset, SiteSetting } from '../../../types';

type FieldValue = string | ServiceTime[] | null;

const FIELDS: { key: string; label: string; kind: 'text' | 'textarea'; hint?: string }[] = [
  { key: 'site.name', label: 'Church name', kind: 'text' },
  { key: 'hero.title', label: 'Hero headline', kind: 'textarea' },
  { key: 'hero.tagline', label: 'Hero sub-heading', kind: 'textarea' },
  { key: 'about.heading', label: 'About heading', kind: 'text' },
  { key: 'about.body', label: 'About text', kind: 'textarea' },
  { key: 'announcement', label: 'Announcement banner', kind: 'text', hint: 'Shown at the top of the "Plan your visit" section.' },
  { key: 'footer.text', label: 'Footer tagline', kind: 'text' },
];

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-brand-600 focus:outline-none';

export default function ContentEditor() {
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [images, setImages] = useState<MediaAsset[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, mediaRes] = await Promise.all([
          http.get<{ items: SiteSetting[] }>('/admin/settings'),
          http.get<{ items: MediaAsset[] }>('/admin/media'),
        ]);
        const v: Record<string, FieldValue> = {};
        for (const s of settingsRes.items) {
          if (typeof s.value === 'string') v[s.key] = s.value;
          else if (Array.isArray(s.value)) v[s.key] = s.value as ServiceTime[];
        }
        setValues(v);
        setImages(mediaRes.items.filter((m) => m.type === 'IMAGE'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load settings');
      }
    })();
  }, []);

  const get = (key: string): FieldValue => {
    const val = values[key];
    if (val !== undefined) return val;
    return ((DEFAULT_CONTENT as unknown as Record<string, unknown>)[key] as FieldValue) ?? '';
  };
  const set = (key: string, val: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const services = ((get('services') as ServiceTime[] | null) ?? []) as ServiceTime[];
  const aboutImage = (get('about.imageUrl') as string | null) ?? '';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const [key, value] of Object.entries(values)) {
        if (typeof value === 'string' || Array.isArray(value)) {
          await http.put(`/admin/settings/${encodeURIComponent(key)}`, { value });
        }
      }
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const serviceInput =
    'rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:border-brand-600 focus:outline-none';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-400">Landing page</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Content</h2>
          <p className="mt-1 text-sm text-zinc-400">Edit the church landing page — changes go live instantly.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm font-medium text-emerald-400">Saved ✓</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">{f.label}</label>
              {f.kind === 'textarea' ? (
                <textarea
                  value={(get(f.key) as string | null) ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={3}
                  className={inputCls}
                />
              ) : (
                <input
                  value={(get(f.key) as string | null) ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={inputCls}
                />
              )}
              {f.hint && <p className="mt-1 text-[11px] text-zinc-500">{f.hint}</p>}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">About image (parallax)</label>
            <input
              value={aboutImage}
              onChange={(e) => set('about.imageUrl', e.target.value || null)}
              placeholder="/uploads/cms/images/…"
              className={inputCls}
            />
            <p className="mt-2 mb-2 text-[11px] text-zinc-500">…or pick an uploaded image below.</p>
            {images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    title={img.name}
                    onClick={() => set('about.imageUrl', img.url)}
                    className={`relative aspect-video overflow-hidden rounded-lg ring-2 transition ${
                      aboutImage === img.url ? 'ring-brand-500' : 'ring-transparent hover:ring-white/20'
                    }`}
                  >
                    <img src={img.posterUrl ?? img.url} alt={img.name} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Upload images in the Media Library first.</p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Service times</label>
              <button
                type="button"
                onClick={() => set('services', [...services, { day: 'Sunday', time: '10:00 AM', name: 'New service' }])}
                className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-white hover:bg-zinc-600"
              >
                + Add
              </button>
            </div>
            {services.length === 0 ? (
              <p className="text-xs text-zinc-500">No services yet — add one to show on the landing page.</p>
            ) : (
              <div className="space-y-2">
                {services.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s.day}
                      onChange={(e) => set('services', services.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))}
                      placeholder="Day"
                      className={`${serviceInput} w-24`}
                    />
                    <input
                      value={s.time}
                      onChange={(e) => set('services', services.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
                      placeholder="Time"
                      className={`${serviceInput} w-28`}
                    />
                    <input
                      value={s.name}
                      onChange={(e) => set('services', services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      placeholder="Service name"
                      className={`${serviceInput} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => set('services', services.filter((_, j) => j !== i))}
                      aria-label="Remove service"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}