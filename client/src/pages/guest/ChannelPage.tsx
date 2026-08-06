import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useParams, Link } from 'react-router-dom';
import Hls from 'hls.js';
import { http } from '../../lib/api';
import { attachWhep } from '../../lib/whep';
import { useLiveStore } from '../../stores/liveStore';
import type { Channel, Overlay, OverlayPosition } from '../../types';

function TvPlayer({ channel, containerRef }: { channel: Channel; containerRef: RefObject<HTMLDivElement | null> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<'whep' | 'hls' | 'idle'>('idle');
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  // Browsers block autoplay with sound: start muted, then unmute on first tap.
  // The tap is a user gesture, so we can also request fullscreen right then.
  const handleTap = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    video.play().catch(() => {});
    containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;
    let fallback = false;
    let whepCleanup: { close: () => void } | null = null;
    let hls: Hls | null = null;
    const video = videoRef.current;
    if (!video) return;

    const startHls = () => {
      if (!channel.hls) {
        setStatus('Not streaming');
        return;
      }
      setMode('hls');
      setStatus('Buffering…');
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(channel.hls);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = channel.hls;
      }
      video.play().catch(() => {});
    };

    // Fall back to HLS when WHEP fails to establish media.
    const fallbackToHls = () => {
      if (cancelled || fallback) return;
      fallback = true;
      whepCleanup?.close();
      setError('Low-latency unavailable, switching to HLS…');
      startHls();
    };

    if (channel.whep) {
      attachWhep(video, channel.whep, (s) => {
        setStatus(s);
        if (s === 'connected') {
          setMode('whep');
          // Safety net: WebRTC may be 'connected' before/without a video track.
          // If no video track arrives shortly, fall back to HLS so the viewer
          // always sees something.
          setTimeout(() => {
            if (cancelled || fallback) return;
            const hasVideo = (video.srcObject as MediaStream | null)?.getVideoTracks().length ?? 0;
            if (hasVideo > 0) {
              video.play().catch(() => {});
            } else {
              fallbackToHls();
            }
          }, 2500);
        }
        if (s === 'failed') fallbackToHls();
      })
        .then((cleanup) => {
          whepCleanup = cleanup;
          if (cancelled) cleanup.close();
          else if (fallback) cleanup.close();
        })
        .catch(() => {
          if (!cancelled) fallbackToHls();
        });
    } else if (channel.hls) {
      startHls();
    } else {
      setStatus('Not streaming');
    }

    return () => {
      cancelled = true;
      whepCleanup?.close();
      hls?.destroy();
    };
  }, [channel]);

  return (
    <>
      <video
        ref={videoRef}
        controls
        autoPlay
        muted={muted}
        playsInline
        onClick={handleTap}
        className="h-full w-full"
      />
      {muted && (
        <button
          type="button"
          onClick={handleTap}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40"
        >
          <span className="rounded-full bg-zinc-900/80 px-4 py-2 text-sm text-white">
            Tap for sound
          </span>
        </button>
      )}
      {status && (
        <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          {mode === 'whep' ? 'LIVE (WebRTC)' : status}
        </div>
      )}
      {error && <div className="absolute left-2 top-9 text-xs text-yellow-300">{error}</div>}
      {!channel.live && <Overlay text="Not currently streaming" />}
    </>
  );
}

function Overlay({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-zinc-300">
      {text}
    </div>
  );
}

// On-screen overlay rendered over the video for viewers: the channel logo on
// the top-right (also visible in fullscreen) plus the admin-configured overlay
// (scrolling ticker / static image / static text). Re-renders live whenever an
// admin saves new settings (pushed over the WebSocket).
function OverlayLayer({ overlay, logo }: { overlay: Overlay | null; logo: string | null }) {
  if (!overlay) return null;
  const pos = positionClass(overlay.position);

  return (
    <>
      {overlay.logoVisible && logo && (
        <img
          src={logo}
          alt="channel logo"
          className="pointer-events-none absolute right-3 top-3 object-contain"
          style={{ height: '9%', width: 'auto' }}
        />
      )}

      {overlay.mode === 'ticker' && (
        <TickerMarquee overlay={overlay} />
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
            fontSize: `${overlay.fontSize}px`,
            color: overlay.color,
            backgroundColor: overlay.bgColor,
            borderRadius: overlay.borderRadius,
            opacity: overlay.opacity,
          }}
        >
          {overlay.text}
        </div>
      )}
    </>
  );
}

// Scrolling marquee, speed computed from the admin-configured px/s value.
function TickerMarquee({ overlay }: { overlay: Overlay }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dur, setDur] = useState(20);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const width = track.offsetWidth / 2; // two copies, half is one text pass
    setDur(Math.max(4, width / Math.max(1, overlay.speed)));
  }, [overlay.text, overlay.fontSize, overlay.speed]);

  const style: CSSProperties = {
    fontSize: `${overlay.fontSize}px`,
    color: overlay.color,
    backgroundColor: overlay.bgColor,
    opacity: overlay.opacity,
  };

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 overflow-hidden py-1.5 ${
        overlay.position === 'top' ? 'top-0' : 'bottom-0'
      }`}
      style={style}
    >
      <div
        ref={trackRef}
        className="inline-flex whitespace-nowrap will-change-transform"
        style={{ animation: `marquee ${dur}s linear infinite` }}
      >
        <span className="px-6 font-semibold">{overlay.text}</span>
        <span className="px-6 font-semibold">{overlay.text}</span>
      </div>
    </div>
  );
}

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

export default function ChannelPage() {
  const { slug } = useParams();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const liveMap = useLiveStore((s) => s.live);
  const overlays = useLiveStore((s) => s.overlays);
  const connect = useLiveStore((s) => s.connect);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect();
    http
      .get<Channel>(`/channels/${slug}`)
      .then(setChannel)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, connect]);

  // When the WebSocket reports a live-status flip, re-fetch the channel so the
  // player picks up (or drops) its whep/hls URLs without a manual reload.
  useEffect(() => {
    if (!channel) return;
    const known = liveMap[channel.id];
    if (known !== undefined && known !== channel.live) {
      http.get<Channel>(`/channels/${slug}`).then(setChannel).catch(() => {});
    }
  }, [channel, liveMap, slug]);

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-400">Loading…</div>;
  if (error || !channel)
    return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-400">{error ?? 'Not found'}</div>;

  // Real-time overlay: prefer the live-WebSocket copy so admin edits apply
  // instantly, falling back to the value baked into the channel fetch.
  const overlay = overlays[channel.id] ?? channel.overlay ?? null;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      playerRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

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
        <div ref={playerRef} className="relative aspect-video overflow-hidden rounded-xl bg-black">
          <TvPlayer channel={channel} containerRef={playerRef} />
          <OverlayLayer overlay={overlay} logo={channel.logoUrl ?? null} />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute bottom-3 left-3 z-10 rounded bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
          >
            {document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
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