import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, Link } from 'react-router-dom';
import { http } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { startWhip, type WhipSession } from '../../lib/whip';
import type { Channel, Ticker } from '../../types';

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
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [tickerLoading, setTickerLoading] = useState(false);

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

  // Load the saved ticker config for this channel.
  useEffect(() => {
    if (!channel) return;
    setTickerLoading(true);
    http
      .get<{ ticker: Ticker | null }>(`/admin/channels/${channel.id}/ticker`)
      .then((d) => setTicker(d.ticker))
      .catch(() => {})
      .finally(() => setTickerLoading(false));
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

  // Persist ticker settings; the server broadcasts the new config over the
  // WebSocket so viewers see the change immediately, no reload needed.
  async function saveTicker(next: Ticker) {
    if (!channel) return;
    setTicker(next);
    await http
      .put<{ ticker: Ticker }>(`/admin/channels/${channel.id}/ticker`, next)
      .then((d) => setTicker(d.ticker))
      .catch(() => {});
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
          <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-black">
            <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          </div>
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
            <h2 className="mb-3 font-semibold">Scrolling ticker</h2>
            {tickerLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : ticker ? (
              <TickerSettings ticker={ticker} onSave={saveTicker} />
            ) : (
              <p className="text-sm text-zinc-500">No ticker configured.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function TickerSettings({
  ticker,
  onSave,
}: {
  ticker: Ticker;
  onSave: (next: Ticker) => void;
}) {
  const [draft, setDraft] = useState<Ticker>(ticker);
  const [savedAt, setSavedAt] = useState<number>(0);

  useEffect(() => setDraft(ticker), [ticker]);

  const set = (patch: Partial<Ticker>) => setDraft((d) => ({ ...d, ...patch }));

  // Save on every change — debounced slightly so slider drags don't spam.
  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(ticker)) return;
    const id = setTimeout(() => {
      onSave(draft);
      setSavedAt(Date.now());
    }, 400);
    return () => clearTimeout(id);
  }, [draft, ticker, onSave]);

  const label = 'text-xs font-medium text-zinc-400';
  const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm';
  const row = 'flex flex-col gap-1';

  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="h-4 w-4 accent-brand-600"
        />
        <span className={label}>Show ticker on the channel</span>
      </label>

      <label className={row}>
        <span className={label}>Ticker text</span>
        <textarea
          value={draft.text}
          onChange={(e) => set({ text: e.target.value })}
          rows={2}
          className={input}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={row}>
          <span className={label}>Position</span>
          <select
            value={draft.position}
            onChange={(e) => set({ position: e.target.value as Ticker['position'] })}
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
        <label className={row}>
          <span className={label}>Font size</span>
          <input
            type="number"
            min={8}
            max={120}
            value={draft.fontSize}
            onChange={(e) => set({ fontSize: Number(e.target.value) })}
            className={input}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className={row}>
          <span className={label}>Text color</span>
          <input
            type="color"
            value={draft.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800"
          />
        </label>
        <label className={row}>
          <span className={label}>Bar background</span>
          <input
            type="color"
            value={draft.bgColor.startsWith('#') ? draft.bgColor : '#000000'}
            onChange={(e) => set({ bgColor: e.target.value + '8c' })}
            className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800"
          />
        </label>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
        <TickerPreview ticker={draft} />
      </div>

      {savedAt > 0 && <p className="text-xs text-emerald-500">Saved</p>}
    </div>
  );
}

function TickerPreview({ ticker }: { ticker: Ticker }) {
  const style: CSSProperties = {
    fontSize: `${Math.max(10, Math.min(40, ticker.fontSize))}px`,
    color: ticker.color,
    backgroundColor: ticker.bgColor,
    opacity: ticker.opacity,
  };
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 overflow-hidden py-1.5 ${
        ticker.position === 'top' ? 'top-0' : 'bottom-0'
      }`}
      style={style}
    >
      <div className="inline-flex whitespace-nowrap" style={{ animation: `marquee 12s linear infinite` }}>
        <span className="px-6 font-semibold">{ticker.text || 'Ticker preview'}</span>
        <span className="px-6 font-semibold">{ticker.text || 'Ticker preview'}</span>
      </div>
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