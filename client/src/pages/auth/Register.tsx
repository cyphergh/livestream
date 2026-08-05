import { useState, type FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function Register() {
  const { user, register } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(email, name, password);
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 focus:border-brand-600 focus:outline-none"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 focus:border-brand-600 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 chars)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 focus:border-brand-600 focus:outline-none"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold hover:bg-brand-700"
        >
          Create account
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-400">
        Have an account? <Link to="/login" className="text-brand-600">Sign in</Link>
      </p>
    </div>
  );
}