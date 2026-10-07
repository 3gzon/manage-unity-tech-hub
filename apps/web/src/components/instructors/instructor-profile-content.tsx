'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { InstructorDetail } from '@unity/types';
import { fetchInstructor } from '@/lib/instructors-api';
import { hasPermission, hasRole } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Skeleton } from '@/components/ui/skeleton';

export function InstructorProfileContent() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN') && hasPermission(user, 'instructors.read');
  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInstructor(await fetchInstructor(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instructor');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <EmptyState
        title="Access restricted"
        description="Instructor profiles are available only to Super Admins and Admins."
      />
    );
  }

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error || !instructor) {
    return <ErrorState title="Instructor unavailable" description={error ?? 'Not found'} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/instructors" className="hover:underline">
            Instructors
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{instructor.name}</h1>
        <p className="text-sm text-muted-foreground">{instructor.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Info label="Phone" value={instructor.phone} />
        <Info label="Hire date" value={instructor.hireDate} />
        <Info label="Linked user" value={instructor.userName ? `${instructor.userName} (${instructor.userEmail})` : null} />
        <Info label="Active groups" value={String(instructor.activeGroupsCount)} />
      </div>

      {instructor.bio ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Bio</h2>
          <p className="rounded-xl border p-4 text-sm">{instructor.bio}</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-medium">Assigned groups</h2>
        {instructor.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No groups assigned yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Enrolled</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {instructor.groups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/groups/${group.id}`} className="hover:underline">
                        {group.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{group.courseName}</td>
                    <td className="px-4 py-3">{group.enrolledCount}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{group.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  );
}
