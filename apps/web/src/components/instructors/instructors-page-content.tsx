'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { InstructorListItem, InstructorListQuery, InstructorLookups } from '@unity/types';
import {
  archiveInstructor,
  createInstructor,
  fetchInstructorLookups,
  fetchInstructors,
  updateInstructor,
} from '@/lib/instructors-api';
import { useAuth } from '@/lib/auth/auth-context';
import { hasPermission, hasRole } from '@/lib/auth/authorization';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function emptyForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    hireDate: '',
    userId: '',
  };
}

export function InstructorsPageContent() {
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN') && hasPermission(user, 'instructors.read');
  const canManage = hasPermission(user, 'instructors.manage');

  const [query, setQuery] = useState<InstructorListQuery>({ page: 1, pageSize: 20 });
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [lookups, setLookups] = useState<InstructorLookups>({ linkableUsers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorListItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<InstructorListItem | null>(null);

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

  const loadLookups = useCallback(async () => {
    try {
      setLookups(await fetchInstructorLookups());
    } catch {
      setLookups({ linkableUsers: [] });
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  useEffect(() => {
    if (!allowed) return;
    void loadLookups();
  }, [allowed, loadLookups]);

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
      bio: instructor.bio ?? '',
      hireDate: instructor.hireDate ?? '',
      userId: instructor.userId ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      bio: form.bio.trim() || undefined,
      hireDate: form.hireDate || undefined,
      userId: form.userId || null,
    };

    try {
      if (editing) {
        await updateInstructor(editing.id, payload);
      } else {
        await createInstructor(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await Promise.all([load(), loadLookups()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save instructor');
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await archiveInstructor(archiveTarget.id);
      setArchiveTarget(null);
      await Promise.all([load(), loadLookups()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive instructor');
      setArchiveTarget(null);
    }
  }

  const linkableUsers = editing?.userId
    ? [
        { id: editing.userId, name: editing.userName ?? 'Linked user', email: editing.userEmail ?? '' },
        ...lookups.linkableUsers.filter((item) => item.id !== editing.userId),
      ]
    : lookups.linkableUsers;

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
            Create instructor profiles and assign them to groups. Link a login account when they need portal access.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add instructor
          </Button>
        ) : null}
      </div>

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
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Linked User</th>
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
                  <td className="px-4 py-3">{instructor.phone ?? '—'}</td>
                  <td className="px-4 py-3">{instructor.userName ?? '—'}</td>
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
            Instructor profiles are assigned to groups. Linking a user account controls portal access.
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
          <div className="space-y-1">
            <Label>Hire date</Label>
            <Input
              type="date"
              value={form.hireDate}
              onChange={(e) => setForm((prev) => ({ ...prev, hireDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Linked user</Label>
            <Select
              value={form.userId}
              onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
            >
              <option value="">None</option>
              {linkableUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.email})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Bio</Label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
          >
            {editing ? 'Save changes' : 'Create instructor'}
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
