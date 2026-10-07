'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { GroupDetail, InstructorOption } from '@unity/types';
import { DAY_LABELS } from '@unity/types';
import { fetchGroup, updateGroup, updateGroupSchedule } from '@/lib/academics-api';
import { fetchInstructorOptions } from '@/lib/instructors-api';
import { hasPermission, isAdminPortalUser } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { GroupClassPresence } from '@/components/attendance/group-class-presence';

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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleRoom, setScheduleRoom] = useState('');
  const [scheduleRows, setScheduleRows] = useState<
    Array<{ dayOfWeek: number; startTime: string; endTime: string; sessionDate: string }>
  >([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);

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

  useEffect(() => {
    if (!canManage) return;
    void fetchInstructorOptions()
      .then(setInstructors)
      .catch(() => setInstructors([]));
  }, [canManage]);

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
        {canEditSchedule ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setScheduleRoom(group.room ?? '');
              setScheduleRows(
                group.schedules.length
                  ? group.schedules.map((slot) => ({
                      dayOfWeek: slot.dayOfWeek,
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                      sessionDate: nextDateForWeekday(slot.dayOfWeek),
                    }))
                  : [emptyScheduleRow()],
              );
              setScheduleError(null);
              setScheduleOpen(true);
            }}
          >
            {group.schedules.length ? 'Edit class times' : 'Set class times'}
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
        <h2 className="mb-2 text-lg font-medium">Schedule</h2>
        <div className="space-y-2">
          {group.schedules.length ? (
            group.schedules.map((s) => (
              <div key={s.id} className="rounded-md border px-4 py-3 text-sm">
                {s.dayLabel} · {s.startTime} – {s.endTime}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No class times yet. Set them so this group appears on My Schedule.
            </p>
          )}
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
        <h2 className="mb-2 text-lg font-medium">Enrolled students</h2>
        <div className="space-y-2">
          {(group.enrollments ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
              <Link href={`/students/${e.studentId}`} className="hover:underline">
                {e.studentName}
              </Link>
              <Badge variant="outline">{e.status}</Badge>
            </div>
          ))}
          {!group.enrollments?.length ? (
            <p className="text-sm text-muted-foreground">No enrollments yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Class attendance</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Whether each student was in class for this group.
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

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogHeader>
          <DialogTitle>Class times</DialogTitle>
          <DialogDescription>Set the date and time for each class. They will show on My Schedule.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Room"
            value={scheduleRoom}
            onChange={(e) => setScheduleRoom(e.target.value)}
          />
          {scheduleRows.map((row, index) => (
            <div key={`${row.sessionDate}-${index}`} className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                <Input
                  type="date"
                  value={row.sessionDate}
                  onChange={(e) =>
                    setScheduleRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? rowFromDate(item, e.target.value) : item,
                      ),
                    )
                  }
                />
                <Input
                  type="time"
                  value={row.startTime}
                  onChange={(e) =>
                    setScheduleRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, startTime: e.target.value } : item,
                      ),
                    )
                  }
                />
                <Input
                  type="time"
                  value={row.endTime}
                  onChange={(e) =>
                    setScheduleRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, endTime: e.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScheduleRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{DAY_LABELS[row.dayOfWeek] ?? 'Pick a date'}</p>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScheduleRows((current) => [...current, emptyScheduleRow()])}
          >
            Add class time
          </Button>
          {scheduleError ? <p className="text-sm text-red-600">{scheduleError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setScheduleOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={scheduleSaving}
            onClick={() => {
              void (async () => {
                if (!group) return;
                setScheduleSaving(true);
                setScheduleError(null);
                try {
                  const schedules = scheduleRows.filter((row) => row.sessionDate && row.startTime && row.endTime);
                  if (!schedules.length) {
                    setScheduleError('Add a date and time for at least one class.');
                    return;
                  }
                  const updated = await updateGroupSchedule(group.id, {
                    room: scheduleRoom.trim() || undefined,
                    schedules,
                  });
                  setGroup(updated);
                  setScheduleOpen(false);
                } catch (err) {
                  setScheduleError(err instanceof Error ? err.message : 'Could not save class times');
                } finally {
                  setScheduleSaving(false);
                }
              })();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function emptyScheduleRow() {
  const sessionDate = toDateInputValue(new Date());
  return {
    dayOfWeek: new Date(`${sessionDate}T00:00:00`).getDay(),
    startTime: '09:00',
    endTime: '10:30',
    sessionDate,
  };
}

function rowFromDate(
  row: { dayOfWeek: number; startTime: string; endTime: string; sessionDate: string },
  sessionDate: string,
) {
  return {
    ...row,
    sessionDate,
    dayOfWeek: sessionDate ? new Date(`${sessionDate}T00:00:00`).getDay() : row.dayOfWeek,
  };
}

function nextDateForWeekday(dayOfWeek: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const diff = (dayOfWeek - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return toDateInputValue(date);
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  );
}
