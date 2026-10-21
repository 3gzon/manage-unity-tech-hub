'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { MaterialDetail } from '@unity/types';
import { commentOnMaterial, decideMaterial, deleteMaterial, fetchMaterial } from '@/lib/materials-api';
import { downloadMarkdown, materialProgressText, materialStatusLabel } from '@/components/materials/material-format';
import { MarkdownView } from '@/components/materials/markdown-view';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { Label, Textarea } from '@/components/ui/input';

export function MaterialDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      setMaterial(await fetchMaterial(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the material');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!material) return;
    setBusy(true);
    setError(null);
    try {
      setMaterial(await decideMaterial(material.id, { decision: 'APPROVED' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve');
    } finally {
      setBusy(false);
    }
  }

  async function postComment(kind: 'NOTE' | 'CHANGE') {
    if (!material) return;
    setBusy(true);
    setError(null);
    try {
      setMaterial(await commentOnMaterial(material.id, { body: comment, kind }));
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the comment');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!material) return;
    if (!window.confirm(`Remove “${material.title}”?`)) return;
    setBusy(true);
    try {
      await deleteMaterial(material.id);
      router.push('/materials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the material');
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading the lesson…</p>;
  if (!material) {
    return (
      <ErrorState
        title="Could not load the lesson"
        description={error ?? 'Material not found'}
        onRetry={() => void load()}
      />
    );
  }

  const published = material.publishedBody;
  const showDraft = material.status !== 'APPROVED';
  const fileBody = material.status === 'APPROVED' ? (published ?? material.body) : material.body;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/materials" className="text-sm text-[#046bd2]">
            Course materials
          </Link>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            {material.courseName} · {material.topicTitle}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#020D23]">{material.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {material.authorName} · {materialStatusLabel(material.status)} · {materialProgressText(material.progress)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadMarkdown(material.title, fileBody)}>
            Download .md
          </Button>
          {material.canEdit ? (
            <Button variant="outline" asChild>
              <Link href={`/materials/${material.id}/edit`}>Edit</Link>
            </Button>
          ) : null}
          {material.canDelete ? (
            <Button variant="outline" disabled={busy} onClick={() => void remove()}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold text-[#020D23]">Approval</h2>
        <p className="mt-1 text-sm text-slate-500">
          Two other instructors approve the lesson, and a Super Admin approves it as well. The author&apos;s own vote stays out.
          {material.progress.authorIsSuperAdmin
            ? ' This contribution already includes the Super Admin, so two instructors finish it.'
            : ''}
        </p>
        <ul className="mt-3 space-y-2">
          {material.reviews.length === 0 ? (
            <li className="text-sm text-slate-400">No reviews yet.</li>
          ) : (
            material.reviews.map((review) => (
              <li key={review.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-[#020D23]">{review.reviewerName}</span>
                <span className="text-slate-500">
                  {' '}
                  · {review.reviewerRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Instructor'} ·{' '}
                  {review.decision === 'APPROVED' ? 'Approved' : 'Changes requested'}
                </span>
              </li>
            ))
          )}
        </ul>
        {material.canApprove ? (
          <div className="mt-4">
            <Button disabled={busy} onClick={() => void approve()}>
              Approve
            </Button>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold text-[#020D23]">Comments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Instructors can leave a note, or describe what should change. Comments stay on the lesson after it is edited.
        </p>
        <ul className="mt-3 space-y-2">
          {material.comments.length === 0 ? (
            <li className="text-sm text-slate-400">No comments yet.</li>
          ) : (
            material.comments.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[#020D23]">{entry.authorName}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {entry.kind === 'CHANGE' ? 'What should change' : 'Comment'}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{entry.body}</p>
              </li>
            ))
          )}
        </ul>
        <div className="mt-4 space-y-2">
          <Label htmlFor="material-comment">Add a comment</Label>
          <Textarea
            id="material-comment"
            value={comment}
            placeholder="A suggestion, a question, or what should change."
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || comment.trim().length < 2} onClick={() => void postComment('NOTE')}>
              Post comment
            </Button>
            <Button disabled={busy || comment.trim().length < 2} onClick={() => void postComment('CHANGE')}>
              Ask for a change
            </Button>
          </div>
        </div>
      </section>

      {published && showDraft ? (
        <section className="rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#020D23]">Published version</h2>
          <MarkdownView markdown={published} />
        </section>
      ) : null}

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#020D23]">
          {showDraft && published ? 'Update awaiting approval' : 'Lesson'}
        </h2>
        <MarkdownView markdown={showDraft ? material.body : (published ?? material.body)} />
      </section>

      {material.siblings.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[#020D23]">More in {material.topicTitle}</h2>
          <ul className="divide-y rounded-xl border">
            {material.siblings.map((item) => (
              <li key={item.id}>
                <Link href={`/materials/${item.id}`} className="block px-4 py-3 hover:bg-slate-50">
                  <span className="font-medium">{item.title}</span>
                  <span className="ml-2 text-xs text-slate-400">{materialStatusLabel(item.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
