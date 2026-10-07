'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { TodayClassItem } from '@unity/types';
import { fetchTodayClasses } from '@/lib/attendance-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/dashboard/dashboard-states';

export function TodaysClassesContent() {
  const [classes, setClasses] = useState<TodayClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClasses(await fetchTodayClasses());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s Classes</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load classes" description={error} onRetry={() => void load()} />
      ) : classes.length === 0 ? (
        <EmptyState title="No classes today" description="You have no scheduled sessions for today." />
      ) : (
        <div className="space-y-3">
          {classes.map((item) => (
            <div key={item.sessionId} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{item.groupName}</p>
                <p className="text-sm text-muted-foreground">{item.courseName}</p>
                <p className="mt-1 text-sm">
                  {item.startTime} – {item.endTime}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{item.status}</Badge>
                <Badge variant="secondary">
                  {item.markedCount}/{item.enrolledCount} marked
                </Badge>
                {item.attendanceSubmitted ? (
                  <Badge variant="outline">Submitted</Badge>
                ) : null}
                <Link href={`/attendance/${item.sessionId}`}>
                  <Button size="sm">{item.attendanceSubmitted ? 'Review' : 'Take attendance'}</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
