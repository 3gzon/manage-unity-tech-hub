'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { CourseDetail, CourseStatus, GroupListItem } from '@unity/types';
import { fetchCourse, fetchGroups, updateCourse } from '@/lib/academics-api';
import { hasPermission, isAdminPortalUser } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';

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

const STATUSES: CourseStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export function CourseProfileContent() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canRead = hasPermission(user, 'courses.read');
  const canManage = hasPermission(user, 'courses.manage');
  const isAdmin = isAdminPortalUser(user);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    category: 'OTHER' as CourseDetail['category'],
    ageMin: '',
    ageMax: '',
    durationMonths: '',
    defaultMonthlyPrice: '',
    status: 'DRAFT' as CourseStatus,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, groupResponse] = await Promise.all([
        fetchCourse(params.id),
        fetchGroups({
          page: 1,
          pageSize: 100,
          courseId: params.id,
        }),
      ]);
      setCourse(detail);
      setGroups(groupResponse.data);
      setForm({
        name: detail.name,
        code: detail.code,
        description: detail.description ?? '',
        category: detail.category,
        ageMin: detail.ageMin != null ? String(detail.ageMin) : '',
        ageMax: detail.ageMax != null ? String(detail.ageMax) : '',
        durationMonths: detail.durationMonths != null ? String(detail.durationMonths) : '',
        defaultMonthlyPrice: detail.defaultMonthlyPrice ?? '',
        status: detail.status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  async function handleSave() {
    if (!course) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCourse(course.id, {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        category: form.category,
        ageMin: form.ageMin ? Number(form.ageMin) : undefined,
        ageMax: form.ageMax ? Number(form.ageMax) : undefined,
        durationMonths: form.durationMonths ? Number(form.durationMonths) : undefined,
        defaultMonthlyPrice: form.defaultMonthlyPrice ? Number(form.defaultMonthlyPrice) : undefined,
        status: form.status,
      });
      setCourse(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save course');
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) {
    return <EmptyState title="Access restricted" description="You do not have permission to view courses." />;
  }

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error && !course) {
    return <ErrorState title="Course unavailable" description={error} onRetry={() => void load()} />;
  }
  if (!course) {
    return <ErrorState title="Course unavailable" description="Not found" onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/courses" className="text-sm text-muted-foreground hover:underline">
          ← Back to courses
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{course.name}</h1>
          <Badge variant="outline">{course.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {course.code} · {course.category.replace(/_/g, ' ')}
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {canManage ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-lg font-medium">Course details</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            </Field>
            <Field label="Code">
              <Input value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))} />
            </Field>
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm((current) => ({ ...current, category: e.target.value as CourseDetail['category'] }))
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as CourseStatus }))}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Age min">
              <Input
                type="number"
                min={0}
                value={form.ageMin}
                onChange={(e) => setForm((current) => ({ ...current, ageMin: e.target.value }))}
              />
            </Field>
            <Field label="Age max">
              <Input
                type="number"
                min={0}
                value={form.ageMax}
                onChange={(e) => setForm((current) => ({ ...current, ageMax: e.target.value }))}
              />
            </Field>
            <Field label="Duration (months)">
              <Input
                type="number"
                min={1}
                value={form.durationMonths}
                onChange={(e) => setForm((current) => ({ ...current, durationMonths: e.target.value }))}
              />
            </Field>
            <Field label="Default monthly price (EUR)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.defaultMonthlyPrice}
                onChange={(e) => setForm((current) => ({ ...current, defaultMonthlyPrice: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            />
          </Field>
          <Button onClick={() => void handleSave()} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Info label="Age range" value={`${course.ageMin ?? '—'}–${course.ageMax ?? '—'}`} />
          <Info label="Duration" value={course.durationMonths ? `${course.durationMonths} months` : null} />
          <Info
            label="Default price / month"
            value={course.defaultMonthlyPrice ? `EUR ${course.defaultMonthlyPrice}` : null}
          />
          {course.description ? (
            <div className="rounded-xl border p-4 md:col-span-2">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="mt-1 text-sm">{course.description}</p>
            </div>
          ) : null}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Groups</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No groups for this course yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Instructor</th>
                  <th className="px-4 py-3 font-medium">Enrolled</th>
                  <th className="px-4 py-3 font-medium">Schedule</th>
                  <th className="px-4 py-3 font-medium">Status</th>
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
                    <td className="px-4 py-3">
                      {isAdmin && group.instructorId && group.instructorName ? (
                        <Link href={`/instructors/${group.instructorId}`} className="hover:underline">
                          {group.instructorName}
                        </Link>
                      ) : (
                        group.instructorName ?? '—'
                      )}
                    </td>
                    <td className="px-4 py-3">{group.enrolledCount}</td>
                    <td className="px-4 py-3">{group.scheduleSummary}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{group.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || '—'}</p>
    </div>
  );
}
