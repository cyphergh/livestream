import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Channel } from '../../types';
import { useContentStore } from '../../stores/contentStore';
import { useChannelsStore } from '../../stores/channelsStore';
import { useLiveStore } from '../../stores/liveStore';

function ChannelCard({ channel, live, index }: { channel: Channel; live: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/channel/${channel.slug}`}
        className={`group relative block overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-600/10 ${
          live ? 'gradient-border shadow-xl shadow-blue-600/10' : ''
        }`}
      >
        <div className="relative aspect-video overflow-hidden bg-zinc-100">
          {channel.coverUrl ? (
            <img
              src={channel.coverUrl}
              alt={channel.name}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-100 via-white to-red-50">
              <span className="font-display text-6xl font-bold text-blue-300">
                {channel.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />

          {channel.logoUrl && (
            <img
              src={channel.logoUrl}
              alt={`${channel.name} logo`}
              className="absolute left-3 top-3 h-9 w-9 rounded-lg object-cover ring-2 ring-white/20"
            />
          )}

          <span
            className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur ${
              live ? 'bg-red-500/90 text-white shadow-lg shadow-red-500/40' : 'bg-white/80 text-zinc-600 ring-1 ring-zinc-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-white' : 'bg-zinc-500'}`} />
            {live ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-semibold text-zinc-900">{channel.name}</h3>
              <p className="text-xs uppercase tracking-wider text-indigo-300/70">
                {channel.type === 'RADIO' ? 'Radio' : 'TV'}
              </p>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200 transition group-hover:bg-blue-600 group-hover:text-white">
              →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function LiveNow() {
  const channels = useChannelsStore((s) => s.channels);
  const loading = useChannelsStore((s) => s.loading);
  const liveMap = useLiveStore((s) => s.live);
  const churchName = useContentStore((s) => s.content['site.name']);

  const withLive = channels.map((c) => ({ ...c, live: liveMap[c.id] ?? c.live }));
  const live = withLive.filter((c) => c.live);
  const offline = withLive.filter((c) => !c.live);

  return (
    <section id="live" className="relative py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.07),transparent_55%)]"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Worship from anywhere</p>
            <h2 className="font-display mt-2 text-3xl font-bold text-zinc-900 sm:text-4xl">Stream live with {churchName}</h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Tune into our services and channels whenever they go live — right here, in real time.
            </p>
          </div>
          {live.length > 0 && !loading && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {live.length} {live.length === 1 ? 'channel' : 'channels'} live now
            </span>
          )}
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[16/12] animate-pulse rounded-2xl bg-zinc-200" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-red-500 text-2xl">
              ✦
            </div>
            <h3 className="font-display text-lg font-semibold text-zinc-900">No channels on air right now</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Our broadcasters haven't gone live yet. Check the program guide or tune in soon.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link to="/epg" className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50">
                View program guide
              </Link>
            </div>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">On air now</h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {live.map((c, i) => (
                    <ChannelCard key={c.id} channel={c} live index={i} />
                  ))}
                </div>
              </div>
            )}
            {offline.length > 0 && (
              <div>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">All channels</h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {offline.map((c, i) => (
                    <ChannelCard key={c.id} channel={c} live={false} index={i} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}