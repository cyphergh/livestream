import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { http } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { startWhip, type WhipSession } from '../../lib/whip';
import type { Channel } from '../../types';

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
        </section>
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