'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { GroupListItem, GroupListQuery, InstructorOption } from '@unity/types';
import { archiveGroup, createGroup, fetchCourses, fetchGroups } from '@/lib/academics-api';
import { fetchInstructorOptions } from '@/lib/instructors-api';
import { useAuth } from '@/lib/auth/auth-context';
import { hasPermission, isAdminPortalUser } from '@/lib/auth/authorization';
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

export function GroupsPageContent() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'groups.manage');
  const isAdmin = isAdminPortalUser(user);

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [query, setQuery] = useState<GroupListQuery>({ page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', courseId: '', instructorId: '', capacity: '' });
  const [archiveTarget, setArchiveTarget] = useState<GroupListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchGroups(query);
      setGroups(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchCourses({ pageSize: 100 }).then((res) => setCourses(res.data.map((c) => ({ id: c.id, name: c.name }))));
    if (canManage) {
      void fetchInstructorOptions()
        .then(setInstructors)
        .catch(() => setInstructors([]));
    }
  }, [canManage]);

  async function handleCreate() {
    await createGroup({
      name: form.name,
      courseId: form.courseId,
      instructorId: form.instructorId || null,
      capacity: form.capacity ? Number(form.capacity) : undefined,
    });
    setCreateOpen(false);
    setForm({ name: '', courseId: '', instructorId: '', capacity: '' });
    await load();
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    await archiveGroup(archiveTarget.id);
    setArchiveTarget(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isAdmin ? 'Groups' : 'My Groups'}</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Manage class groups, schedules, and instructors.' : 'Your assigned groups.'}
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add group
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
        <Input
          placeholder="Search groups..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setQuery((prev) => ({ ...prev, page: 1, search: (e.target as HTMLInputElement).value || undefined }));
            }
          }}
        />
        <Select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              status: (e.target.value as GroupListQuery['status']) || undefined,
            }))
          }
        >
          <option value="">All statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load groups" description={error} onRetry={() => void load()} />
      ) : groups.length === 0 ? (
        <EmptyState title="No groups found" description="Create a group or adjust filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Instructor</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">Enrolled</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage ? <th className="px-4 py-3 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/groups/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{group.courseName}</td>
                  <td className="px-4 py-3">{group.instructorName ?? '—'}</td>
                  <td className="px-4 py-3">{group.scheduleSummary}</td>
                  <td className="px-4 py-3">
                    {group.enrolledCount}
                    {group.capacity ? ` / ${group.capacity}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{group.status}</Badge>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(group)}>
                        Archive
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Page {meta.page} of {meta.totalPages} · {meta.total} groups
      </p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Add group</DialogTitle>
          <DialogDescription>Create a group linked to a course.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Group name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </Select>
          <Select
            value={form.instructorId}
            onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
          >
            <option value="">No instructor</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Capacity"
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={!form.name.trim() || !form.courseId}>
            Create
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={() => setArchiveTarget(null)}>
        <DialogHeader>
          <DialogTitle>Archive group</DialogTitle>
          <DialogDescription>Archive {archiveTarget?.name}?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setArchiveTarget(null)}>
            Cancel
          </Button>
          <Button onClick={() => void handleArchive()}>Confirm</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
