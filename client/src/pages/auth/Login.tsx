import { useState, type FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function Login() {
  const { user, login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user)
    return (
      <Navigate
        to={user.role === 'ADMIN' || user.role === 'PRODUCER' ? '/admin' : '/'}
        replace
      />
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email, password);
      navigate(u.role === 'ADMIN' || u.role === 'PRODUCER' ? '/admin' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white ' +
    'placeholder-zinc-500 backdrop-blur transition focus:border-brand-500 focus:outline-none ' +
    'focus:ring-2 focus:ring-brand-500/40';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 text-zinc-100">
      {/* cinematic background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#4f46e5_0%,transparent_55%),radial-gradient(circle_at_bottom_right,#a855f7_0%,transparent_50%)]" />
        <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">📺</div>
          <h1 className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-3xl font-bold text-transparent">
            LiveStream
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Sign in to your station</p>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={input}
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={input}
            />

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-400">
            New here?{' '}
            <Link to="/register" className="font-medium text-brand-400 hover:text-brand-300">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}