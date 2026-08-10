import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useContentStore } from '../../stores/contentStore';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/#live', label: 'Watch live' },
  { to: '/#media', label: 'Sermons' },
  { to: '/#visit', label: 'Visit us' },
  { to: '/#contact', label: 'Contact' },
  { to: '/radio', label: 'Radio' },
  { to: '/epg', label: 'Program guide' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();
  const churchName = useContentStore((s) => s.content['site.name']);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isStaff = user && (user.role === 'ADMIN' || user.role === 'PRODUCER');

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass border-x-0 border-t-0 border-b border-zinc-200 bg-white/80 shadow-lg shadow-zinc-200/60'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3.5 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-red-500 text-lg font-bold text-white shadow-lg shadow-blue-600/30 transition group-hover:shadow-blue-500/50">
            ✦
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-zinc-900">{churchName}</span>
        </Link>

        <div className="ml-auto hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.to}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-blue-700"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {isStaff ? (
            <Link
              to="/admin"
              className="rounded-xl bg-gradient-to-r from-blue-600 via-brand-600 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110"
            >
              Dashboard
            </Link>
          ) : user ? (
            <span className="hidden text-sm font-medium text-zinc-500 lg:block">{user.name}</span>
          ) : (
            <Link
              to="/login"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              Sign in
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-700 lg:hidden"
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mx-4 mb-3 rounded-2xl p-3 lg:hidden"
        >
          {links.map((l) => (
            <a
              key={l.label}
              href={l.to}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {l.label}
            </a>
          ))}
        </motion.div>
      )}
    </header>
  );
}