'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('superadmin@unitytechhub.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('confirmed') === '1') setNotice('Account confirmed. Sign in with your new password.');
    if (params.get('reset') === '1') setNotice('Password updated. Sign in with your new password.');
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020D23] p-6">
      <div className="pointer-events-none absolute -left-16 top-8 h-72 w-72 rounded-full bg-[#046bd2]/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#00FF88]/25 blur-3xl" />
      <div className="pointer-events-none absolute right-16 top-16 h-40 w-40 rounded-full bg-[#F50057]/25 blur-3xl" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="h-1.5 w-20 rounded-full bg-gradient-to-r from-[#046bd2] via-[#00FF88] to-[#F50057]" />
        <p className="mt-5 text-sm font-medium text-[#046bd2]">Unity Tech Hub</p>
        <h1 className="mt-2 text-2xl font-bold text-[#020D23]">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your staff credentials to access the management platform.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>

          {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#046bd2] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center text-sm">
            <a href="/forgot-password" className="text-[#046bd2] hover:underline">
              Forgot password?
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
