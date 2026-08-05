import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Hls from 'hls.js';
import { http } from '../../lib/api';
import { attachWhep } from '../../lib/whep';
import type { Channel } from '../../types';

function TvPlayer({ channel }: { channel: Channel }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<'whep' | 'hls' | 'idle'>('idle');
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let whepCleanup: { close: () => void } | null = null;
    const video = videoRef.current;
    if (!video) return;

    if (channel.whep) {
      attachWhep(video, channel.whep, (s) => {
        setStatus(s);
        if (s === 'connected') setMode('whep');
      })
        .then((cleanup) => {
          whepCleanup = cleanup;
          if (cancelled) cleanup.close();
        })
        .catch(() => {
          if (!cancelled) {
            setError('Low-latency unavailable, switching to HLS…');
            setMode('hls');
          }
        });
    } else if (channel.hls) {
      setMode('hls');
    } else {
      setStatus('Not streaming');
    }

    return () => {
      cancelled = true;
      whepCleanup?.close();
    };
  }, [channel]);

  return (
    <>
      <video ref={videoRef} controls autoPlay muted playsInline className="h-full w-full" />
      {mode === 'hls' && channel.hls && <HlsBackfill src={channel.hls} />}
      {status && (
        <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          {mode === 'whep' ? 'LIVE (WebRTC)' : status}
        </div>
      )}
      {error && <div className="absolute left-2 top-2 text-xs text-yellow-300">{error}</div>}
      {!channel.live && <Overlay text="Not currently streaming" />}
    </>
  );
}

function HlsBackfill({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    video.src = src;
  }, [src]);
  return (
    <div className="pointer-events-none absolute inset-0">
      <video ref={ref} autoPlay muted playsInline className="h-full w-full opacity-0" />
    </div>
  );
}

function Overlay({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-zinc-300">
      {text}
    </div>
  );
}

export default function ChannelPage() {
  const { slug } = useParams();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    http
      .get<Channel>(`/channels/${slug}`)
      .then(setChannel)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-400">Loading…</div>;
  if (error || !channel)
    return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-400">{error ?? 'Not found'}</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600">
        ← All channels
      </Link>
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold">{channel.name}</h1>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${
            channel.live ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300'
          }`}
        >
          {channel.live ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      {channel.type === 'TV' ? (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          <TvPlayer channel={channel} />
        </div>
      ) : (
        <div className="rounded-xl bg-zinc-900 p-6">
          {channel.hls ? (
            <audio controls autoPlay src={channel.hls} className="w-full" />
          ) : (
            <p className="text-zinc-500">Radio offline</p>
          )}
        </div>
      )}

      {channel.description && <p className="mt-6 text-zinc-300">{channel.description}</p>}

      {channel.programs && channel.programs.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Upcoming schedule</h2>
          <ul className="space-y-2">
            {channel.programs.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg bg-zinc-900 p-3 text-sm">
                <span className="text-zinc-500">
                  {new Date(p.startsAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="font-medium">{p.title}</span>
                {p.genre && <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{p.genre}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}