import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { useContentStore } from '../../stores/contentStore';
import { useChannelsStore } from '../../stores/channelsStore';
import { useLiveStore } from '../../stores/liveStore';

const verses = [
  { text: '“For where two or three gather in my name, there am I with them.”', ref: 'Matthew 18:20' },
  { text: '“The Lord is good to all; he has compassion on all he has made.”', ref: 'Psalm 145:9' },
  { text: '“Let the light of your face shine on us, Lord.”', ref: 'Psalm 4:6' },
  { text: '“For the Spirit God gave us does not make us timid.”', ref: '2 Timothy 1:7' },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 26, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const yMid = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  const content = useContentStore((s) => s.content);
  const channels = useChannelsStore((s) => s.channels);
  const liveMap = useLiveStore((s) => s.live);
  const [verseIdx, setVerseIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setVerseIdx((i) => (i + 1) % verses.length), 5200);
    return () => clearInterval(t);
  }, []);

  const liveChannels = channels.filter((c) => liveMap[c.id] ?? c.live);
  const liveChannel = liveChannels[0];

  return (
    <section ref={ref} className="noise relative flex min-h-screen items-center overflow-hidden">
      {/* Parallax background layers */}
      <motion.div
        style={{ y: yBg, scale }}
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,rgba(79,70,229,0.4)_0%,transparent_45%),radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.25)_0%,transparent_40%),radial-gradient(circle_at_60%_95%,rgba(139,92,246,0.35)_0%,transparent_50%)]"
      />

      {/* Animated gradient wash */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 animate-gradient bg-[linear-gradient(115deg,#120b2e,#1a1038_25%,#0d1b2e_50%,#1a1038_75%,#120b2e)] bg-[length:400%_400%] opacity-70"
      />

      {/* Cyber grid floor */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-72 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(129,140,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,0.5) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          transform: 'perspective(600px) rotateX(60deg) scale(2)',
          transformOrigin: 'bottom',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
        }}
      />

      {/* Floating orbs */}
      <div aria-hidden className="absolute left-[8%] top-[22%] -z-10 h-64 w-64 animate-float rounded-full bg-brand-600/30 blur-[90px]" />
      <div aria-hidden className="absolute right-[12%] top-[30%] -z-10 h-56 w-56 animate-float-slow rounded-full bg-cyan-400/20 blur-[80px]" />
      <div aria-hidden className="absolute bottom-[20%] left-[40%] -z-10 h-72 w-72 animate-pulse-glow rounded-full bg-fuchsia-500/20 blur-[100px]" />
      <div aria-hidden className="absolute right-[30%] top-[12%] -z-10 h-20 w-20 animate-spin-slow rounded-full border border-dashed border-indigo-300/30" />

      {/* Light beam */}
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-10 h-[130%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-indigo-300/30 to-transparent"
      />

      <motion.div
        style={{ y: yMid, opacity }}
        className="mx-auto w-full max-w-5xl px-6 pb-28 pt-32 text-center"
      >
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item} className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
              {liveChannels.length > 0 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Live now
                </>
              ) : (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                  You are invited
                </>
              )}
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="font-display mx-auto max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            <span className="text-gradient animate-shimmer">{content['site.name']}</span>
            <br />
            <span className="mt-2 block text-2xl font-medium text-zinc-200 sm:text-4xl">
              {content['hero.title']}
            </span>
          </motion.h1>

          <motion.p variants={item} className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-lg">
            {content['hero.tagline']}
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {liveChannel ? (
              <Link
                to={`/channel/${liveChannel.slug}`}
                className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-brand-600/30 transition hover:shadow-brand-500/50 hover:brightness-110"
              >
                <span className="flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                Watch live now
              </Link>
            ) : (
              <a
                href="#live"
                className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-brand-600/30 transition hover:shadow-brand-500/50 hover:brightness-110"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-white/80" />
                Watch live
              </a>
            )}
            <a
              href="#visit"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Plan a visit
            </a>
          </motion.div>

          <motion.div variants={item} className="mx-auto mt-14 h-16 max-w-xl">
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={verseIdx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.55 }}
                className="text-sm italic leading-relaxed text-zinc-400 sm:text-base"
              >
                {verses[verseIdx].text}
                <footer className="mt-1 text-xs not-italic tracking-wide text-indigo-300/70">
                  {verses[verseIdx].ref}
                </footer>
              </motion.blockquote>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.a
        href="#live"
        aria-label="Scroll down"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-zinc-500 transition hover:text-white"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </motion.a>
    </section>
  );
}