'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { InstructorDashboardResponse } from '@unity/types';
import { CalendarDays, ClipboardList, GraduationCap, Users } from 'lucide-react';
import { fetchInstructorDashboard } from '@/lib/dashboard-api';
import { MetricCard, MetricCardSkeleton, PanelSkeleton, EmptyState, ErrorState } from './dashboard-states';
import { VerticalBars, weekdayCounts, weekdayLabel } from './dashboard-visuals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function InstructorDashboardView() {
  const [data, setData] = useState<InstructorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekday, setWeekday] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchInstructorDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classBars = useMemo(
    () => weekdayCounts((data?.upcomingClasses ?? []).map((session) => session.sessionDate)),
    [data],
  );
  const visibleClasses = useMemo(() => {
    if (!data) return [];
    if (!weekday) return data.upcomingClasses;
    return data.upcomingClasses.filter((session) => weekdayLabel(session.sessionDate) === weekday);
  }, [data, weekday]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelSkeleton />
          <PanelSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void load()} />;
  }

  if (!data) {
    return null;
  }

  const { metrics } = data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Today's Classes" value={metrics.todaysClasses} icon={CalendarDays} tone="rose" />
        <MetricCard title="Upcoming Classes" value={metrics.upcomingClasses} icon={CalendarDays} tone="sand" />
        <MetricCard title="My Active Groups" value={metrics.activeGroups} icon={Users} tone="mint" />
        <MetricCard title="Students Assigned" value={metrics.studentsAssigned} icon={GraduationCap} tone="lilac" />
        <MetricCard title="Attendance Pending" value={metrics.attendancePending} icon={ClipboardList} tone="peach" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Upcoming classes</CardTitle>
              <CardDescription>Tap a day to filter the list</CardDescription>
            </div>
            {weekday ? (
              <button
                type="button"
                onClick={() => setWeekday(null)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Clear {weekday}
              </button>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <VerticalBars
              items={classBars}
              activeLabel={weekday}
              onSelect={(label) => setWeekday((current) => (current === label ? null : label))}
            />
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {visibleClasses.length === 0 ? (
                <EmptyState title="No upcoming classes" description="Future sessions will appear here." />
              ) : (
                visibleClasses.map((session) => (
                  <Link
                    key={session.id}
                    href={`/attendance?group=${session.groupId}`}
                    className="block rounded-2xl bg-slate-50 px-3 py-2.5 transition hover:bg-[#e7f1ff]"
                  >
                    <p className="text-sm font-medium text-[#020D23]">{session.groupName}</p>
                    <p className="text-xs text-slate-500">
                      {session.courseName} · {session.sessionDate} · {session.startTime}–{session.endTime}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Today&apos;s classes</CardTitle>
            <CardDescription>Sessions on your calendar today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.todaysClasses.length === 0 ? (
              <EmptyState title="No classes today" description="Your schedule is clear for today." />
            ) : (
              data.todaysClasses.map((session) => (
                <Link
                  key={session.id}
                  href={`/attendance?group=${session.groupId}`}
                  className="block rounded-2xl bg-[#e5f8ee] px-3 py-3 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-sm font-medium text-[#020D23]">{session.groupName}</p>
                  <p className="text-xs text-slate-500">{session.courseName}</p>
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    {session.startTime}–{session.endTime}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My active groups</CardTitle>
          <CardDescription>Groups assigned to you</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {data.activeGroups.length === 0 ? (
            <EmptyState title="No active groups" description="Assigned groups will appear here." />
          ) : (
            data.activeGroups.map((group) => (
              <Link
                key={group.id}
                href={`/attendance?group=${group.id}`}
                className="rounded-2xl bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <p className="font-medium text-[#020D23]">{group.name}</p>
                <p className="text-sm text-slate-500">{group.courseName}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary">{group.studentCount} students</Badge>
                  <span className="text-xs text-slate-400">{group.scheduleLabel}</span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
