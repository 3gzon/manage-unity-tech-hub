'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { CourseListItem, CourseListQuery } from '@unity/types';
import { archiveCourse, createCourse, fetchCourses } from '@/lib/academics-api';
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

const CATEGORIES = [
  'KIDS_PROGRAMMING',
  'WEB_DEVELOPMENT',
  'FULL_STACK',
  'AI_ENGINEERING',
  'DATA_ENGINEERING',
  'DESIGN',
  'ENGLISH',
  'SUPPLEMENTARY_EDUCATION',
  'OTHER',
] as const;

export function CoursesPageContent() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'courses.manage');

  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [query, setQuery] = useState<CourseListQuery>({ page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'OTHER' as const, defaultMonthlyPrice: '' });
  const [archiveTarget, setArchiveTarget] = useState<CourseListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCourses(query);
      setCourses(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    await createCourse({
      name: form.name,
      category: form.category,
      defaultMonthlyPrice: form.defaultMonthlyPrice ? Number(form.defaultMonthlyPrice) : undefined,
    });
    setCreateOpen(false);
    setForm({ name: '', category: 'OTHER', defaultMonthlyPrice: '' });
    await load();
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    await archiveCourse(archiveTarget.id);
    setArchiveTarget(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground">Manage course catalog and pricing.</p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add course
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
        <Input
          placeholder="Search courses..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setQuery((prev) => ({ ...prev, page: 1, search: (e.target as HTMLInputElement).value || undefined }));
            }
          }}
        />
        <Select
          value={query.category ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              category: (e.target.value as CourseListQuery['category']) || undefined,
            }))
          }
        >
          <option value="">All categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load courses" description={error} onRetry={() => void load()} />
      ) : courses.length === 0 ? (
        <EmptyState title="No courses found" description="Add a course to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Age range</th>
                <th className="px-4 py-3 font-medium">Price/mo</th>
                <th className="px-4 py-3 font-medium">Groups</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage ? <th className="px-4 py-3 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/courses/${course.id}`} className="hover:underline">
                      {course.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{course.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    {course.ageMin ?? '—'}–{course.ageMax ?? '—'}
                  </td>
                  <td className="px-4 py-3">{course.defaultMonthlyPrice ? `€${course.defaultMonthlyPrice}` : '—'}</td>
                  <td className="px-4 py-3">{course.activeGroupsCount}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{course.status}</Badge>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(course)}>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Add course</DialogTitle>
          <DialogDescription>Create a new course in the catalog.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Course name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Default monthly price"
            type="number"
            value={form.defaultMonthlyPrice}
            onChange={(e) => setForm({ ...form, defaultMonthlyPrice: e.target.value })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={!form.name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={() => setArchiveTarget(null)}>
        <DialogHeader>
          <DialogTitle>Archive course</DialogTitle>
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
