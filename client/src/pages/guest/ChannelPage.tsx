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
  const [muted, setMuted] = useState(true);

  // Browsers block autoplay with sound: start muted, then unmute on demand.
  // Tapping the video matches the button's behaviour but also fullscreens.
  const handleTap = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    video.play().catch(() => {});
    containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  // Dedicated "unmute" action (top-left button / centre cue) — no fullscreen.
  const unmuteAudio = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    video.play().catch(() => {});
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
        console.warn('[tv] no HLS url for channel, not streaming');
        return;
      }
      setMode('hls');
      if (Hls.isSupported()) {
        hls = new Hls({
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 1500,
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 1000,
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) console.log('[tv] HLS manifest parsed');
        });
        // MediaMTX's HLS muxer only becomes ready once a reader connects, so the
        // first manifest load can 404. hls.js treats network fatals as fatal by
        // default — keep retrying (bounded) instead of going blank.
        let hlsRetries = 0;
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal || cancelled) return;
          console.warn('[tv] HLS fatal', data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && hls && hlsRetries < 8) {
            hlsRetries++;
            // Back off a moment so the muxer/segments exist before reloading.
            setTimeout(() => hls?.startLoad(), 1200);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hls) {
            hls.recoverMediaError();
          }
        });
        hls.loadSource(channel.hls);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = channel.hls;
      }
      video.play().catch(() => {});
    };

    const fallbackToHls = () => {
      if (cancelled || fallback) return;
      fallback = true;
      whepCleanup?.close();
      console.warn('[tv] low-latency unavailable, switching to HLS');
      startHls();
    };

    if (channel.whep) {
      attachWhep(video, channel.whep, (s) => {
        console.log('[tv] whep:', s);
        if (s === 'connected') {
          setMode('whep');
          // Safety net: WebRTC can report 'connected' without actually
          // delivering frames. Watch for a real frame; fall back to HLS if a
          // video track never appears or no frame arrives within 4s.
          const connectedAt = Date.now();
          let firstFrameAt: number | null = null;
          const tick = () => {
            video.requestVideoFrameCallback(tick);
            if (firstFrameAt === null) firstFrameAt = Date.now();
          };
          video.requestVideoFrameCallback(tick);

          const watchdog = setInterval(() => {
            if (cancelled || fallback) {
              clearInterval(watchdog);
              return;
            }
            const hasVideo = (video.srcObject as MediaStream | null)?.getVideoTracks().length ?? 0;
            if (hasVideo === 0) {
              clearInterval(watchdog);
              console.warn('[tv] whep connected but no video track, switching to HLS');
              fallbackToHls();
            } else if (firstFrameAt !== null) {
              clearInterval(watchdog);
              video.play().catch(() => {});
            } else if (Date.now() - connectedAt > 4000) {
              clearInterval(watchdog);
              console.warn('[tv] whep connected but no frames, switching to HLS');
              fallbackToHls();
            }
          }, 500);
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
      console.warn('[tv] no video url for channel, not streaming');
    }

    return () => {
      cancelled = true;
      whepCleanup?.close();
      hls?.destroy();
    };
  }, [channel]);

  const hasStream = mode === 'whep' || mode === 'hls';

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        playsInline
        onClick={handleTap}
        className="h-full w-full"
      />
      {muted && hasStream && (
        <button
          type="button"
          onClick={unmuteAudio}
          className="absolute left-3 top-3 flex items-center gap-3 rounded-full bg-zinc-950/80 px-5 py-3 text-white shadow-lg ring-1 ring-white/25 backdrop-blur transition hover:bg-zinc-900"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl">
            🔇
          </span>
          <span className="text-base font-bold">Unmute</span>
        </button>
      )}
      {muted && hasStream && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center">
          <div className="rounded-2xl bg-zinc-950/70 px-6 py-4 text-center text-white shadow-xl ring-1 ring-white/10 backdrop-blur">
            <div className="mb-1 text-2xl">🔇</div>
            <p className="text-sm">
              Tap the <span className="font-semibold">Unmute</span> button at the{' '}
              <span className="font-semibold">top-left</span> to enable sound
            </p>
          </div>
        </div>
      )}
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

