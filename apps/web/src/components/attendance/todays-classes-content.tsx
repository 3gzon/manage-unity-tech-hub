'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { TodayClassItem } from '@unity/types';
import { fetchTodayClasses } from '@/lib/attendance-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MonthCalendar, parseDateInput, toDateInputValue } from '@/components/ui/month-calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/dashboard/dashboard-states';

export function TodaysClassesContent() {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [classes, setClasses] = useState<TodayClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClasses(await fetchTodayClasses(selectedDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const label = parseDateInput(selectedDate).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">Pick a date, then open the class.</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={[selectedDate]}
          onSelect={(date) => {
            setSelectedDate(date);
            const picked = parseDateInput(date);
            setMonth(new Date(picked.getFullYear(), picked.getMonth(), 1));
          }}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm font-medium">{label}</p>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Unable to load classes" description={error} onRetry={() => void load()} />
          ) : classes.length === 0 ? (
            <EmptyState title="No classes on this date" description="Pick another day on the calendar." />
          ) : (
            classes.map((item) => (
              <div key={item.sessionId} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{item.groupName}</p>
                  <p className="text-sm text-muted-foreground">{item.courseName}</p>
                  <p className="mt-1 text-sm">
                    {item.startTime} – {item.endTime}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {item.markedCount}/{item.enrolledCount} marked
                  </Badge>
                  <Link href={`/attendance/${item.sessionId}`}>
                    <Button size="sm">{item.attendanceSubmitted ? 'Review' : 'Take attendance'}</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
