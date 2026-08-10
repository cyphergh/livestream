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
    <footer className="relative mt-10 border-t border-zinc-200 bg-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-red-500 text-lg font-bold text-white">
                ✦
              </span>
              <span className="font-display text-lg font-semibold text-zinc-900">{churchName}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-zinc-500">{footerText}</p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Explore</h4>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li><a href="#live" className="transition hover:text-blue-700">Watch live</a></li>
              <li><a href="#media" className="transition hover:text-blue-700">Sermons & media</a></li>
              <li><a href="#contact" className="transition hover:text-blue-700">Contact us</a></li>
              <li><Link to="/radio" className="transition hover:text-blue-700">Radio</Link></li>
              <li><Link to="/epg" className="transition hover:text-blue-700">Program guide</Link></li>
              <li><Link to="/login" className="transition hover:text-blue-700">Sign in</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Stay connected</h4>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} className="transition hover:text-blue-700">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} {churchName}. Walking in faith, gathering in love.
        </div>
      </div>
    </footer>
  );
}