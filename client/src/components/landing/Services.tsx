import { motion } from 'framer-motion';
import { useContentStore } from '../../stores/contentStore';

export default function Services() {
  const content = useContentStore((s) => s.content);
  const announcement = content['announcement'];
  const services = content.services ?? [];

  return (
    <section id="visit" className="relative py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_50%,rgba(139,92,246,0.14),transparent_50%),radial-gradient(circle_at_85%_30%,rgba(34,211,238,0.1),transparent_45%)]"
      />

      {announcement && (
        <div className="mx-auto mb-14 max-w-3xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
          >
            <span className="shrink-0 text-xl">📣</span>
            <p className="text-sm font-medium text-amber-700">{announcement}</p>
          </motion.div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Plan your visit</p>
          <h2 className="font-display mt-3 text-3xl font-bold text-zinc-900 sm:text-4xl">Gather with us</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600">
            Whether online or in person, there's a service waiting for you this week.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {services.map((s, i) => (
            <motion.div
              key={`${s.day}-${s.time}`}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="group glass relative overflow-hidden rounded-3xl p-7 transition hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-600/10"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/15 blur-2xl transition group-hover:bg-blue-500/25" aria-hidden />
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-700">{s.day}</div>
              <div className="font-display mt-2 text-4xl font-bold text-zinc-900">{s.time}</div>
              <div className="mt-3 text-sm font-medium text-zinc-600">{s.name}</div>
              <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-brand-600">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                Live & in person
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}