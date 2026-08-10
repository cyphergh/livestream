import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Hls from 'hls.js';
import type { MediaAsset } from '../../types';
import { useContentStore } from '../../stores/contentStore';

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// HLS VOD player used in the sermon lightbox.
function VodPlayer({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset.status !== 'READY') return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(asset.url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = asset.url;
    }
  }, [asset]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video bg-black">
          {asset.status === 'READY' ? (
            <video ref={videoRef} controls autoPlay playsInline className="h-full w-full" poster={asset.posterUrl ?? undefined} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              {asset.status === 'PROCESSING' ? 'Still processing…' : 'This video failed to process.'}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <h3 className="truncate font-display font-semibold text-zinc-900">{asset.name}</h3>
            {asset.description && <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">{asset.description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MediaCard({ asset, index, onPlay }: { asset: MediaAsset; index: number; onPlay: (a: MediaAsset) => void }) {
  return (
    <motion.button
      type="button"
      onClick={() => onPlay(asset)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="group relative block w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition hover:-translate-y-1.5 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-600/10"
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-100">
        {asset.posterUrl ? (
          <img src={asset.posterUrl} alt={asset.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-100 via-white to-red-50">
            <span className="text-5xl text-blue-300">▶</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {asset.duration != null && asset.duration > 0 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {fmtDuration(asset.duration)}
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/20 text-xl text-white backdrop-blur ring-1 ring-white/40">
            ▶
          </span>
        </span>
      </div>
      <div className="p-4">
        <h3 className="truncate font-display text-sm font-semibold text-zinc-900">{asset.name}</h3>
        {asset.description && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{asset.description}</p>}
        <p className="mt-2 text-[11px] text-zinc-500">
          {asset.status === 'READY' ? 'Ready to watch' : asset.status === 'PROCESSING' ? 'Processing…' : 'Failed'}
        </p>
      </div>
    </motion.button>
  );
}

function ImageLightbox({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={asset.posterUrl ?? asset.url}
          alt={asset.name}
          className="max-h-[70vh] w-full object-contain bg-zinc-100"
        />
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <h3 className="truncate font-display font-semibold text-zinc-900">{asset.name}</h3>
            {asset.description && <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">{asset.description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MediaSection() {
  const media = useContentStore((s) => s.media);
  const loaded = useContentStore((s) => s.loaded);
  const videos = media.filter((m) => m.type === 'VIDEO');
  const images = media.filter((m) => m.type === 'IMAGE').slice(0, 6);
  const [playing, setPlaying] = useState<MediaAsset | null>(null);
  const [viewing, setViewing] = useState<MediaAsset | null>(null);

  return (
    <section id="media" className="relative py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.07),transparent_50%)]"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">On demand</p>
          <h2 className="font-display mt-3 text-3xl font-bold text-zinc-900 sm:text-4xl">Sermons & media</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500">
            Missed a service? Catch up on the messages and moments shared with our church family.
          </p>
        </div>

        {loaded && videos.length === 0 && images.length === 0 ? (
          <div className="glass mx-auto max-w-lg rounded-3xl p-10 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-red-500 text-xl">
              ✦
            </div>
            <h3 className="font-display font-semibold text-zinc-900">Media library coming soon</h3>
            <p className="mt-1 text-sm text-zinc-500">Published sermons and images will appear here.</p>
          </div>
        ) : (
          <>
            {videos.length > 0 && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((v, i) => (
                  <MediaCard key={v.id} asset={v} index={i} onPlay={(a) => setPlaying(a)} />
                ))}
              </div>
            )}

            {images.length > 0 && (
              <div className="mt-16">
                <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Community moments</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {images.map((img, i) => (
                    <motion.button
                      key={img.id}
                      type="button"
                      onClick={() => setViewing(img)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.45, delay: i * 0.05 }}
                      className="group relative block aspect-square overflow-hidden rounded-xl border border-zinc-200 text-left"
                    >
                      <img
                        src={img.posterUrl ?? img.url}
                        alt={img.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition group-hover:opacity-100" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {playing && <VodPlayer asset={playing} onClose={() => setPlaying(null)} />}
        {viewing && <ImageLightbox asset={viewing} onClose={() => setViewing(null)} />}
      </AnimatePresence>
    </section>
  );
}