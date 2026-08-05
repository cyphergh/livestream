import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Hls from 'hls.js';
import { http } from '../../lib/api';
import type { Channel } from '../../types';

function HlsPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ liveSyncDurationCount: 3 });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    video.src = src;
  }, [src]);

  return <video ref={videoRef} controls autoPlay muted playsInline className="h-full w-full" />;
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
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {channel.hls ? (
            <HlsPlayer src={channel.hls} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-600">
              Not currently streaming
            </div>
          )}
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