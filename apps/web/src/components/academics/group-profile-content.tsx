'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ClassSessionListItem, GroupDetail, InstructorOption } from '@unity/types';
import { fetchGroup, updateGroup } from '@/lib/academics-api';
import { createGroupSession, deleteGroupSession, fetchGroupSessions } from '@/lib/attendance-api';
import { fetchInstructorOptions } from '@/lib/instructors-api';
import { hasPermission, isAdminPortalUser } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { DayClasses, sessionCounts } from '@/components/attendance/day-classes';
import { GroupClassPresence } from '@/components/attendance/group-class-presence';
import { MonthCalendar, parseDateInput, toDateInputValue } from '@/components/ui/month-calendar';

export function GroupProfileContent() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = isAdminPortalUser(user);
  const canManage = hasPermission(user, 'groups.manage');
  const canEditSchedule = canManage || hasPermission(user, 'attendance.manage');
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [instructorId, setInstructorId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [scheduleMonth, setScheduleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pickedDate, setPickedDate] = useState(() => toDateInputValue(new Date()));
  const [sessions, setSessions] = useState<ClassSessionListItem[]>([]);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroup(await fetchGroup(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthKey = `${scheduleMonth.getFullYear()}-${scheduleMonth.getMonth()}`;

  useEffect(() => {
    if (!params.id) return;
    const fromDate = toDateInputValue(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth(), 1));
    const toDate = toDateInputValue(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + 1, 0));
    void fetchGroupSessions(params.id, { page: 1, pageSize: 100, fromDate, toDate })
      .then((response) => setSessions(response.data))
      .catch(() => setSessions([]));
  }, [params.id, monthKey, scheduleMonth, sessionsVersion]);

  useEffect(() => {
    if (!canManage) return;
    void fetchInstructorOptions()
      .then(setInstructors)
      .catch(() => setInstructors([]));
  }, [canManage]);

  const daySessions = sessions.filter((session) => session.sessionDate.slice(0, 10) === pickedDate);

  async function saveClass(input: { groupId: string; sessionId?: string; startTime: string; endTime: string }) {
    await createGroupSession(input.groupId, {
      sessionId: input.sessionId,
      sessionDate: pickedDate,
      startTime: input.startTime,
      endTime: input.endTime,
    });
    setSessionsVersion((version) => version + 1);
  }

  async function removeClass(input: { groupId: string; sessionId: string }) {
    await deleteGroupSession(input.groupId, input.sessionId);
    setSessionsVersion((version) => version + 1);
  }

  async function handleAssign() {
    if (!group) return;
    setAssignError(null);
    try {
      const updated = await updateGroup(group.id, { instructorId: instructorId || null });
      setGroup(updated);
      setAssignOpen(false);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign instructor');
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error || !group) {
    return <ErrorState title="Group unavailable" description={error ?? 'Not found'} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">{group.status}</Badge>
          <Badge variant="secondary">{group.courseName}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setInstructorId(group.instructorId ?? '');
              setAssignError(null);
              setAssignOpen(true);
            }}
          >
            {group.instructorId ? 'Change instructor' : 'Assign instructor'}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Info
          label="Instructor"
          value={
            isAdmin && group.instructorId && group.instructorName ? (
              <Link href={`/instructors/${group.instructorId}`} className="hover:underline">
                {group.instructorName}
              </Link>
            ) : (
              group.instructorName
            )
          }
        />
        <Info label="Room" value={group.room} />
        <Info label="Start date" value={group.startDate} />
        <Info label="End date" value={group.endDate} />
        <Info label="Capacity" value={group.capacity ? String(group.capacity) : null} />
        <Info label="Enrolled" value={String(group.enrolledCount)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Schedule</h2>
        <MonthCalendar
          month={scheduleMonth}
          onMonthChange={setScheduleMonth}
          selected={[pickedDate]}
          counts={sessionCounts(sessions)}
          onSelect={setPickedDate}
        />
        <div className="mt-4">
          <DayClasses
            dateLabel={parseDateInput(pickedDate).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            sessions={daySessions}
            groupId={group.id}
            canEdit={canEditSchedule}
            onSave={saveClass}
            onRemove={removeClass}
          />
        </div>
      </section>

      {group.course ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Course</h2>
          <div className="rounded-xl border p-4 text-sm">
            <Link href={`/courses/${group.course.id}`} className="font-medium hover:underline">
              {group.course.name}
            </Link>
            <p className="mt-1 text-muted-foreground">{group.course.description || 'No description.'}</p>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-medium">Waiting to start</h2>
        <div className="space-y-2">
          {(group.enrollments ?? [])
            .filter((enrollment) => enrollment.status === 'PENDING')
            .map((enrollment) => (
              <div key={enrollment.id} className="rounded-md border px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/students/${enrollment.studentId}`} className="hover:underline">
                    {enrollment.studentName}
                  </Link>
                  <span className="text-muted-foreground">{enrollment.startDate}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{enrollment.notes || 'No comment yet.'}</p>
              </div>
            ))}
          {!(group.enrollments ?? []).some((enrollment) => enrollment.status === 'PENDING') ? (
            <p className="text-sm text-muted-foreground">No students are waiting to start.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Enrolled students</h2>
        <div className="space-y-2">
          {(group.enrollments ?? [])
            .filter((enrollment) => enrollment.status === 'ACTIVE')
            .map((enrollment) => (
              <div key={enrollment.id} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
                <Link href={`/students/${enrollment.studentId}`} className="hover:underline">
                  {enrollment.studentName}
                </Link>
                <Badge variant="outline">Active</Badge>
              </div>
            ))}
          {!(group.enrollments ?? []).some((enrollment) => enrollment.status === 'ACTIVE') ? (
            <p className="text-sm text-muted-foreground">No students have started yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Class attendance</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Students are listed down the side. Each class day is a column.
        </p>
        <GroupClassPresence groupId={group.id} />
      </section>

      {isAdmin && group.financialSummary ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Financial summary</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Info label="Monthly revenue" value={`€${group.financialSummary.totalMonthlyRevenue}`} />
            <Info label="Active enrollments" value={String(group.financialSummary.activeEnrollments)} />
            <Info label="Billing enabled" value={String(group.financialSummary.billingEnabledCount)} />
          </div>
        </section>
      ) : null}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogHeader>
          <DialogTitle>{group.instructorId ? 'Change instructor' : 'Assign instructor'}</DialogTitle>
          <DialogDescription>This instructor will see this group in their portal.</DialogDescription>
        </DialogHeader>
        <Select value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
          <option value="">No instructor</option>
          {instructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.name}
            </option>
          ))}
        </Select>
        {assignError ? <p className="mt-3 text-sm text-red-600">{assignError}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAssignOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleAssign()}>Save</Button>
        </DialogFooter>
      </Dialog>

    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  );
}
