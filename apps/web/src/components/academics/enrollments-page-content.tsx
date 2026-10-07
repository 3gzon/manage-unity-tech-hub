'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { EnrollmentListItem, EnrollmentListQuery } from '@unity/types';
import { createEnrollment, fetchEnrollments, fetchGroups, withdrawEnrollment } from '@/lib/academics-api';
import { fetchStudents } from '@/lib/students-api';
import { useAuth } from '@/lib/auth/auth-context';
import { hasPermission } from '@/lib/auth/authorization';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
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

export function EnrollmentsPageContent() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'enrollments.manage');

  const [enrollments, setEnrollments] = useState<EnrollmentListItem[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query] = useState<EnrollmentListQuery>({ page: 1, pageSize: 50 });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    groupId: '',
    startDate: new Date().toISOString().slice(0, 10),
    agreedMonthlyPrice: '',
    billingEnabled: true,
    notes: '',
  });
  const [withdrawTarget, setWithdrawTarget] = useState<EnrollmentListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEnrollments((await fetchEnrollments(query)).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchGroups({ pageSize: 100 }).then((res) =>
      setGroups(res.data.map((g) => ({ id: g.id, name: g.name }))),
    );
    void fetchStudents({ pageSize: 100 }).then((res) =>
      setStudents(res.data.map((s) => ({ id: s.id, name: s.fullName }))),
    );
  }, []);

  async function handleCreate() {
    await createEnrollment({
      studentId: form.studentId,
      groupId: form.groupId,
      startDate: form.startDate,
      agreedMonthlyPrice: Number(form.agreedMonthlyPrice),
      billingEnabled: form.billingEnabled,
      notes: form.notes || undefined,
    });
    setCreateOpen(false);
    await load();
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enrollments</h1>
          <p className="text-sm text-muted-foreground">Manage student group enrollments and billing.</p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Enroll student
          </Button>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load enrollments" description={error} onRetry={() => void load()} />
      ) : enrollments.length === 0 ? (
        <EmptyState title="No enrollments found" description="Enroll a student into a group." />
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
              {enrollments.map((enrollment) => (
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
                    <Badge variant="outline">{enrollment.status}</Badge>
                  </td>
                  {canManage ? (
                    <>
                      <td className="px-4 py-3">{enrollment.agreedMonthlyPrice ? `€${enrollment.agreedMonthlyPrice}` : '—'}</td>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Enroll student</DialogTitle>
          <DialogDescription>Assign a student to a group with billing settings.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
            <option value="">Select group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Input
            type="number"
            placeholder="Monthly price"
            value={form.agreedMonthlyPrice}
            onChange={(e) => setForm({ ...form, agreedMonthlyPrice: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.billingEnabled}
              onChange={(e) => setForm({ ...form, billingEnabled: e.target.checked })}
            />
            Billing enabled
          </label>
          <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!form.studentId || !form.groupId || !form.agreedMonthlyPrice}
          >
            Enroll
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(withdrawTarget)} onOpenChange={() => setWithdrawTarget(null)}>
        <DialogHeader>
          <DialogTitle>Withdraw enrollment</DialogTitle>
          <DialogDescription>
            Withdraw {withdrawTarget?.studentName} from {withdrawTarget?.groupName}?
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
