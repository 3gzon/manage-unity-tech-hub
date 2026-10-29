'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/set-password-form';
import { forgotPasswordRequest } from '@/lib/auth/auth-api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await forgotPasswordRequest(email.trim());
      setDetail(result.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Forgot password"
      description="Enter the instructor email. We will send a link to choose a new password. An account that is not confirmed yet gets the confirmation email again."
    >
      {detail ? (
        <p className="mt-8 text-sm">{detail}</p>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#03FE94] px-4 py-2.5 text-sm font-semibold text-[#020D23] transition hover:bg-[#03FE94]/90 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send email'}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="font-medium text-[#020D23] hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
