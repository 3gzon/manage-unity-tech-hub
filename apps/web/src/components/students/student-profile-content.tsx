'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { StudentProfileResponse } from '@unity/types';
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
import { StudentForm } from '@/components/students/student-form';
import type { StudentFormValues } from '@/lib/schemas/student.schema';

export function StudentProfileContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = isAdminPortalUser(user);
  const canUpdate = hasPermission(user, 'students.update');
  const canArchive = hasPermission(user, 'students.archive');

  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [familyError, setFamilyError] = useState<string | null>(null);

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
  }, [canUpdate]);

  const tabs = isAdmin
    ? ['overview', 'enrollments', 'attendance', 'invoices', 'payments', 'certificates', 'notes']
    : ['overview', 'enrollments', 'attendance'];

  async function handleUpdate(values: StudentFormValues) {
    await updateStudent(params.id, {
      ...values,
      email: values.email || undefined,
      guardians: values.guardians?.map((g) => ({ ...g, email: g.email || undefined })),
    });
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
        <ListPanel
          empty="No enrollments"
          items={profile.enrollments.map((e) => `${e.courseName} · ${e.groupName} (${e.status})`)}
        />
      ) : null}

      {tab === 'attendance' ? (
        <ListPanel
          empty="No attendance records"
          items={profile.attendance.map((a) => `${a.sessionDate} · ${a.groupName} · ${a.status}`)}
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
          items={(profile.payments ?? []).map((p) => `${p.paymentDate} · €${p.amount} · ${p.method}`)}
        />
      ) : null}

      {isAdmin && tab === 'certificates' ? (
        <ListPanel
          empty="No certificates"
          items={(profile.certificates ?? []).map((c) => `${c.courseName} · ${c.certificateCode}`)}
        />
      ) : null}

      {tab === 'notes' ? (
        <div className="rounded-xl border p-4 text-sm">{student.notes || 'No notes yet.'}</div>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit student</DialogTitle>
          <DialogDescription>Update student details and guardians.</DialogDescription>
        </DialogHeader>
        <StudentForm
          defaultValues={{
            ...student,
            gender: student.gender ?? undefined,
            guardians: profile.guardians,
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
