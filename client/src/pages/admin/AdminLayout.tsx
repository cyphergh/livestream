import { Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const nav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/cms', label: 'CMS', end: false },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" replace />;
  if (!(user.role === 'ADMIN' || user.role === 'PRODUCER'))
    return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-4">
          <h1 className="text-lg font-bold">Studio</h1>
          <p className="text-xs text-zinc-500">Admin portal</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-800 p-3">
          <div className="mb-2 flex items-center gap-2 px-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold">
              {user.name.charAt(0)}
            </span>
            <div className="text-sm">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-zinc-500">{user.role}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full rounded px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}