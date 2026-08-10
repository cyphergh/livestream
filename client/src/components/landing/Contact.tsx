import { motion } from 'framer-motion';
import { useContentStore } from '../../stores/contentStore';

export default function Contact() {
  const content = useContentStore((s) => s.content);
  const heading = content['contact.heading'] ?? 'Contact us & find us';
  const body = content['contact.body'] ?? '';
  const email = content['contact.email'] ?? '';
  const phone = content['contact.phone'] ?? '';
  const address = content['contact.address'] ?? '';
  const hours = content['contact.hours'] ?? '';
  const mapUrl = content['contact.mapUrl'] ?? '';

  const items = [
    { icon: '✉', label: 'Email us', value: email, href: email ? `mailto:${email}` : undefined },
    { icon: '☎', label: 'Call us', value: phone, href: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined },
    { icon: '⌂', label: 'Visit us', value: address },
    { icon: '◷', label: 'Hours', value: hours },
  ].filter((i) => i.value);

  return (
    <section id="contact" className="relative py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(37,99,235,0.08),transparent_50%),radial-gradient(circle_at_90%_75%,rgba(220,38,38,0.07),transparent_50%)]"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Reach out</p>
          <h2 className="font-display mt-3 text-3xl font-bold text-zinc-900 sm:text-4xl">{heading}</h2>
          {body && <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600">{body}</p>}
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1 lg:content-start">
            {items.map((it, i) => (
              <motion.div
                key={it.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-600/10"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-red-500 text-lg text-white shadow-md shadow-blue-600/20">
                  {it.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">{it.label}</div>
                  {it.href ? (
                    <a href={it.href} className="mt-0.5 block truncate text-sm font-semibold text-blue-700 hover:underline">
                      {it.value}
                    </a>
                  ) : (
                    <div className="mt-0.5 text-sm font-semibold text-zinc-800">{it.value}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-3"
          >
            <div className="gradient-border overflow-hidden rounded-3xl">
              {mapUrl ? (
                <iframe
                  title="Our location"
                  src={mapUrl}
                  className="h-full min-h-[340px] w-full border-0 lg:h-[420px]"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-[340px] flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 via-white to-red-50 px-6 text-center lg:h-[420px]">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-red-500 text-2xl text-white shadow-lg shadow-blue-600/20">
                    ⌂
                  </span>
                  <h3 className="font-display text-xl font-bold text-zinc-900">{address || 'Find us in person'}</h3>
                  <p className="max-w-sm text-sm text-zinc-600">
                    {hours || 'We would love to welcome you. Set the address above in the CMS to show a map here.'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}