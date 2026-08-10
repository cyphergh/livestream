import { Link } from 'react-router-dom';
import { useContentStore } from '../../stores/contentStore';

const socials = [
  { label: 'YouTube', href: '#' },
  { label: 'Facebook', href: '#' },
  { label: 'Instagram', href: '#' },
];

export default function Footer() {
  const churchName = useContentStore((s) => s.content['site.name']);
  const footerText = useContentStore((s) => s.content['footer.text']);

  return (
    <footer className="relative mt-10 border-t border-white/10 bg-zinc-950/60">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 text-lg font-bold text-white">
                ✦
              </span>
              <span className="font-display text-lg font-semibold text-white">{churchName}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-zinc-400">{footerText}</p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">Explore</h4>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li><a href="#live" className="transition hover:text-white">Watch live</a></li>
              <li><a href="#media" className="transition hover:text-white">Sermons & media</a></li>
              <li><Link to="/radio" className="transition hover:text-white">Radio</Link></li>
              <li><Link to="/epg" className="transition hover:text-white">Program guide</Link></li>
              <li><Link to="/login" className="transition hover:text-white">Sign in</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">Stay connected</h4>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} className="transition hover:text-white">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/5 pt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} {churchName}. Walking in faith, gathering in love.
        </div>
      </div>
    </footer>
  );
}