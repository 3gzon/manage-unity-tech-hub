'use client';

import { useEffect, useState } from 'react';
import type { BulkFeedbackEntry, BulkFeedbackResult, FeedbackRating, InstructorStudent } from '@unity/types';
import { bulkSendFeedback } from '@/lib/instructors-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';

const RATINGS: Array<{ value: FeedbackRating; label: string }> = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'SATISFACTORY', label: 'Satisfactory' },
  { value: 'NEEDS_SUPPORT', label: 'Needs support' },
];

const AREAS: Array<{ key: 'participation' | 'understanding' | 'practice' | 'attendance'; label: string }> = [
  { key: 'participation', label: 'Participation' },
  { key: 'understanding', label: 'Understanding' },
  { key: 'practice', label: 'Practice' },
  { key: 'attendance', label: 'Attendance' },
];

interface DraftEntry {
  studentId: string;
  groupId: string;
  email: string;
  overall: FeedbackRating;
  participation: FeedbackRating;
  understanding: FeedbackRating;
  practice: FeedbackRating;
  attendance: FeedbackRating;
  strengths: string;
  improvements: string;
  nextSteps: string;
}

function emptyDraft(student: InstructorStudent): DraftEntry {
  return {
    studentId: student.studentId,
    groupId: student.groupId,
    email: student.email ?? '',
    overall: 'GOOD',
    participation: 'GOOD',
    understanding: 'GOOD',
    practice: 'GOOD',
    attendance: 'GOOD',
    strengths: '',
    improvements: '',
    nextSteps: '',
  };
}

function currentPeriod() {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function BulkFeedbackDialog({
  instructorId,
  students,
  open,
  onOpenChange,
  onDone,
}: {
  instructorId: string;
  students: InstructorStudent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [period, setPeriod] = useState('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkFeedbackResult[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setPeriod(currentPeriod());
    setDrafts(students.map(emptyDraft));
    setCurrentIndex(0);
    setError(null);
    setResults(null);
    setSending(false);
  }, [open, students]);

  const draft = drafts[currentIndex];
  const student = students[currentIndex];

  function updateDraft(field: keyof DraftEntry, value: string) {
    setDrafts((prev) => prev.map((d, i) => (i === currentIndex ? { ...d, [field]: value } : d)));
  }

  function isEntryComplete(d: DraftEntry) {
    return d.email.trim() && d.strengths.trim() && d.improvements.trim() && d.nextSteps.trim();
  }

  const completedCount = drafts.filter(isEntryComplete).length;

  async function handleSendAll() {
    const entries: BulkFeedbackEntry[] = drafts.filter(isEntryComplete).map((d) => ({
      studentId: d.studentId,
      groupId: d.groupId,
      email: d.email.trim(),
      overall: d.overall,
      participation: d.participation,
      understanding: d.understanding,
      practice: d.practice,
      attendance: d.attendance,
      strengths: d.strengths.trim(),
      improvements: d.improvements.trim(),
      nextSteps: d.nextSteps.trim(),
    }));

    if (entries.length === 0) {
      setError('Fill at least one student\'s feedback before sending.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const result = await bulkSendFeedback(instructorId, { period: period.trim(), entries });
      setResults(result.results);
      if (result.failed === 0) {
        onOpenChange(false);
        onDone(`Feedback sent to ${result.sent} student${result.sent !== 1 ? 's' : ''}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send feedback');
    } finally {
      setSending(false);
    }
  }

  if (results) {
    const failures = results.filter((r) => r.error);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogHeader>
          <DialogTitle>Bulk feedback results</DialogTitle>
          <DialogDescription>
            {results.filter((r) => !r.error).length} sent, {failures.length} failed
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {results.map((r) => (
            <div key={r.studentId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{r.studentName}</span>
              {r.error ? (
                <span className="text-red-600">{r.error}</span>
              ) : (
                <span className="text-emerald-700">Sent to {r.sentTo}</span>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => { onOpenChange(false); onDone(`Feedback sent to ${results.filter((r) => !r.error).length} student${results.filter((r) => !r.error).length !== 1 ? 's' : ''}.`); }}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Give feedback to all students</DialogTitle>
        <DialogDescription>
          Step through each student. Fill the ratings and text, then send all at once.
          {students.length > 0 ? ` Student ${currentIndex + 1} of ${students.length}.` : ''}
        </DialogDescription>
      </DialogHeader>
      {draft && student ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{student.studentName}</p>
              <p className="text-sm text-muted-foreground">{student.courseName} · {student.groupName}</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              {completedCount}/{students.length} filled
            </span>
          </div>

          {currentIndex === 0 ? (
            <div className="space-y-1">
              <Label htmlFor="bulk-period">Period (shared for all)</Label>
              <Input id="bulk-period" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="bulk-email">Email</Label>
            <Input
              id="bulk-email"
              type="email"
              value={draft.email}
              onChange={(e) => updateDraft('email', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bulk-overall">Overall</Label>
            <RatingSelect id="bulk-overall" value={draft.overall} onChange={(v) => updateDraft('overall', v)} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {AREAS.map((area) => (
              <div key={area.key} className="space-y-1">
                <Label htmlFor={`bulk-${area.key}`}>{area.label}</Label>
                <RatingSelect
                  id={`bulk-${area.key}`}
                  value={draft[area.key]}
                  onChange={(v) => updateDraft(area.key, v)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="bulk-strengths">Strengths</Label>
            <Textarea id="bulk-strengths" rows={2} value={draft.strengths} onChange={(e) => updateDraft('strengths', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-improvements">What to improve</Label>
            <Textarea id="bulk-improvements" rows={2} value={draft.improvements} onChange={(e) => updateDraft('improvements', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-next">Next steps</Label>
            <Textarea id="bulk-next" rows={2} value={draft.nextSteps} onChange={(e) => updateDraft('nextSteps', e.target.value)} />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No students to give feedback to.</p>
      )}
      <DialogFooter>
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex >= students.length - 1}
              onClick={() => setCurrentIndex((i) => i + 1)}
            >
              Next student
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={sending || completedCount === 0 || !period.trim()}
              onClick={() => void handleSendAll()}
            >
              {sending ? 'Sending…' : `Send ${completedCount} feedback${completedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  );
}

function RatingSelect({ id, value, onChange }: { id: string; value: FeedbackRating; onChange: (v: FeedbackRating) => void }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value as FeedbackRating)}>
      {RATINGS.map((r) => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </Select>
  );
}
