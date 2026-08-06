import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { http } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { startWhip, type WhipSession } from '../../lib/whip';
import type {
  Channel,
  Overlay,
  OverlayPosition,
  Program,
} from '../../types';

interface IngestInfo {
  rtmp: { url: string; streamKey: string | null };
  rtsp: { url: string; streamKey: string | null };
  srt: { url: string; streamKey: string | null };
  whip: string;
  live: boolean;
}

export default function Studio() {
  const { slug } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [ingest, setIngest] = useState<IngestInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [whip, setWhip] = useState<WhipSession | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceType, setDeviceType] = useState<'radiio' | 'tv'>('tv');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    http
      .get<{ items: Channel[] }>('/admin/channels')
      .then((d) => setChannel(d.items.find((c) => c.slug === slug) ?? null));
  }, [slug]);

  useEffect(() => {
    if (!channel) return;
    http
      .get<IngestInfo>(`/admin/channels/${channel.id}/ingest`)
      .then(setIngest)
      .catch(() => {});
  }, [channel]);

  // Load the saved overlay config for this channel.
  useEffect(() => {
    if (!channel) return;
    setOverlayLoading(true);
    http
      .get<{ overlay: Overlay | null }>(`/admin/channels/${channel.id}/overlay`)
      .then((d) => setOverlay(d.overlay))
      .catch(() => {})
      .finally(() => setOverlayLoading(false));
  }, [channel]);

  // Preferred media type = the channel's type.
  useEffect(() => setDeviceType(channel?.type === 'TV' ? 'tv' : 'radiio'), [channel]);

  async function enablePreview() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceType === 'tv',
        audio: true,
      });
      setLocalStream(stream);
      if (previewRef.current) previewRef.current.srcObject = stream;
    } catch (err) {
      setError('Could not access camera/microphone: ' + (err as Error).message);
    }
  }

  async function goLive() {
    if (!channel || !localStream || !accessToken) return;
    setPending(true);
    setError(null);
    try {
      const session = await startWhip({
        resourceUrl: ingressFor(channel.id),
        stream: localStream,
        accessToken,
      });
      setWhip(session);
      await http.post(`/admin/channels/${channel.id}/sessions`, { title: channel.name });
      setIngest((prev) => (prev ? { ...prev, live: true } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to go live');
    } finally {
      setPending(false);
    }
  }

  function ingressFor(channelId: string): string {
    return `/api/media/whip/${channelId}`;
  }

  function stopStream() {
    whip?.close();
    setWhip(null);
    if (channel) {
      http.post(`/admin/channels/${channel.id}/sessions/stop`).then(() => {
        setIngest((prev) => (prev ? { ...prev, live: false } : prev));
      });
    }
  }

  const live = ingest?.live || !!whip;

  // Persist overlay settings; the server broadcasts the new config over the
  // WebSocket so viewers see the change immediately, no reload needed.
  async function saveOverlay(next: Overlay) {
    if (!channel) return;
    setOverlay(next);
    await http
      .put<{ overlay: Overlay }>(`/admin/channels/${channel.id}/overlay`, next)
      .then((d) => setOverlay(d.overlay))
      .catch(() => {});
  }

  // Quick ticker edit (below the stream preview): update locally on each
  // keystroke, persist after a short pause so we don't spam the server.
  const quickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function quickEditText(text: string) {
    if (!overlay) return;
    setOverlay({ ...overlay, text });
    if (quickTimer.current) clearTimeout(quickTimer.current);
    quickTimer.current = setTimeout(() => {
      saveOverlay({ ...overlay, text });
    }, 500);
  }

  const [logoUrlDraft, setLogoUrlDraft] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  // Change the channel logo. Uploaded files are stored on disk; the server
  // deletes the previous uploaded logo before saving the new one.
  async function changeLogo(file: File) {
    if (!channel) return;
    setLogoBusy(true);
    try {
      const res = await http.upload<{ url: string }>('/uploads/logo', file);
      await saveLogo(res.url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Logo upload failed');
    } finally {
      setLogoBusy(false);
    }
  }

  async function saveLogo(url: string | null) {
    if (!channel) return;
    const res = await http.patch<{ channel: Channel }>(`/admin/channels/${channel.id}`, {
      logoUrl: url,
    });
    setChannel(res.channel);
    setLogoUrlDraft('');
  }

  const [thumbUrlDraft, setThumbUrlDraft] = useState('');
  const [thumbBusy, setThumbBusy] = useState(false);

  // Channel card thumbnail (shown on the home page TV card). Replaces the
  // existing one; the server deletes the previous uploaded file.
  async function changeThumb(file: File) {
    if (!channel) return;
    setThumbBusy(true);
    try {
      const res = await http.upload<{ url: string }>('/uploads/thumbnail', file);
      await saveThumb(res.url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Thumbnail upload failed');
    } finally {
      setThumbBusy(false);
    }
  }

  async function saveThumb(url: string | null) {
    if (!channel) return;
    const res = await http.patch<{ channel: Channel }>(`/admin/channels/${channel.id}`, {
      coverUrl: url,
    });
    setChannel(res.channel);
    setThumbUrlDraft('');
  }

  return (
    <div>
      <Link to="/admin" className="mb-4 inline-block text-sm text-brand-600">
        ← Dashboard
      </Link>
      <h1 className="mb-6 text-xl font-bold">{channel?.name ?? 'Studio'}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-zinc-900 p-4">
          <h2 className="mb-3 font-semibold">Camera & microphone</h2>
          <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-black">
            <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            {overlay && (
              <OverlayPreview overlay={overlay} logo={channel?.logoUrl ?? null} />
            )}
          </div>

          {overlay?.mode === 'ticker' && (
            <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Ticker text (quick edit)</span>
                <button
                  onClick={() => setOverlayOpen(true)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Full overlay editor →
                </button>
              </div>
              <textarea
                value={overlay.text}
                onChange={(e) => quickEditText(e.target.value)}
                rows={3}
                placeholder="Breaking news: …"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm placeholder-zinc-600"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                New lines render as horizontal spacing on air.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as 'radiio' | 'tv')}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
            >
              <option value="tv">Video + audio</option>
              <option value="radiio">Audio only (radio)</option>
            </select>
            {!localStream && (
              <button onClick={enablePreview} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-600">
                Enable camera
              </button>
            )}
            {localStream && !whip && (
              <button
                onClick={goLive}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? 'Starting…' : '● Go live'}
              </button>
            )}
            {whip && (
              <button onClick={stopStream} className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm font-semibold hover:bg-zinc-600">
                Stop stream
              </button>
            )}
            {localStream && (
              <button
                onClick={() => {
                  localStream.getTracks().forEach((t) => t.stop());
                  setLocalStream(null);
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Release camera
              </button>
            )}
          </div>
          {live && (
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-red-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> On air
            </span>
          )}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </section>

        <section className="space-y-4">
          <div className="rounded-xl bg-zinc-900 p-4">
            <h2 className="mb-3 font-semibold">Encoder ingest (OBS, etc.)</h2>
            {ingest ? (
              <div className="space-y-2 text-sm">
                {[
                  { label: 'RTMP', url: ingest.rtmp.url, streamKey: ingest.rtmp.streamKey },
                  { label: 'RTSP', url: ingest.rtsp.url, streamKey: ingest.rtsp.streamKey },
                  { label: 'SRT', url: ingest.srt.url, streamKey: ingest.srt.streamKey },
                ].map((row) => (
                  <div key={row.label} className="rounded bg-zinc-800 p-2">
                    <div className="font-medium text-zinc-400">{row.label}</div>
                    <CopyRow value={row.url} />
                    <div className="text-xs text-zinc-500">Stream path/user: {channel?.id}</div>
                    {row.streamKey && <CopyRow value={row.streamKey} />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Loading ingest info…</p>
            )}
          </div>

          <div className="rounded-xl bg-zinc-900 p-4">
            <h2 className="mb-2 font-semibold">Go live from browser</h2>
            <p className="text-sm text-zinc-500">Uses WebRTC (WHIP) — no external software needed.</p>
          </div>

          <div className="rounded-xl bg-zinc-900 p-4">
            <h2 className="mb-3 font-semibold">Channel logo</h2>
            {channel ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  {channel.logoUrl ? (
                    <img
                      src={channel.logoUrl}
                      alt="Channel logo"
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/30 text-xs text-zinc-500">
                      No logo
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="cursor-pointer rounded-lg bg-zinc-700 px-3 py-1.5 text-center text-sm font-medium hover:bg-zinc-600">
                      {logoBusy ? 'Uploading…' : 'Change logo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={logoBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) changeLogo(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {channel.logoUrl && (
                      <button
                        onClick={() => saveLogo(null)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                      >
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    value={logoUrlDraft}
                    onChange={(e) => setLogoUrlDraft(e.target.value)}
                    placeholder="…or paste an image URL"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => logoUrlDraft.trim() && saveLogo(logoUrlDraft.trim())}
                    disabled={!logoUrlDraft.trim()}
                    className="shrink-0 rounded-lg bg-zinc-700 px-3 py-1 text-sm font-medium hover:bg-zinc-600 disabled:opacity-50"
                  >
                    Set
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Loading…</p>
            )}
          </div>

          <div className="rounded-xl bg-zinc-900 p-4">
            <h2 className="mb-3 font-semibold">Channel thumbnail</h2>
            {channel ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  {channel.coverUrl ? (
                    <img
                      src={channel.coverUrl}
                      alt="Channel thumbnail"
                      className="aspect-video h-16 w-28 rounded-lg object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex aspect-video h-16 w-28 items-center justify-center rounded-lg border border-dashed border-zinc-600 bg-zinc-800 text-xs text-zinc-500">
                      No thumbnail
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="cursor-pointer rounded-lg bg-zinc-700 px-3 py-1.5 text-center text-sm font-medium hover:bg-zinc-600">
                      {thumbBusy ? 'Uploading…' : 'Change thumbnail'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={thumbBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) changeThumb(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {channel.coverUrl && (
                      <button
                        onClick={() => saveThumb(null)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                      >
                        Remove thumbnail
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    value={thumbUrlDraft}
                    onChange={(e) => setThumbUrlDraft(e.target.value)}
                    placeholder="…or paste an image URL"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => thumbUrlDraft.trim() && saveThumb(thumbUrlDraft.trim())}
                    disabled={!thumbUrlDraft.trim()}
                    className="shrink-0 rounded-lg bg-zinc-700 px-3 py-1 text-sm font-medium hover:bg-zinc-600 disabled:opacity-50"
                  >
                    Set
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Loading…</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setGuideOpen(true)}
              className="rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              Program guide (EPG)
            </button>
            <button
              onClick={() => setOverlayOpen(true)}
              className="rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              On-air overlay
            </button>
          </div>
        </section>
      </div>

      {overlayOpen && (
        <Modal title="On-air overlay" onClose={() => setOverlayOpen(false)} wide>
          {overlayLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : overlay ? (
            <OverlaySettings overlay={overlay} onSave={saveOverlay} logo={channel?.logoUrl ?? null} />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-zinc-500">
                No overlay configured. Ticker, logo overlay, or static image/text.
              </p>
              <button
                onClick={() =>
                  saveOverlay({
                    mode: 'off',
                    logoVisible: true,
                    text: '',
                    position: 'bottom',
                    fontSize: 28,
                    color: '#ffffff',
                    bgColor: 'rgba(0,0,0,0.55)',
                    speed: 12,
                    opacity: 0.85,
                    imageUrl: null,
                    width: null,
                    height: null,
                    borderRadius: 0,
                  })
                }
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold hover:bg-brand-700"
              >
                Configure overlay
              </button>
            </div>
          )}
        </Modal>
      )}

      {guideOpen && (
        <Modal title="Program guide (EPG)" onClose={() => setGuideOpen(false)}>
          <ProgramGuide channelId={channel?.id ?? ''} />
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[88vh] w-full flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl ${
          wide ? 'w-[90vw] max-w-[90vw]' : 'max-w-3xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function OverlaySettings({
  overlay,
  onSave,
  logo,
}: {
  overlay: Overlay;
  onSave: (next: Overlay) => void;
  logo: string | null;
}) {
  const [draft, setDraft] = useState<Overlay>(overlay);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => setDraft(overlay), [overlay]);

  const set = (patch: Partial<Overlay>) => setDraft((d) => ({ ...d, ...patch }));

  // Save on every change — debounced slightly so slider drags don't spam.
  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(overlay)) return;
    const id = setTimeout(() => {
      onSave(draft);
      setSavedAt(Date.now());
    }, 400);
    return () => clearTimeout(id);
  }, [draft, overlay, onSave]);

  const label = 'text-xs font-medium text-zinc-400';
  const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm';
  const row = 'flex flex-col gap-1';
  const modes: { value: Overlay['mode']; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'ticker', label: 'Scrolling ticker' },
    { value: 'image', label: 'Static image' },
    { value: 'text', label: 'Static text' },
  ];

  return (
    <div className="space-y-3 text-sm">
      <label className={row}>
        <span className={label}>Overlay type</span>
        <select
          value={draft.mode}
          onChange={(e) => set({ mode: e.target.value as Overlay['mode'] })}
          className={input}
        >
          {modes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.logoVisible}
          onChange={(e) => set({ logoVisible: e.target.checked })}
          className="h-4 w-4 accent-brand-600"
        />
        <span className={label}>Show channel logo (top-right) during playback</span>
      </label>

      {draft.mode === 'ticker' && (
        <>
          <label className={row}>
            <span className={label}>Ticker text</span>
            <textarea value={draft.text} onChange={(e) => set({ text: e.target.value })} rows={2} className={input} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Position</span>
              <select
                value={draft.position}
                onChange={(e) => set({ position: e.target.value as OverlayPosition })}
                className={input}
              >
                <option value="bottom">Bottom</option>
                <option value="top">Top</option>
              </select>
            </label>
            <label className={row}>
              <span className={label}>
                Speed: <span className="text-zinc-200">{draft.speed} px/s</span>
              </span>
              <input
                type="range"
                min={1}
                max={100}
                value={draft.speed}
                onChange={(e) => set({ speed: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Font size</span>
              <input
                type="number"
                min={8}
                max={160}
                value={draft.fontSize}
                onChange={(e) => set({ fontSize: Number(e.target.value) })}
                className={input}
              />
            </label>
            <label className={row}>
              <span className={label}>
                Opacity: <span className="text-zinc-200">{Math.round(draft.opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.opacity}
                onChange={(e) => set({ opacity: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Text color</span>
              <input
                type="color"
                value={normalizeHex(draft.color)}
                onChange={(e) => set({ color: e.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800"
              />
            </label>
            <label className={row}>
              <span className={label}>Bar background</span>
              <input
                type="color"
                value={normalizeHex(draft.bgColor)}
                onChange={(e) => set({ bgColor: e.target.value + '8c' })}
                disabled={draft.bgColor === 'transparent'}
                className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 disabled:opacity-40"
              />
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.bgColor === 'transparent'}
                  onChange={(e) => set({ bgColor: e.target.checked ? 'transparent' : '#0000008c' })}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="text-xs">Transparent</span>
              </label>
            </label>
          </div>
        </>
      )}

      {draft.mode === 'image' && (
        <>
          <label className={row}>
            <span className={label}>Image (upload or URL)</span>
            <div className="flex items-center gap-2">
              <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-600 bg-zinc-800">
                {draft.imageUrl ? (
                  <img src={draft.imageUrl} alt="overlay" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-zinc-500">Upload</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onload = () => set({ imageUrl: r.result as string });
                      r.readAsDataURL(f);
                    }
                  }}
                />
              </label>
              <input
                value={draft.imageUrl ?? ''}
                onChange={(e) => set({ imageUrl: e.target.value || null })}
                placeholder="…or paste image URL"
                className={input}
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Position</span>
              <select
                value={draft.position}
                onChange={(e) => set({ position: e.target.value as OverlayPosition })}
                className={input}
              >
                {positionOptions()}
              </select>
            </label>
            <label className={row}>
              <span className={label}>
                Opacity: <span className="text-zinc-200">{Math.round(draft.opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.opacity}
                onChange={(e) => set({ opacity: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Width (px)</span>
              <input
                type="number"
                min={8}
                value={draft.width ?? 120}
                onChange={(e) => set({ width: Number(e.target.value) })}
                className={input}
              />
            </label>
            <label className={row}>
              <span className={label}>Height (px)</span>
              <input
                type="number"
                min={8}
                value={draft.height ?? 80}
                onChange={(e) => set({ height: Number(e.target.value) })}
                className={input}
              />
            </label>
          </div>

          <label className={row}>
            <span className={label}>Border radius (px)</span>
            <input
              type="number"
              min={0}
              max={500}
              value={draft.borderRadius}
              onChange={(e) => set({ borderRadius: Number(e.target.value) })}
              className={input}
            />
          </label>
        </>
      )}

      {draft.mode === 'text' && (
        <>
          <label className={row}>
            <span className={label}>Text</span>
            <input
              value={draft.text}
              onChange={(e) => set({ text: e.target.value })}
              placeholder="Static text on air"
              className={input}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Position</span>
              <select
                value={draft.position}
                onChange={(e) => set({ position: e.target.value as OverlayPosition })}
                className={input}
              >
                {positionOptions()}
              </select>
            </label>
            <label className={row}>
              <span className={label}>Font size</span>
              <input
                type="number"
                min={8}
                max={160}
                value={draft.fontSize}
                onChange={(e) => set({ fontSize: Number(e.target.value) })}
                className={input}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Background</span>
              <input
                type="color"
                value={normalizeHex(draft.bgColor)}
                onChange={(e) => set({ bgColor: e.target.value + '8c' })}
                disabled={draft.bgColor === 'transparent'}
                className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 disabled:opacity-40"
              />
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.bgColor === 'transparent'}
                  onChange={(e) => set({ bgColor: e.target.checked ? 'transparent' : '#0000008c' })}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="text-xs">Transparent</span>
              </label>
            </label>
            <label className={row}>
              <span className={label}>Text color</span>
              <input
                type="color"
                value={normalizeHex(draft.color)}
                onChange={(e) => set({ color: e.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={row}>
              <span className={label}>Border radius (px)</span>
              <input
                type="number"
                min={0}
                max={500}
                value={draft.borderRadius}
                onChange={(e) => set({ borderRadius: Number(e.target.value) })}
                className={input}
              />
            </label>
            <label className={row}>
              <span className={label}>
                Opacity: <span className="text-zinc-200">{Math.round(draft.opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.opacity}
                onChange={(e) => set({ opacity: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </label>
          </div>
        </>
      )}

      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
        <OverlayPreview overlay={draft} logo={logo} />
      </div>

      {savedAt > 0 && <p className="text-xs text-emerald-500">Saved</p>}
    </div>
  );
}

function OverlayPreview({ overlay, logo }: { overlay: Overlay; logo: string | null }) {
  const pos = positionClass(overlay.position);
  return (
    <>
      {overlay.logoVisible && logo && (
        <img
          src={logo}
          alt="logo"
          className="pointer-events-none absolute right-3 top-3 h-12 w-12 rounded object-cover shadow"
        />
      )}
      {overlay.mode === 'ticker' && (
          <div
            className={`pointer-events-none absolute inset-x-0 overflow-hidden py-1.5 ${
              overlay.position === 'top' ? 'top-0' : 'bottom-0'
            }`}
            style={{
              fontSize: `${Math.max(10, Math.min(40, overlay.fontSize))}px`,
              color: overlay.color,
              backgroundColor: overlay.bgColor,
              opacity: overlay.opacity,
            }}
          >
            <div
              className="inline-flex whitespace-nowrap"
              style={{ animation: `marquee ${estimateTickDur(overlay)}s linear infinite` }}
            >
              <span
                className="whitespace-pre px-6 font-semibold"
                style={{ backgroundColor: 'transparent', color: overlay.color }}
              >
                {tickerText(overlay.text) || 'Ticker preview'}
              </span>
              <span
                className="whitespace-pre px-6 font-semibold"
                style={{ backgroundColor: 'transparent', color: overlay.color }}
              >
                {tickerText(overlay.text) || 'Ticker preview'}
              </span>
            </div>
          </div>
      )}
      {overlay.mode === 'image' && overlay.imageUrl && (
        <img
          src={overlay.imageUrl}
          alt="overlay"
          className={`pointer-events-none absolute ${pos} object-contain`}
          style={{
            width: overlay.width ?? 120,
            height: overlay.height ?? 80,
            borderRadius: overlay.borderRadius,
            opacity: overlay.opacity,
          }}
        />
      )}
      {overlay.mode === 'text' && (
        <div
          className={`pointer-events-none absolute ${pos} px-3 py-1.5`}
          style={{
            fontSize: `${Math.max(10, Math.min(48, overlay.fontSize))}px`,
            color: overlay.color,
            backgroundColor: overlay.bgColor,
            borderRadius: overlay.borderRadius,
            opacity: overlay.opacity,
          }}
        >
          {overlay.text || 'Static text'}
        </div>
      )}
    </>
  );
}

const positionOptions = () =>
  (['bottom', 'top', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as OverlayPosition[]).map((p) => (
    <option key={p} value={p}>
      {p.replace('-', ' ')}
    </option>
  ));

function positionClass(p: OverlayPosition): string {
  switch (p) {
    case 'top':
      return 'inset-x-0 top-0 text-center';
    case 'bottom':
      return 'inset-x-0 bottom-0 text-center';
    case 'top-left':
      return 'left-3 top-3';
    case 'top-right':
      return 'right-3 top-3';
    case 'bottom-left':
      return 'bottom-3 left-3';
    case 'bottom-right':
      return 'bottom-3 right-3';
    case 'center':
      return 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2';
  }
}

function normalizeHex(c: string): string {
  return c.startsWith('#') ? c.slice(0, 7) : '#000000';
}

// Display ticker text as a single line: a newline renders as two tabs of
// spacing so multi-line input still scrolls as one marquee.
function tickerText(text: string): string {
  return text.replace(/\n/g, '\t\t').replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');
}

// Estimate the marquee loop duration for the preview from the text width so it
// matches the viewer's behavior: longer text produces faster scroll speed.
function estimateTickDur(overlay: Overlay): number {
  const fs = Math.max(10, Math.min(40, overlay.fontSize));
  const width = (overlay.text.length || 12) * fs * 0.6;
  const base = Math.max(1, overlay.speed);
  const effSpeed = base * (1 + width / 2000);
  return Math.max(4, width / effSpeed);
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtRange = (s: string, e: string) =>
  new Date(s).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) +
  ' – ' +
  new Date(e).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Electronic Program Guide manager: schedule programs for the channel.
function ProgramGuide({ channelId }: { channelId: string }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Program | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    http
      .get<{ items: Program[] }>(`/admin/channels/${channelId}/programs`)
      .then((d) => setPrograms(d.items))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    if (channelId) load();
  }, [channelId]);

  const reset = () => {
    setEditing(null);
    setTitle('');
    setGenre('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setError(null);
  };

  const beginEdit = (p: Program) => {
    setEditing(p);
    setTitle(p.title);
    setGenre(p.genre ?? '');
    setDescription(p.description ?? '');
    setStartsAt(toLocalInput(p.startsAt));
    setEndsAt(toLocalInput(p.endsAt));
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!title.trim() || !startsAt || !endsAt) {
      setError('Title, start and end are required');
      return;
    }
    const body = {
      title: title.trim(),
      genre: genre.trim() || undefined,
      description: description.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    };
    try {
      if (editing) {
        await http.patch(`/admin/programs/${editing.id}`, body);
      } else {
        await http.post(`/admin/channels/${channelId}/programs`, body);
      }
      reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save program');
    }
  };

  const remove = async (p: Program) => {
    if (!window.confirm(`Delete program "${p.title}"?`)) return;
    await http.del(`/admin/programs/${p.id}`);
    await load();
  };

  const input =
    'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm placeholder-zinc-600';
  const label = 'mb-1 block text-xs font-medium text-zinc-400';

  return (
    <div className="rounded-xl bg-zinc-900 p-4">
      <h2 className="mb-3 font-semibold">Program guide (EPG)</h2>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div>
          <span className={label}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Show / program" className={input} />
        </div>
        <div>
          <span className={label}>Genre</span>
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g. News" className={input} />
        </div>
        <div className="col-span-2">
          <span className={label}>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className={input} />
        </div>
        <div>
          <span className={label}>Starts</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={input} />
        </div>
        <div>
          <span className={label}>Ends</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={input} />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <button
          onClick={submit}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {editing ? 'Update program' : 'Add program'}
        </button>
        {editing && (
          <button onClick={reset} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600">
            Cancel
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : programs.length === 0 ? (
        <p className="text-sm text-zinc-500">No programs scheduled yet.</p>
      ) : (
        <ul className="space-y-2">
          {programs.map((p) => (
            <li key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-zinc-400">{fmtRange(p.startsAt, p.endsAt)}</div>
                  {p.genre && (
                    <span className="mt-1 inline-block rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                      {p.genre}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => beginEdit(p)} className="text-xs text-brand-400 hover:text-brand-300">
                    Edit
                  </button>
                  <button onClick={() => remove(p)} className="text-xs text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-black/40 px-2 py-1 text-xs text-zinc-300">{value}</code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}