'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { FeedbackRating, InstructorStudent, SendStudentFeedbackRequest } from '@unity/types';
import { sendStudentFeedback } from '@/lib/instructors-api';
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
  { key: 'participation', label: 'Participation in class' },
  { key: 'understanding', label: 'Understanding of the material' },
  { key: 'practice', label: 'Practice and exercises' },
  { key: 'attendance', label: 'Attendance and punctuality' },
];

export function InstructorFeedbackDialog({
  instructorId,
  student,
  open,
  onOpenChange,
  onSent,
}: {
  instructorId: string;
  student: InstructorStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [period, setPeriod] = useState('');
  const [overall, setOverall] = useState<FeedbackRating>('GOOD');
  const [participation, setParticipation] = useState<FeedbackRating>('GOOD');
  const [understanding, setUnderstanding] = useState<FeedbackRating>('GOOD');
  const [practice, setPractice] = useState<FeedbackRating>('GOOD');
  const [attendance, setAttendance] = useState<FeedbackRating>('GOOD');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    setEmail(student.email ?? '');
    setPeriod(currentPeriod());
    setOverall('GOOD');
    setParticipation('GOOD');
    setUnderstanding('GOOD');
    setPractice('GOOD');
    setAttendance('GOOD');
    setStrengths('');
    setImprovements('');
    setNextSteps('');
    setError(null);
  }, [open, student]);

  const ratings = { participation, understanding, practice, attendance };

  async function handleSend() {
    if (!student) return;
    if (!email.trim() || !period.trim() || !strengths.trim() || !improvements.trim() || !nextSteps.trim()) {
      setError('Fill the email, period, strengths, what to improve, and next steps.');
      return;
    }
    const payload: SendStudentFeedbackRequest = {
      studentId: student.studentId,
      groupId: student.groupId,
      email: email.trim(),
      period: period.trim(),
      overall,
      participation,
      understanding,
      practice,
      attendance,
      strengths: strengths.trim(),
      improvements: improvements.trim(),
      nextSteps: nextSteps.trim(),
    };
    setSending(true);
    setError(null);
    try {
      const result = await sendStudentFeedback(instructorId, payload);
      onOpenChange(false);
      onSent(result.detail || `Feedback sent to ${result.sentTo}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the feedback');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Give feedback</DialogTitle>
        <DialogDescription>
          One report is emailed to the student as a PDF. It includes the result, the four areas, strengths, what to
          improve, and the next steps.
        </DialogDescription>
      </DialogHeader>
      {student ? (
        <div className="space-y-4">
          <div className="rounded-md border px-3 py-2 text-sm">
            <p className="font-medium">{student.studentName}</p>
            <p className="text-muted-foreground">
              {student.courseName} · {student.groupName}
              {student.status === 'PENDING' ? ' · Waiting to start' : ''}
            </p>
          </div>
          <Field label="Email" htmlFor="feedback-email">
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {student.email
                ? 'Filled from the student. Change it if the feedback should go somewhere else.'
                : 'No email is saved for this student. Type one to send the feedback.'}
            </p>
          </Field>
          <Field label="Period" htmlFor="feedback-period">
            <Input id="feedback-period" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </Field>
          <Field label="Overall result" htmlFor="feedback-overall">
            <RatingSelect id="feedback-overall" value={overall} onChange={setOverall} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {AREAS.map((area) => (
              <Field key={area.key} label={area.label} htmlFor={`feedback-${area.key}`}>
                <RatingSelect
                  id={`feedback-${area.key}`}
                  value={ratings[area.key]}
                  onChange={(value) => {
                    if (area.key === 'participation') setParticipation(value);
                    if (area.key === 'understanding') setUnderstanding(value);
                    if (area.key === 'practice') setPractice(value);
                    if (area.key === 'attendance') setAttendance(value);
                  }}
                />
              </Field>
            ))}
          </div>
          <Field label="Strengths" htmlFor="feedback-strengths">
            <Textarea id="feedback-strengths" value={strengths} onChange={(event) => setStrengths(event.target.value)} />
          </Field>
          <Field label="What to improve" htmlFor="feedback-improvements">
            <Textarea
              id="feedback-improvements"
              value={improvements}
              onChange={(event) => setImprovements(event.target.value)}
            />
          </Field>
          <Field label="Next steps" htmlFor="feedback-next">
            <Textarea id="feedback-next" value={nextSteps} onChange={(event) => setNextSteps(event.target.value)} />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button disabled={sending || !student} onClick={() => void handleSend()}>
          {sending ? 'Sending…' : 'Send PDF'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function RatingSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: FeedbackRating;
  onChange: (value: FeedbackRating) => void;
}) {
  return (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value as FeedbackRating)}>
      {RATINGS.map((rating) => (
        <option key={rating.value} value={rating.value}>
          {rating.label}
        </option>
      ))}
    </Select>
  );
}

function currentPeriod() {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
