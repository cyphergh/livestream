import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useContentStore } from '../../stores/contentStore';

export default function About() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-12%', '12%']);

  const { content } = useContentStore();
  const heading = content['about.heading'] ?? 'Our mission';
  const body = content['about.body'] ?? '';
  const imageUrl = content['about.imageUrl'];

  return (
    <section ref={ref} className="relative overflow-hidden py-24">
      {/* Parallax background image */}
      <motion.div
        aria-hidden
        style={{ y }}
        className="absolute inset-0 -z-10 scale-125"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover opacity-25" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_70%_30%,rgba(192,132,252,0.18),transparent_50%),radial-gradient(circle_at_20%_80%,rgba(34,211,238,0.14),transparent_50%)]" />
        )}
        <div className="absolute inset-0 bg-zinc-950/60" />
      </motion.div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-8">
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Who we are</p>
          <h2 className="font-display mt-3 text-3xl font-bold text-white sm:text-4xl">{heading}</h2>
          <p className="mt-5 max-w-xl leading-relaxed text-zinc-300">{body}</p>

          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { k: 'Faith', v: 'Grounded in the Word' },
              { k: 'Family', v: 'A home for everyone' },
              { k: 'Service', v: 'Loving our city' },
            ].map((s) => (
              <div key={s.k} className="glass rounded-2xl p-4 text-center">
                <div className="font-display text-sm font-bold text-gradient-static">{s.k}</div>
                <div className="mt-1 text-[11px] leading-snug text-zinc-400">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="gradient-border relative overflow-hidden rounded-3xl">
            <div className="relative aspect-[4/3] bg-gradient-to-br from-indigo-950 via-zinc-900 to-cyan-950">
              {imageUrl ? (
                <img src={imageUrl} alt="Our church family" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display text-7xl text-indigo-300/30">✝</span>
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>

          {/* Floating chip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="glass absolute -bottom-5 left-6 right-6 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl shadow-black/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 text-lg text-white">
              ✦
            </span>
            <div className="text-sm">
              <div className="font-semibold text-white">Everyone is welcome</div>
              <div className="text-xs text-zinc-400">No perfect people needed — just come as you are.</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}