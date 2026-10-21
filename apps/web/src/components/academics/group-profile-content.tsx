'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ClassSessionListItem, EnrollmentListItem, GroupDetail, InstructorOption } from '@unity/types';
import { createEnrollment, fetchGroup, updateGroup, withdrawEnrollment } from '@/lib/academics-api';
import { createGroupSession, deleteGroupSession, fetchGroupSessions } from '@/lib/attendance-api';
import { fetchInstructorOptions } from '@/lib/instructors-api';
import { fetchStudents } from '@/lib/students-api';
import { hasPermission, isAdminPortalUser } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
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
  const [rosterVersion, setRosterVersion] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [keptStudents, setKeptStudents] = useState<EnrollmentListItem[]>([]);
  const [addedStudents, setAddedStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentHits, setStudentHits] = useState<Array<{ id: string; name: string }>>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(() => {
    if (!editOpen) return;
    const handle = window.setTimeout(() => {
      setSearchingStudents(true);
      void fetchStudents({ search: studentQuery.trim() || undefined, pageSize: 20 })
        .then((response) =>
          setStudentHits(response.data.map((student) => ({ id: student.id, name: student.fullName }))),
        )
        .catch(() => setStudentHits([]))
        .finally(() => setSearchingStudents(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [editOpen, studentQuery]);

  function openEdit() {
    if (!group) return;
    const assigned = (group.enrollments ?? []).filter(
      (enrollment) => enrollment.status === 'ACTIVE' || enrollment.status === 'PENDING',
    );
    const existingPrice = assigned.find((enrollment) => enrollment.agreedMonthlyPrice)?.agreedMonthlyPrice;
    setEditName(group.name);
    setEditPrice(existingPrice ?? group.course?.defaultMonthlyPrice ?? '');
    setKeptStudents(assigned);
    setAddedStudents([]);
    setStudentQuery('');
    setStudentHits([]);
    setSearchingStudents(true);
    setEditError(null);
    setEditOpen(true);
  }

  function assignedIds() {
    return new Set([...keptStudents.map((student) => student.studentId), ...addedStudents.map((student) => student.id)]);
  }

  async function handleSaveEdit() {
    if (!group || !editName.trim()) return;
    const price = Number(editPrice);
    if (addedStudents.length && (!editPrice.trim() || Number.isNaN(price) || price < 0)) {
      setEditError('Enter a monthly price for the students you are adding.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      if (editName.trim() !== group.name) {
        await updateGroup(group.id, { name: editName.trim() });
      }
      const keptIds = new Set(keptStudents.map((student) => student.id));
      const removed = (group.enrollments ?? []).filter(
        (enrollment) =>
          (enrollment.status === 'ACTIVE' || enrollment.status === 'PENDING') && !keptIds.has(enrollment.id),
      );
      for (const enrollment of removed) {
        await withdrawEnrollment(enrollment.id);
      }
      const today = toDateInputValue(new Date());
      for (const student of addedStudents) {
        await createEnrollment({
          studentId: student.id,
          groupId: group.id,
          startDate: today,
          agreedMonthlyPrice: price,
          billingEnabled: true,
          status: 'ACTIVE',
        });
      }
      setEditOpen(false);
      setRosterVersion((version) => version + 1);
      setGroup(await fetchGroup(group.id));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save the group');
      const next = await fetchGroup(group.id).catch(() => group);
      setGroup(next);
      const assigned = (next.enrollments ?? []).filter(
        (enrollment) => enrollment.status === 'ACTIVE' || enrollment.status === 'PENDING',
      );
      const assignedStudentIds = new Set(assigned.map((enrollment) => enrollment.studentId));
      setKeptStudents(assigned);
      setAddedStudents((current) => current.filter((student) => !assignedStudentIds.has(student.id)));
    } finally {
      setSavingEdit(false);
    }
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
          <>
            <Button variant="outline" size="sm" onClick={openEdit}>
              Edit group
            </Button>
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
          </>
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
        <GroupClassPresence key={rosterVersion} groupId={group.id} />
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
          <DialogDescription>Change the group name and the students assigned to it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="group-name">Name</Label>
            <Input id="group-name" value={editName} onChange={(event) => setEditName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Assigned students</p>
            {keptStudents.length === 0 && addedStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {keptStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>
                      {student.studentName}
                      {student.status === 'PENDING' ? (
                        <span className="ml-2 text-muted-foreground">Waiting</span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setKeptStudents((current) => current.filter((item) => item.id !== student.id))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {addedStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{student.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddedStudents((current) => current.filter((item) => item.id !== student.id))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-student-search">Add a student</Label>
            <p className="text-xs text-muted-foreground">
              Students already enrolled in another course can be added here. They stay with that teacher as well.
            </p>
            <Input
              id="group-student-search"
              placeholder="Search by name, email, or phone"
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              autoComplete="off"
            />
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {searchingStudents ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
              ) : studentHits.filter((student) => !assignedIds().has(student.id)).length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No students match that search.</p>
              ) : (
                studentHits
                  .filter((student) => !assignedIds().has(student.id))
                  .map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => setAddedStudents((current) => [...current, student])}
                    >
                      {student.name}
                    </button>
                  ))
              )}
            </div>
          </div>
          {addedStudents.length ? (
            <div className="space-y-1">
              <Label htmlFor="group-student-price">Monthly price for new students</Label>
              <Input
                id="group-student-price"
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(event) => setEditPrice(event.target.value)}
              />
            </div>
          ) : null}
          {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)}>
            Cancel
          </Button>
          <Button disabled={savingEdit || !editName.trim()} onClick={() => void handleSaveEdit()}>
            {savingEdit ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </Dialog>

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
