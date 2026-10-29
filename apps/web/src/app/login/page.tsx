'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { LogoMark } from '@/components/layout/logo';

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
      <div className="pointer-events-none absolute -left-32 -top-16 h-96 w-96 rounded-full bg-[#03FE94]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-96 w-96 rounded-full bg-[#03FE94]/8 blur-3xl" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <LogoMark className="h-9 w-9 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#020D23]">
              Unity Tech <span className="font-black text-[#03FE94]">HUB</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Management Platform</p>
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-[#020D23]">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your staff credentials to access the internal dashboard.
        </p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#020D23]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none transition focus:border-[#03FE94]/60 focus:ring-2 focus:ring-[#03FE94]/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#020D23]" htmlFor="password">
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
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none transition focus:border-[#03FE94]/60 focus:ring-2 focus:ring-[#03FE94]/20"
            />
          </div>

          {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-[#03FE94] px-4 py-2.5 text-sm font-semibold text-[#020D23] transition hover:bg-[#03FE94]/90 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-sm">
            <a href="/forgot-password" className="font-medium text-[#03FE94] hover:underline" style={{ color: '#020D23' }}>
              Forgot password?
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
