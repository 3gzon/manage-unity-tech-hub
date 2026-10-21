'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';

export function SetPasswordForm({
  title,
  description,
  token,
  submitLabel,
  onSubmit,
}: {
  title: string;
  description: string;
  token: string;
  submitLabel: string;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the password');
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={title} description={description}>
      {token ? (
        <form className="mt-8 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <PasswordField id="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#046bd2] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-red-600">This link is missing a token. Open the link from the email again.</p>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-[#046bd2] hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020D23] p-6">
      <div className="pointer-events-none absolute -left-16 top-8 h-72 w-72 rounded-full bg-[#046bd2]/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#00FF88]/25 blur-3xl" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="h-1.5 w-20 rounded-full bg-gradient-to-r from-[#046bd2] via-[#00FF88] to-[#F50057]" />
        <p className="mt-5 text-sm font-medium text-[#046bd2]">Unity Tech Hub</p>
        <h1 className="mt-2 text-2xl font-bold text-[#020D23]">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete={autoComplete}
        required
        minLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
      />
    </div>
  );
}
