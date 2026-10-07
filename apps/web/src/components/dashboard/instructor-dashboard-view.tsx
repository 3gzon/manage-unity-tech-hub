'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InstructorDashboardResponse } from '@unity/types';
import { CalendarDays, ClipboardList, GraduationCap, Users } from 'lucide-react';
import { fetchInstructorDashboard } from '@/lib/dashboard-api';
import { MetricCard, MetricCardSkeleton, PanelSkeleton, EmptyState, ErrorState } from './dashboard-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function InstructorDashboardView() {
  const [data, setData] = useState<InstructorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelSkeleton />
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instructor Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your teaching schedule and assigned groups.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Today's Classes" value={metrics.todaysClasses} icon={CalendarDays} />
        <MetricCard title="Upcoming Classes" value={metrics.upcomingClasses} icon={CalendarDays} />
        <MetricCard title="My Active Groups" value={metrics.activeGroups} icon={Users} />
        <MetricCard title="Students Assigned" value={metrics.studentsAssigned} icon={GraduationCap} />
        <MetricCard title="Attendance Pending" value={metrics.attendancePending} icon={ClipboardList} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.todaysClasses.length === 0 ? (
              <EmptyState title="No classes today" description="Your schedule is clear for today." />
            ) : (
              data.todaysClasses.map((session) => (
                <div key={session.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{session.groupName}</p>
                  <p className="text-xs text-muted-foreground">{session.courseName}</p>
                  <p className="mt-1 text-xs">
                    {session.startTime}-{session.endTime}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingClasses.length === 0 ? (
              <EmptyState title="No upcoming classes" description="Future sessions will appear here." />
            ) : (
              data.upcomingClasses.map((session) => (
                <div key={session.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{session.groupName}</p>
                  <p className="text-xs text-muted-foreground">{session.courseName}</p>
                  <p className="mt-1 text-xs">
                    {session.sessionDate} · {session.startTime}-{session.endTime}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>My Active Groups</CardTitle>
            <CardDescription>Groups assigned to you</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {data.activeGroups.length === 0 ? (
              <EmptyState title="No active groups" description="Assigned groups will appear here." />
            ) : (
              data.activeGroups.map((group) => (
                <div key={group.id} className="rounded-md border p-4">
                  <p className="font-medium">{group.name}</p>
                  <p className="text-sm text-muted-foreground">{group.courseName}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary">{group.studentCount} students</Badge>
                    <span className="text-xs text-muted-foreground">{group.scheduleLabel}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
