import Link from 'next/link';
import type { HealthResponse } from '@unity/types';
import { api } from '@/lib/api-client';

async function getHealth(): Promise<HealthResponse | null> {
  try {
    return await api.get<HealthResponse>('health', { skipAuth: true });
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await getHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Unity Tech Hub
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Management Platform</h1>
        <p className="mt-3 text-muted-foreground">
          Authentication is enabled. Sign in to access the internal dashboard.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go to login
        </Link>
      </div>

      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-medium">API health</h2>
        {health ? (
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{health.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Database</dt>
              <dd>{health.database}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Timestamp</dt>
              <dd>{health.timestamp}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            API unavailable. Start the backend with <code>pnpm --filter api dev</code>.
          </p>
        )}
      </section>
    </main>
  );
}
