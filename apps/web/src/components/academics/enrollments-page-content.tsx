'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { EnrollmentListItem } from '@unity/types';
import {
  createEnrollment,
  fetchEnrollments,
  fetchGroups,
  updateEnrollment,
  withdrawEnrollment,
} from '@/lib/academics-api';
import { fetchStudents } from '@/lib/students-api';
import { useAuth } from '@/lib/auth/auth-context';
import { hasPermission } from '@/lib/auth/authorization';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/dashboard/dashboard-states';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const emptyForm = () => ({
  studentId: '',
  studentName: '',
  groupId: '',
  startDate: todayInput(),
  agreedMonthlyPrice: '',
  billingEnabled: true,
  waiting: false,
  comment: '',
});

export function EnrollmentsPageContent() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'enrollments.manage');

  const [enrolled, setEnrolled] = useState<EnrollmentListItem[]>([]);
  const [pending, setPending] = useState<EnrollmentListItem[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentHits, setStudentHits] = useState<Array<{ id: string; name: string }>>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<EnrollmentListItem | null>(null);
  const [commentTarget, setCommentTarget] = useState<EnrollmentListItem | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeResult, pendingResult] = await Promise.all([
        fetchEnrollments({ page: 1, pageSize: 100, status: 'ACTIVE' }),
        fetchEnrollments({ page: 1, pageSize: 100, status: 'PENDING' }),
      ]);
      setEnrolled(activeResult.data);
      setPending(pendingResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchGroups({ pageSize: 100 }).then((res) =>
      setGroups(res.data.map((group) => ({ id: group.id, name: group.name }))),
    );
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    const handle = window.setTimeout(() => {
      setSearchingStudents(true);
      void fetchStudents({ search: studentQuery.trim() || undefined, pageSize: 20 })
        .then((res) => setStudentHits(res.data.map((student) => ({ id: student.id, name: student.fullName }))))
        .catch(() => setStudentHits([]))
        .finally(() => setSearchingStudents(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [createOpen, studentQuery]);

  function openCreate() {
    setForm(emptyForm());
    setStudentQuery('');
    setStudentHits([]);
    setSearchingStudents(true);
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setCreateError(null);
    setSaving(true);
    try {
      await createEnrollment({
        studentId: form.studentId,
        groupId: form.groupId,
        startDate: form.startDate,
        agreedMonthlyPrice: Number(form.agreedMonthlyPrice),
        billingEnabled: form.billingEnabled,
        status: form.waiting ? 'PENDING' : 'ACTIVE',
        notes: form.waiting ? form.comment.trim() : undefined,
      });
      setCreateOpen(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not enroll the student');
    } finally {
      setSaving(false);
    }
  }

  async function handleStart(enrollment: EnrollmentListItem) {
    setActionError(null);
    try {
      await updateEnrollment(enrollment.id, { status: 'ACTIVE' });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start this enrollment');
    }
  }

  async function handleSaveComment() {
    if (!commentTarget) return;
    setActionError(null);
    try {
      await updateEnrollment(commentTarget.id, { notes: commentDraft.trim(), status: 'PENDING' });
      setCommentTarget(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save the comment');
    }
  }

  async function handleWithdraw() {
    if (!withdrawTarget) return;
    await withdrawEnrollment(withdrawTarget.id);
    setWithdrawTarget(null);
    await load();
  }

  if (!canManage && !hasPermission(user, 'enrollments.read')) {
    return <EmptyState title="Access restricted" description="You do not have permission to view enrollments." />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enrollments</h1>
          <p className="text-sm text-muted-foreground">
            Enroll a student into a group, or keep them waiting until they start.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Enroll student
          </Button>
        ) : null}
      </div>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load enrollments" description={error} onRetry={() => void load()} />
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-medium">Pending</h2>
              <p className="text-sm text-muted-foreground">Students who are waiting or have not started yet.</p>
            </div>
            {pending.length === 0 ? (
              <EmptyState title="No one is waiting" description="Add a student here when they have not started yet." />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Group</th>
                      <th className="px-4 py-3 font-medium">Course</th>
                      <th className="px-4 py-3 font-medium">Planned start</th>
                      <th className="px-4 py-3 font-medium">Why they are waiting</th>
                      {canManage ? <th className="px-4 py-3 font-medium">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b last:border-0 align-top">
                        <td className="px-4 py-3">
                          <Link href={`/students/${enrollment.studentId}`} className="hover:underline">
                            {enrollment.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/groups/${enrollment.groupId}`} className="hover:underline">
                            {enrollment.groupName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{enrollment.courseName}</td>
                        <td className="px-4 py-3">{enrollment.startDate}</td>
                        <td className="max-w-xs px-4 py-3 text-muted-foreground">{enrollment.notes}</td>
                        {canManage ? (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <Button variant="ghost" size="sm" onClick={() => void handleStart(enrollment)}>
                                Start
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCommentTarget(enrollment);
                                  setCommentDraft(enrollment.notes ?? '');
                                }}
                              >
                                Comment
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setWithdrawTarget(enrollment)}>
                                Remove
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Enrolled</h2>
            {enrolled.length === 0 ? (
              <EmptyState title="No active enrollments" description="Students appear here once they start." />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Group</th>
                      <th className="px-4 py-3 font-medium">Course</th>
                      <th className="px-4 py-3 font-medium">Start</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      {canManage ? (
                        <>
                          <th className="px-4 py-3 font-medium">Price/mo</th>
                          <th className="px-4 py-3 font-medium">Billing</th>
                          <th className="px-4 py-3 font-medium">Actions</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {enrolled.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/students/${enrollment.studentId}`} className="hover:underline">
                            {enrollment.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/groups/${enrollment.groupId}`} className="hover:underline">
                            {enrollment.groupName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{enrollment.courseName}</td>
                        <td className="px-4 py-3">{enrollment.startDate}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">Active</Badge>
                        </td>
                        {canManage ? (
                          <>
                            <td className="px-4 py-3">
                              {enrollment.agreedMonthlyPrice ? `€${enrollment.agreedMonthlyPrice}` : '—'}
                            </td>
                            <td className="px-4 py-3">{enrollment.billingEnabled ? 'On' : 'Off'}</td>
                            <td className="px-4 py-3">
                              <Button variant="ghost" size="sm" onClick={() => setWithdrawTarget(enrollment)}>
                                Withdraw
                              </Button>
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Enroll student</DialogTitle>
          <DialogDescription>
            Search for the student, then start them now or leave them waiting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="student-search">Student</Label>
            {form.studentId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{form.studentName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, studentId: '', studentName: '' }))}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="student-search"
                  placeholder="Search by name, email, or phone"
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  autoComplete="off"
                />
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {searchingStudents ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                  ) : studentHits.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No students match that search.</p>
                  ) : (
                    studentHits.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, studentId: student.id, studentName: student.name }))
                        }
                      >
                        {student.name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="enroll-group">Group</Label>
            <Select
              id="enroll-group"
              value={form.groupId}
              onChange={(event) => setForm((prev) => ({ ...prev, groupId: event.target.value }))}
            >
              <option value="">Select group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="enroll-date">{form.waiting ? 'Planned start' : 'Start date'}</Label>
            <Input
              id="enroll-date"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </div>
          <Input
            type="number"
            placeholder="Monthly price"
            value={form.agreedMonthlyPrice}
            onChange={(event) => setForm((prev) => ({ ...prev, agreedMonthlyPrice: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.billingEnabled}
              onChange={(event) => setForm((prev) => ({ ...prev, billingEnabled: event.target.checked }))}
            />
            Billing enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.waiting}
              onChange={(event) => setForm((prev) => ({ ...prev, waiting: event.target.checked }))}
            />
            Waiting to start
          </label>
          {form.waiting ? (
            <div className="space-y-1">
              <Label htmlFor="pending-comment">Why they are waiting</Label>
              <Textarea
                id="pending-comment"
                placeholder="For example: waiting for a laptop, or the course starts next month"
                value={form.comment}
                onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
              />
            </div>
          ) : null}
          {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={
              saving ||
              !form.studentId ||
              !form.groupId ||
              !form.agreedMonthlyPrice ||
              (form.waiting && !form.comment.trim())
            }
          >
            {form.waiting ? 'Add to pending' : 'Enroll'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(commentTarget)} onOpenChange={() => setCommentTarget(null)}>
        <DialogHeader>
          <DialogTitle>Waiting comment</DialogTitle>
          <DialogDescription>
            Why is {commentTarget?.studentName} still waiting to start {commentTarget?.groupName}?
          </DialogDescription>
        </DialogHeader>
        <Textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setCommentTarget(null)}>
            Cancel
          </Button>
          <Button disabled={!commentDraft.trim()} onClick={() => void handleSaveComment()}>
            Save
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(withdrawTarget)} onOpenChange={() => setWithdrawTarget(null)}>
        <DialogHeader>
          <DialogTitle>{withdrawTarget?.status === 'PENDING' ? 'Remove from pending' : 'Withdraw enrollment'}</DialogTitle>
          <DialogDescription>
            {withdrawTarget?.status === 'PENDING' ? 'Remove' : 'Withdraw'} {withdrawTarget?.studentName} from{' '}
            {withdrawTarget?.groupName}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setWithdrawTarget(null)}>
            Cancel
          </Button>
          <Button onClick={() => void handleWithdraw()}>Confirm</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