// Scrolling marquee. The animation duration is derived from the text width so
// the perceived speed scales with the amount of text: longer ticker text
// scrolls faster, short text crawls gently — the admin's px/s value is a base.
function TickerMarquee({ overlay }: { overlay: Overlay }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dur, setDur] = useState(20);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const width = track.offsetWidth / 2; // two copies, half is one text pass
    const base = Math.max(1, overlay.speed);
    // Speed grows with how much text is on screen: longer = faster.
    const effSpeed = base * (1 + width / 2000);
    setDur(Math.max(4, width / effSpeed));
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
        <span
          className="whitespace-pre px-6 font-semibold"
          style={{ backgroundColor: 'transparent', color: overlay.color }}
        >
          {tickerText(overlay.text)}
        </span>
        <span
          className="whitespace-pre px-6 font-semibold"
          style={{ backgroundColor: 'transparent', color: overlay.color }}
        >
          {tickerText(overlay.text)}
        </span>
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

// Display ticker text as a single line: a newline renders as two tabs of
// spacing so multi-line input still scrolls as one marquee.
function tickerText(text: string): string {
  return text.replace(/\n/g, '\t\t').replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');
}

// Program guide side panel shown beside the media player. Lists today's
// schedule (falling back to the next upcoming programs) and is independently
// scrollable so viewers can browse without leaving the player.
function ProgramSidebar({ channel }: { channel: Channel }) {
  const livePrograms = useLiveStore((s) => s.programs);
  const programs = (livePrograms[channel.id] ?? channel.programs) ?? [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  const todays = programs.filter((p) => {
    const s = new Date(p.startsAt);
    return s >= startOfToday && s < endOfToday;
  });
  const list = todays.length > 0 ? todays : programs;

  const fmtTime = (s: string, e: string) =>
    new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' – ' +
    new Date(e).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex max-h-[80vh] flex-col rounded-xl border border-zinc-800 bg-zinc-900 lg:sticky lg:top-6">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="font-semibold">Program guide</h2>
        <span className="text-xs text-zinc-500">{todays.length > 0 ? 'Today' : 'Coming up'}</span>
      </div>
      <div className="overflow-y-auto p-3">
        {list.length === 0 ? (
          <p className="px-1 text-sm text-zinc-500">No programs scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => (
              <li key={p.id} className="rounded-lg bg-zinc-800/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{p.title}</span>
                  <span className="shrink-0 text-[11px] text-zinc-400">{fmtTime(p.startsAt, p.endsAt)}</span>
                </div>
                {p.genre && (
                  <span className="mt-1 inline-block rounded bg-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-300">
                    {p.genre}
                  </span>
                )}
                {p.description && <p className="mt-1 text-xs text-zinc-500">{p.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
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

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-500">Loading…</div>;
  if (error || !channel)
    return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-500">{error ?? 'Not found'}</div>;

  return (
    <ChannelPageContent channel={channel} overlays={overlays} playerRef={playerRef} />
  );
}

function ChannelPageContent({
  channel,
  overlays,
  playerRef,
}: {
  channel: Channel;
  overlays: Record<string, Overlay>;
  playerRef: RefObject<HTMLDivElement | null>;
}) {
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
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/" className="inline-block text-sm text-brand-600">
          ← All channels
        </Link>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${
            channel.live
              ? 'bg-red-600 text-white'
              : 'bg-zinc-200 text-zinc-600'
          }`}
        >
          {channel.live ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-900">{channel.name}</h1>
        {channel.description && <p className="mt-1 text-zinc-500">{channel.description}</p>}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
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
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              {channel.hls ? (
                <audio controls autoPlay src={channel.hls} className="w-full" />
              ) : (
                <p className="text-zinc-500">Radio offline</p>
              )}
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 lg:w-96">
          <ProgramSidebar channel={channel} />
        </aside>
      </div>
    </div>
  );
}