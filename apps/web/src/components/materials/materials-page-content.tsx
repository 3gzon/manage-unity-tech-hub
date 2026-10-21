'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { MaterialListQuery, MaterialTopicGroup } from '@unity/types';
import { fetchCourses } from '@/lib/academics-api';
import { fetchMaterials } from '@/lib/materials-api';
import { materialProgressText, materialStatusLabel } from '@/components/materials/material-format';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function MaterialsPageContent() {
  const [query, setQuery] = useState<MaterialListQuery>({});
  const [topics, setTopics] = useState<MaterialTopicGroup[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMaterials(query);
      setTopics(response.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load materials');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchCourses({ page: 1, pageSize: 100 })
      .then((response) => setCourses(response.data.map((course) => ({ id: course.id, name: course.name }))))
      .catch(() => setCourses([]));
  }, []);

  const pendingCount = topics.reduce(
    (count, topic) => count + topic.materials.filter((material) => material.status !== 'APPROVED').length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Course materials</h1>
          <p className="text-sm text-muted-foreground">
            Instructors contribute Markdown lessons. A lesson is published after two other instructors and a Super Admin approve it.
            {pendingCount > 0 ? ` ${pendingCount} waiting.` : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/materials/new">Contribute</Link>
        </Button>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
        <Select
          aria-label="Course"
          value={query.courseId ?? ''}
          onChange={(event) => setQuery({ ...query, courseId: event.target.value || undefined })}
        >
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          value={query.status ?? ''}
          onChange={(event) =>
            setQuery({
              ...query,
              status: (event.target.value as MaterialListQuery['status']) || undefined,
            })
          }
        >
          <option value="">All lessons</option>
          <option value="PENDING">Awaiting approval</option>
          <option value="APPROVED">Published</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Could not load materials" description={error} onRetry={() => void load()} />
      ) : topics.length === 0 ? (
        <EmptyState
          title="No materials yet"
          description="Contribute the first lesson for a topic such as React JS."
        />
      ) : (
        <div className="space-y-6">
          {topics.map((topic) => (
            <section key={topic.id} className="overflow-hidden rounded-xl border">
              <div className="border-b bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{topic.courseName}</p>
                <h2 className="text-lg font-semibold text-[#020D23]">{topic.title}</h2>
              </div>
              <ul>
                {topic.materials.map((material) => (
                  <li key={material.id} className="border-t first:border-t-0">
                    <Link href={`/materials/${material.id}`} className="block px-4 py-3 hover:bg-slate-50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-[#020D23]">{material.title}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {materialStatusLabel(material.status)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{material.excerpt || 'No preview yet'}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {material.authorName} · {materialProgressText(material.progress)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
