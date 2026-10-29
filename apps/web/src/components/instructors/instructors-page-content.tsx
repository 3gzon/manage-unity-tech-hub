'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { InstructorListItem, InstructorListQuery } from '@unity/types';
import {
  archiveInstructor,
  createInstructor,
  fetchInstructors,
  updateInstructor,
} from '@/lib/instructors-api';
import { useAuth } from '@/lib/auth/auth-context';
import { hasPermission, isAdminPortalUser } from '@/lib/auth/authorization';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function accountLabel(status: InstructorListItem['accountStatus']) {
  if (status === 'PENDING') return 'Waiting to confirm';
  if (status === 'DISABLED') return 'Disabled';
  if (status === 'ACTIVE') return 'Confirmed';
  return 'No account';
}

function emptyForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  };
}

export function InstructorsPageContent() {
  const { user } = useAuth();
  const allowed = isAdminPortalUser(user) && hasPermission(user, 'instructors.read');
  const canManage = hasPermission(user, 'instructors.manage');

  const [query, setQuery] = useState<InstructorListQuery>({ page: 1, pageSize: 20 });
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorListItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<InstructorListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchInstructors(query);
      setInstructors(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instructors');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(instructor: InstructorListItem) {
    setEditing(instructor);
    setForm({
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      email: instructor.email,
      phone: instructor.phone ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
    };

    try {
      if (editing) {
        await updateInstructor(editing.id, payload);
        setNotice(null);
      } else {
        await createInstructor(payload);
        setNotice(`Instructor created. A confirmation email will be sent to ${payload.email} once email is configured.`);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save instructor';
      const isEmailError =
        message.toLowerCase().includes('smtp') ||
        message.toLowerCase().includes('not configured') ||
        message.toLowerCase().includes('email') ||
        message.toLowerCase().includes('could not be sent');
      if (!editing && isEmailError) {
        setNotice(`Instructor created, but the confirmation email could not be sent. Configure SMTP to enable emails.`);
        setFormOpen(false);
        setEditing(null);
        await load();
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await archiveInstructor(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive instructor');
      setArchiveTarget(null);
    }
  }

  if (!allowed) {
    return (
      <EmptyState
        title="Access restricted"
        description="Instructor profiles are available only to Super Admins and Admins."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Instructors</h1>
          <p className="text-sm text-muted-foreground">
            Add a name, email, and phone. A confirmation email goes to that address, and they choose a password there.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add instructor
          </Button>
        ) : null}
      </div>

      {notice ? (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            notice.toLowerCase().includes('could not') || notice.toLowerCase().includes('configure smtp')
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          }`}
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
        <Input
          placeholder="Search name, email, or phone"
          value={query.search ?? ''}
          onChange={(e) => setQuery((prev) => ({ ...prev, page: 1, search: e.target.value || undefined }))}
        />
        <Button variant="outline" onClick={() => setQuery({ page: 1, pageSize: 20 })}>
          Clear search
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load instructors" description={error} onRetry={() => void load()} />
      ) : instructors.length === 0 ? (
        <EmptyState title="No instructors found" description="Add an instructor profile to assign to groups." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Active Groups</th>
                <th className="px-4 py-3 font-medium">Hire Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((instructor) => (
                <tr key={instructor.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/instructors/${instructor.id}`} className="hover:underline">
                      {instructor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{instructor.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{accountLabel(instructor.accountStatus)}</Badge>
                  </td>
                  <td className="px-4 py-3">{instructor.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{instructor.activeGroupsCount}</Badge>
                  </td>
                  <td className="px-4 py-3">{instructor.hireDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Link href={`/instructors/${instructor.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                      {canManage ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(instructor)}>
                          Edit
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(instructor)}>
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {meta.page} of {meta.totalPages} · {meta.total} instructors
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit instructor' : 'Add instructor'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Name, email, and phone are enough.'
              : 'We email this address a link to confirm the account and choose a password.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>First name</Label>
            <Input
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Last name</Label>
            <Input
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </div>
          {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create instructor'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={() => setArchiveTarget(null)}>
        <DialogHeader>
          <DialogTitle>Archive instructor</DialogTitle>
          <DialogDescription>
            Archive {archiveTarget?.name}? They will no longer appear when assigning groups.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setArchiveTarget(null)}>
            Cancel
          </Button>
          <Button onClick={() => void handleArchive()}>Confirm archive</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
