'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { InstructorScheduleResponse, ScheduleSessionItem, WeeklyScheduleSlot } from '@unity/types';
import { fetchInstructorSchedule } from '@/lib/attendance-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function MyScheduleContent() {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [data, setData] = useState<InstructorScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromDate = toDateOnly(weekStart);
  const toDate = toDateOnly(addDays(weekStart, 6));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchInstructorSchedule({ fromDate, toDate }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const dateKey = toDateOnly(date);
      const sessions = data?.sessions.filter((session) => session.sessionDate === dateKey) ?? [];
      return { date, dateKey, sessions };
    });
  }, [data?.sessions, weekStart]);

  const weeklyByDay = useMemo(() => groupWeeklySlots(data?.weekly ?? []), [data?.weekly]);
  const isCurrentWeek = fromDate === toDateOnly(startOfWeekMonday(new Date()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Schedule</h1>
          <p className="text-sm text-muted-foreground">View your upcoming teaching schedule.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((current) => addDays(current, -7))}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={isCurrentWeek} onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            This week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((current) => addDays(current, 7))}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium">
        {formatWeekRange(weekStart)}
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load schedule" description={error} onRetry={() => void load()} />
      ) : (
        <>
          {data?.groups.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Assigned groups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.groups.map((group) => (
                  <div
                    key={group.groupId}
                    className="flex flex-col gap-2 rounded-lg border px-3 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{group.groupName}</p>
                      <p className="text-sm text-muted-foreground">{group.courseName}</p>
                      <p className="mt-1 text-sm">{group.scheduleSummary}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{group.status}</Badge>
                      <Badge variant="secondary">
                        {group.enrolledCount} enrolled
                      </Badge>
                      {group.room ? <Badge variant="outline">{group.room}</Badge> : null}
                      <Link href={`/groups/${group.groupId}`}>
                        <Button size="sm" variant="outline">
                          {group.scheduleSummary === 'No schedule' ? 'Set class times' : 'Open group'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No groups are assigned to you yet.
            </p>
          )}

          <div className="space-y-4">
            {days.map((day) => (
              <section key={day.dateKey} className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {formatDayHeading(day.date)}
                  {isSameDate(day.date, new Date()) ? ' · Today' : ''}
                </h2>
                {day.sessions.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    No classes
                  </p>
                ) : (
                  <div className="space-y-3">
                    {day.sessions.map((session) => (
                      <SessionCard key={session.sessionId} session={session} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          {weeklyByDay.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Weekly timetable</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {weeklyByDay.map((group) => (
                  <div key={group.dayOfWeek} className="space-y-2">
                    <p className="text-sm font-medium">{group.dayLabel}</p>
                    <div className="space-y-2">
                      {group.slots.map((slot) => (
                        <div
                          key={`${slot.groupId}-${slot.dayOfWeek}-${slot.startTime}`}
                          className="flex flex-col gap-1 rounded-lg border px-3 py-2 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-medium">{slot.groupName}</p>
                            <p className="text-sm text-muted-foreground">{slot.courseName}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span>
                              {slot.startTime} – {slot.endTime}
                            </span>
                            {slot.room ? <Badge variant="outline">{slot.room}</Badge> : null}
                            <Link href={`/groups/${slot.groupId}`} className="text-sm underline-offset-4 hover:underline">
                              Open group
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: ScheduleSessionItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-medium">{session.groupName}</p>
        <p className="text-sm text-muted-foreground">{session.courseName}</p>
        <p className="mt-1 text-sm">
          {session.startTime} – {session.endTime}
          {session.room ? ` · ${session.room}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{session.status}</Badge>
        <Badge variant="secondary">
          {session.markedCount}/{session.enrolledCount} marked
        </Badge>
        {session.attendanceSubmitted ? <Badge variant="outline">Submitted</Badge> : null}
        <Link href={`/groups/${session.groupId}`}>
          <Button size="sm" variant="outline">
            Group
          </Button>
        </Link>
        <Link href={`/attendance/${session.sessionId}`}>
          <Button size="sm">{session.attendanceSubmitted ? 'Review' : 'Take attendance'}</Button>
        </Link>
      </div>
    </div>
  );
}

function groupWeeklySlots(slots: WeeklyScheduleSlot[]) {
  return WEEKDAY_ORDER.flatMap((dayOfWeek) => {
    const daySlots = slots.filter((slot) => slot.dayOfWeek === dayOfWeek);
    const first = daySlots[0];
    if (!first) return [];
    return [{ dayOfWeek, dayLabel: first.dayLabel, slots: daySlots }];
  });
}

function startOfWeekMonday(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDate(left: Date, right: Date): boolean {
  return toDateOnly(left) === toDateOnly(right);
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
