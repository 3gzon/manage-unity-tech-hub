'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Upload } from 'lucide-react';
import type { StudentListItem, StudentListQuery, StudentStatus } from '@unity/types';
import { fetchInstructors } from '@/lib/instructors-api';
import { archiveStudent, createStudent, fetchStudentFilterOptions, fetchStudents } from '@/lib/students-api';
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
import { ImportStudentsDialog } from '@/components/students/import-students-dialog';
import { StudentForm } from '@/components/students/student-form';
import { toStudentRequest, type StudentFormValues } from '@/lib/schemas/student.schema';

function formatRegistrationDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function StudentsPageContent() {
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'students.create');
  const canArchive = hasPermission(user, 'students.archive');

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<StudentListQuery>({ page: 1, pageSize: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<StudentListItem | null>(null);
  const [filterOptions, setFilterOptions] = useState<{ courses: { id: string; name: string }[]; groups: { id: string; name: string; courseId: string }[] }>({
    courses: [],
    groups: [],
  });
  const [instructors, setInstructors] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void fetchStudentFilterOptions()
      .then(setFilterOptions)
      .catch(() => setFilterOptions({ courses: [], groups: [] }));
    void fetchInstructors({ page: 1, pageSize: 100 })
      .then((response) => setInstructors(response.data.map((instructor) => ({ id: instructor.id, name: instructor.name }))))
      .catch(() => setInstructors([]));
  }, []);

  const filteredGroups = query.courseId
    ? filterOptions.groups.filter((group) => group.courseId === query.courseId)
    : filterOptions.groups;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchStudents(query);
      setStudents(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(values: StudentFormValues) {
    await createStudent(toStudentRequest(values));
    setCreateOpen(false);
    await load();
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    await archiveStudent(archiveTarget.id);
    setArchiveTarget(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">Manage student records and guardians.</p>
        </div>
        {canCreate ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add student
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3 lg:grid-cols-7">
        <div className="relative md:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setQuery((prev) => ({ ...prev, page: 1, search: searchInput || undefined }));
              }
            }}
          />
        </div>
        <Select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              status: (e.target.value as StudentStatus) || undefined,
            }))
          }
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="PAUSED">Paused</option>
          <option value="GRADUATED">Graduated</option>
        </Select>
        <Select
          value={query.courseId ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              courseId: e.target.value || undefined,
              groupId: undefined,
            }))
          }
        >
          <option value="">All courses</option>
          {filterOptions.courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Select>
        <Select
          value={query.groupId ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              groupId: e.target.value || undefined,
            }))
          }
        >
          <option value="">All groups</option>
          {filteredGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        <Select
          value={query.paymentStatus ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              paymentStatus: (e.target.value as StudentListQuery['paymentStatus']) || undefined,
            }))
          }
        >
          <option value="">All payment statuses</option>
          <option value="PAID">Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="NONE">None</option>
        </Select>
        <Button
          variant="outline"
          onClick={() => setQuery((prev) => ({ ...prev, page: 1, search: searchInput || undefined }))}
        >
          Apply filters
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load students" description={error} onRetry={() => void load()} />
      ) : students.length === 0 ? (
        <EmptyState title="No students found" description="Try adjusting filters or add a new student." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Guardian</th>
                <th className="px-4 py-3 font-medium">Active Course</th>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Registration date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/students/${student.id}`} className="hover:underline">
                      {student.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{student.age != null && student.age > 0 ? student.age : '—'}</td>
                  <td className="px-4 py-3">{student.phone ?? '—'}</td>
                  <td className="px-4 py-3">{student.guardianName ?? '—'}</td>
                  <td className="px-4 py-3">{student.activeCourse ?? '—'}</td>
                  <td className="px-4 py-3">{student.activeGroup ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{student.paymentStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{student.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{formatRegistrationDate(student.registrationDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/students/${student.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                      {canArchive ? (
                        <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(student)}>
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
          Page {meta.page} of {meta.totalPages} · {meta.total} students
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

      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Add student</DialogTitle>
          <DialogDescription>Create a new student record with optional guardians.</DialogDescription>
        </DialogHeader>
        <StudentForm
          instructors={instructors}
          onCancel={() => setCreateOpen(false)}
          onSubmit={handleCreate}
          submitLabel="Create student"
        />
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={() => setArchiveTarget(null)}>
        <DialogHeader>
          <DialogTitle>Archive student</DialogTitle>
          <DialogDescription>
            Archive {archiveTarget?.fullName}? This soft-deletes the record and sets status to inactive.
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
