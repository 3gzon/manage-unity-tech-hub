'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { MaterialDetail, MaterialTopicOption } from '@unity/types';
import { fetchCourses } from '@/lib/academics-api';
import { createMaterial, fetchMaterial, fetchMaterialTopics, updateMaterial } from '@/lib/materials-api';
import { MarkdownEditor } from '@/components/materials/markdown-editor';
import { titleFromMarkdown } from '@/components/materials/material-format';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label, Select } from '@/components/ui/input';

const NEW_TOPIC = '__new__';

export function MaterialEditorContent({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [topics, setTopics] = useState<MaterialTopicOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [topicChoice, setTopicChoice] = useState(NEW_TOPIC);
  const [topicTitle, setTopicTitle] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [lockedTopic, setLockedTopic] = useState<string | null>(null);
  const [lockedCourse, setLockedCourse] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCourses({ page: 1, pageSize: 100 })
      .then((response) => setCourses(response.data.map((course) => ({ id: course.id, name: course.name }))))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!courseId || mode === 'edit') return;
    void fetchMaterialTopics(courseId)
      .then((rows) => {
        setTopics(rows);
        setTopicChoice(NEW_TOPIC);
      })
      .catch(() => setTopics([]));
  }, [courseId, mode]);

  useEffect(() => {
    if (mode !== 'edit' || !params.id) return;
    void fetchMaterial(params.id)
      .then((material) => {
        setTitle(material.title);
        setBody(material.body);
        setLockedCourse(material.courseName);
        setLockedTopic(material.topicTitle);
        setCourseId(material.courseId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the material'))
      .finally(() => setLoading(false));
  }, [mode, params.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const saved: MaterialDetail =
        mode === 'edit' && params.id
          ? await updateMaterial(params.id, { title, body })
          : await createMaterial({
              courseId,
              topicId: topicChoice === NEW_TOPIC ? undefined : topicChoice,
              topicTitle: topicChoice === NEW_TOPIC ? topicTitle : undefined,
              title,
              body,
            });
      router.push(`/materials/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the material');
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading the lesson…</p>;
  if (mode === 'edit' && error && !title) return <ErrorState title="Could not load the lesson" description={error} />;

  const topicReady = mode === 'edit' || topicChoice !== NEW_TOPIC || topicTitle.trim().length >= 2;
  const canSave = title.trim().length >= 2 && body.trim().length > 0 && (mode === 'edit' || (courseId && topicReady));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/materials" className="text-sm text-[#046bd2]">
          Course materials
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {mode === 'edit' ? 'Edit lesson' : 'Contribute a lesson'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Saving sends this Markdown lesson for approval by two other instructors and a Super Admin.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {mode === 'edit' ? (
          <>
            <div className="space-y-1">
              <Label>Course</Label>
              <Input value={lockedCourse ?? ''} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Topic</Label>
              <Input value={lockedTopic ?? ''} readOnly />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label>Course</Label>
              <Select aria-label="Course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                <option value="">Select a course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Topic</Label>
              <Select aria-label="Topic" value={topicChoice} onChange={(event) => setTopicChoice(event.target.value)}>
                <option value={NEW_TOPIC}>New topic</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </Select>
            </div>
            {topicChoice === NEW_TOPIC ? (
              <div className="space-y-1 md:col-span-2">
                <Label>New topic name</Label>
                <Input
                  value={topicTitle}
                  placeholder="React JS"
                  onChange={(event) => setTopicTitle(event.target.value)}
                />
              </div>
            ) : null}
          </>
        )}
        <div className="space-y-1 md:col-span-2">
          <Label>Lesson title</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Components and props" />
        </div>
      </div>

      <MarkdownEditor
        value={body}
        onChange={setBody}
        onImported={(markdown, fileName) => {
          if (!title.trim()) setTitle(titleFromMarkdown(fileName, markdown));
        }}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button onClick={() => void handleSave()} disabled={!canSave || saving}>
          {saving ? 'Saving…' : mode === 'edit' ? 'Save and resubmit' : 'Submit for approval'}
        </Button>
        <Button variant="outline" asChild>
          <Link href={mode === 'edit' && params.id ? `/materials/${params.id}` : '/materials'}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
