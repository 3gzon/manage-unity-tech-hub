'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { StudentProfileResponse } from '@unity/types';
import { fetchGroups, updateEnrollment } from '@/lib/academics-api';
import { fetchInstructors } from '@/lib/instructors-api';
import { addFamilyMember, archiveStudent, fetchStudent, fetchStudents, leaveFamily, updateStudent } from '@/lib/students-api';
import { useAuth } from '@/lib/auth/auth-context';
import { hasPermission, isAdminPortalUser } from '@/lib/auth/authorization';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { FeedbackHistory } from '@/components/instructors/feedback-history';
import { StudentForm, type EnrollmentGroupChange, type StudentGroupOption } from '@/components/students/student-form';
import { toStudentRequest, type StudentFormValues } from '@/lib/schemas/student.schema';

export function StudentProfileContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = isAdminPortalUser(user);
  const canUpdate = hasPermission(user, 'students.update');
  const canArchive = hasPermission(user, 'students.archive');
  const canManageEnrollments = hasPermission(user, 'enrollments.manage');

  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [instructors, setInstructors] = useState<Array<{ id: string; name: string }>>([]);
  const [groups, setGroups] = useState<StudentGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(canUpdate && canManageEnrollments);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);
  const [enrollEditCourseId, setEnrollEditCourseId] = useState('');
  const [enrollEditGroupId, setEnrollEditGroupId] = useState('');
  const [enrollEditPrice, setEnrollEditPrice] = useState('');
  const [enrollEditSaving, setEnrollEditSaving] = useState(false);
  const [enrollEditError, setEnrollEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await fetchStudent(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canUpdate) return;
    void fetchStudents({ page: 1, pageSize: 100 })
      .then((res) => setStudents(res.data.map((item) => ({ id: item.id, name: item.fullName }))))
      .catch(() => setStudents([]));
    void fetchInstructors({ page: 1, pageSize: 100 })
      .then((response) => setInstructors(response.data.map((instructor) => ({ id: instructor.id, name: instructor.name }))))
      .catch(() => setInstructors([]));
  }, [canUpdate]);

  useEffect(() => {
    if (!canUpdate || !canManageEnrollments) return;
    let cancelled = false;
    setGroupsLoading(true);
    setGroupsError(null);
    void (async () => {
      try {
        const first = await fetchGroups({ page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'asc' });
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, index) =>
            fetchGroups({ page: index + 2, pageSize: 100, sortBy: 'name', sortOrder: 'asc' }),
          ),
        );
        if (cancelled) return;
        setGroups(
          [first, ...rest].flatMap((page) =>
            page.data.map((group) => ({
              id: group.id,
              name: group.name,
              courseId: group.courseId,
              courseName: group.courseName,
              instructorName: group.instructorName,
              status: group.status,
            })),
          ),
        );
      } catch (err) {
        if (!cancelled) {
          setGroupsError(err instanceof Error ? err.message : 'Could not load courses');
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canUpdate, canManageEnrollments]);

  const editingEnrollment = useMemo(
    () => (editingEnrollmentId ? (profile?.enrollments.find((e) => e.id === editingEnrollmentId) ?? null) : null),
    [editingEnrollmentId, profile],
  );

  useEffect(() => {
    if (!editingEnrollment) return;
    setEnrollEditCourseId(editingEnrollment.courseId);
    setEnrollEditGroupId(editingEnrollment.groupId);
    setEnrollEditPrice(editingEnrollment.agreedMonthlyPrice);
    setEnrollEditError(null);
  }, [editingEnrollment]);

  const enrollEditCourses = useMemo(
    () => [...new Map(groups.map((g) => [g.courseId, { id: g.courseId, name: g.courseName }])).values()],
    [groups],
  );
  const enrollEditGroups = useMemo(
    () => groups.filter((g) => g.courseId === enrollEditCourseId),
    [groups, enrollEditCourseId],
  );

  async function handleEnrollmentSave() {
    if (!editingEnrollment) return;
    setEnrollEditSaving(true);
    setEnrollEditError(null);
    try {
      const data: Record<string, unknown> = {};
      if (enrollEditGroupId && enrollEditGroupId !== editingEnrollment.groupId) data.groupId = enrollEditGroupId;
      const priceNum = parseFloat(enrollEditPrice);
      if (enrollEditPrice !== '' && !isNaN(priceNum) && enrollEditPrice !== editingEnrollment.agreedMonthlyPrice) {
        data.agreedMonthlyPrice = priceNum;
      }
      if (Object.keys(data).length > 0) await updateEnrollment(editingEnrollment.id, data);
      setEditingEnrollmentId(null);
      await load();
    } catch (err) {
      setEnrollEditError(err instanceof Error ? err.message : 'Could not save enrollment');
    } finally {
      setEnrollEditSaving(false);
    }
  }

  const tabs = isAdmin
    ? ['overview', 'enrollments', 'attendance', 'feedback', 'invoices', 'payments', 'certificates', 'comments']
    : ['overview', 'enrollments', 'attendance', 'feedback'];

  async function handleUpdate(values: StudentFormValues, enrollmentChanges: EnrollmentGroupChange[] = []) {
    for (const change of enrollmentChanges) {
      const updateData: Record<string, unknown> = {};
      if (change.groupId) updateData.groupId = change.groupId;
      if (change.agreedMonthlyPrice !== undefined && change.agreedMonthlyPrice !== '') {
        updateData.agreedMonthlyPrice = parseFloat(change.agreedMonthlyPrice);
      }
      if (Object.keys(updateData).length > 0) {
        await updateEnrollment(change.id, updateData);
      }
    }
    await updateStudent(params.id, toStudentRequest(values));
    setEditOpen(false);
    await load();
  }

  async function handleArchive() {
    await archiveStudent(params.id);
    router.push('/students');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return <ErrorState title="Student unavailable" description={error ?? 'Not found'} onRetry={() => void load()} />;
  }

  const { student } = profile;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{student.fullName}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{student.status}</Badge>
            {student.age !== null ? <Badge variant="secondary">Age {student.age}</Badge> : null}
          </div>
        </div>
        <div className="flex gap-2">
          {canUpdate ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          ) : null}
          {canArchive ? (
            <Button variant="outline" onClick={() => setArchiveOpen(true)}>
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === item ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Info label="Phone" value={student.phone} />
          <Info label="Email" value={student.email} />
          <Info label="Date of birth" value={student.dateOfBirth} />
          <Info label="Age" value={student.age === null ? null : String(student.age)} />
          <div className="md:col-span-2">
            <Info
              label="Courses and teachers"
              value={
                profile.enrollments
                  .filter((enrollment) => enrollment.status === 'ACTIVE' || enrollment.status === 'PENDING')
                  .map((enrollment) =>
                    `${enrollment.courseName} · ${enrollment.groupName}${enrollment.instructorName ? ` · ${enrollment.instructorName}` : ''}`,
                  )
                  .join('; ') || student.instructorName || '—'
              }
            />
          </div>
          <Info label="School" value={student.school} />
          <Info label="Address" value={student.address} />
          <Info label="Registration date" value={student.registrationDate} />
          <div className="md:col-span-2">
            <Info label="Guardians" value={profile.guardians.map((g) => `${g.firstName} ${g.lastName}`).join(', ') || '—'} />
          </div>
          <div className="space-y-3 rounded-xl border p-4 md:col-span-2">
            <div>
              <p className="text-sm font-medium">Family pack</p>
              <p className="text-sm text-muted-foreground">
                Students in the same pack, or who share a guardian phone, get the family-pack discount from Settings when more than one of them is enrolled.
              </p>
            </div>
            {profile.family ? (
              <ul className="space-y-1 text-sm">
                {profile.family.members.map((member) => (
                  <li key={member.id}>
                    {member.fullName}
                    {member.id === student.id ? ' (this student)' : ''}
                    {member.enrolled ? '' : ' · not enrolled'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No family pack yet.</p>
            )}
            {familyError ? <p className="text-sm text-red-600">{familyError}</p> : null}
            {canUpdate ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select className="sm:max-w-xs" value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)}>
                  <option value="">Add a student</option>
                  {students
                    .filter((item) => item.id !== student.id && !profile.family?.members.some((member) => member.id === item.id))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </Select>
                <Button
                  variant="outline"
                  disabled={!familyMemberId}
                  onClick={() => {
                    setFamilyError(null);
                    void addFamilyMember(student.id, familyMemberId)
                      .then((next) => {
                        setProfile(next);
                        setFamilyMemberId('');
                      })
                      .catch((err) => setFamilyError(err instanceof Error ? err.message : 'Could not update the family pack'));
                  }}
                >
                  Add to family pack
                </Button>
                {profile.family ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFamilyError(null);
                      void leaveFamily(student.id)
                        .then(setProfile)
                        .catch((err) => setFamilyError(err instanceof Error ? err.message : 'Could not leave the family pack'));
                    }}
                  >
                    Remove from pack
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'enrollments' ? (
        profile.enrollments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No enrollments</div>
        ) : (
          <div className="space-y-2">
            {profile.enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.courseName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.groupName}{e.instructorName ? ` · ${e.instructorName}` : ''} · €{Number(e.agreedMonthlyPrice).toFixed(2)}/mo
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={e.status === 'ACTIVE' ? 'default' : 'secondary'}>{e.status}</Badge>
                  {canManageEnrollments ? (
                    <Button variant="outline" size="sm" onClick={() => setEditingEnrollmentId(e.id)}>
                      Edit
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === 'attendance' ? (
        <ListPanel
          empty="No attendance records"
          items={profile.attendance.map((a) => `${a.sessionDate} · ${a.groupName} · ${a.status}${a.notes ? ` · ${a.notes}` : ''}`)}
        />
      ) : null}

      {isAdmin && tab === 'invoices' ? (
        <ListPanel
          empty="No invoices"
          items={(profile.invoices ?? []).map((i) => `${i.invoiceNumber} · €${i.remainingAmount} · ${i.status}`)}
        />
      ) : null}

      {isAdmin && tab === 'payments' ? (
        <ListPanel
          empty="No payments"
          items={(profile.payments ?? []).map((p) => `${p.paymentDate} · €${p.amount} · ${p.method}${p.notes ? ` · ${p.notes}` : ''}`)}
        />
      ) : null}

      {isAdmin && tab === 'certificates' ? (
        <ListPanel
          empty="No certificates"
          items={(profile.certificates ?? []).map((c) => `${c.courseName} · ${c.certificateCode}`)}
        />
      ) : null}

      {tab === 'feedback' ? <FeedbackHistory studentId={student.id} showStudent={false} /> : null}

      {tab === 'comments' ? (
        <div className="rounded-xl border p-4 text-sm">{student.notes || 'No comments yet.'}</div>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit student</DialogTitle>
          <DialogDescription>
            {canManageEnrollments
              ? 'Update student details, courses, and guardians.'
              : 'Update student details and guardians.'}
          </DialogDescription>
        </DialogHeader>
        <StudentForm
          instructors={instructors}
          enrollments={
            canManageEnrollments
              ? profile.enrollments
                  .filter((enrollment) => enrollment.status === 'ACTIVE' || enrollment.status === 'PENDING')
                  .map((enrollment) => ({
                    id: enrollment.id,
                    courseId: enrollment.courseId,
                    courseName: enrollment.courseName,
                    groupId: enrollment.groupId,
                    groupName: enrollment.groupName,
                    instructorName: enrollment.instructorName,
                    status: enrollment.status,
                    agreedMonthlyPrice: enrollment.agreedMonthlyPrice,
                  }))
              : undefined
          }
          groups={groups}
          groupsLoading={groupsLoading}
          groupsError={groupsError}
          defaultValues={{
            firstName: student.firstName,
            lastName: student.lastName,
            dateOfBirth: student.dateOfBirth ?? undefined,
            age: student.age != null && student.age > 0 ? student.age : undefined,
            instructorId: student.instructorId ?? undefined,
            gender: student.gender ?? undefined,
            phone: student.phone ?? undefined,
            email: student.email ?? undefined,
            address: student.address ?? undefined,
            school: student.school ?? undefined,
            notes: student.notes ?? undefined,
            status: student.status,
            registrationDate: student.registrationDate,
            guardians: profile.guardians.map((guardian) => ({
              firstName: guardian.firstName,
              lastName: guardian.lastName,
              phone: guardian.phone ?? '',
              email: guardian.email ?? '',
              relationship: guardian.relationship,
            })),
          }}
          onCancel={() => setEditOpen(false)}
          onSubmit={handleUpdate}
        />
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogHeader>
          <DialogTitle>Archive student</DialogTitle>
          <DialogDescription>
            Archive {student.fullName}? This cannot be undone from the UI without admin restoration.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setArchiveOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleArchive()}>Confirm archive</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={editingEnrollmentId !== null} onOpenChange={(open) => { if (!open) setEditingEnrollmentId(null); }}>
        <DialogHeader>
          <DialogTitle>Edit enrollment</DialogTitle>
          <DialogDescription>
            Move the student to a different group or update their monthly price.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Course</label>
            <Select
              value={enrollEditCourseId}
              onChange={(e) => {
                setEnrollEditCourseId(e.target.value);
                setEnrollEditGroupId('');
              }}
            >
              <option value="">Select course…</option>
              {enrollEditCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Group</label>
            <Select
              value={enrollEditGroupId}
              onChange={(e) => setEnrollEditGroupId(e.target.value)}
              disabled={!enrollEditCourseId}
            >
              <option value="">Select group…</option>
              {enrollEditGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.instructorName ? ` · ${g.instructorName}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Monthly price (€)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm outline-none transition focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20"
              value={enrollEditPrice}
              onChange={(e) => setEnrollEditPrice(e.target.value)}
            />
          </div>
          {enrollEditError ? <p className="text-sm text-red-500">{enrollEditError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingEnrollmentId(null)} disabled={enrollEditSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleEnrollmentSave()} disabled={enrollEditSaving || !enrollEditGroupId}>
            {enrollEditSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </Dialog>
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

function ListPanel({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="rounded-md border px-4 py-3 text-sm">
          {item}
        </div>
      ))}
    </div>
  );
}
