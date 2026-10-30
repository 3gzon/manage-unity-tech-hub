'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FeedbackRating, StudentFeedbackItem } from '@unity/types';
import { fetchFeedback, resendFeedbackEmail } from '@/lib/instructors-api';
import { getAccessToken } from '@/lib/auth/token-storage';
import { Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';

const RATING_LABELS: Record<FeedbackRating, string> = {
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  SATISFACTORY: 'Satisfactory',
  NEEDS_SUPPORT: 'Needs support',
};

export function FeedbackHistory({
  studentId,
  instructorId,
  showStudent = true,
  showInstructor = true,
  searchable = false,
}: {
  studentId?: string;
  instructorId?: string;
  showStudent?: boolean;
  showInstructor?: boolean;
  searchable?: boolean;
}) {
  const [rows, setRows] = useState<StudentFeedbackItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentFeedbackItem | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFeedback({
        page,
        pageSize: 20,
        search: searchable ? search.trim() || undefined : undefined,
        studentId,
        instructorId,
      });
      setRows(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [instructorId, page, search, searchable, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resendEmail(item: StudentFeedbackItem) {
    if (!emailAddress.trim()) return;
    setEmailSending(true);
    setEmailNotice(null);
    try {
      await resendFeedbackEmail(item.id, emailAddress.trim());
      setEmailNotice(`Email sent to ${emailAddress.trim()}.`);
    } catch (err) {
      setEmailNotice(err instanceof Error ? err.message : 'Could not send email');
    } finally {
      setEmailSending(false);
    }
  }

  async function download(item: StudentFeedbackItem) {
    setDownloadError(null);
    const token = getAccessToken();
    if (!token) return;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/feedback/${item.id}/pdf`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      setDownloadError('Could not download the PDF');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Vleresim-${item.studentName.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {searchable ? (
        <Input
          placeholder="Search student, instructor, group, or period"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      ) : null}
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load feedback" description={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                {showStudent ? <th className="px-4 py-3 font-medium">Student</th> : null}
                {showInstructor ? <th className="px-4 py-3 font-medium">Instructor</th> : null}
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Overall</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                  {showStudent ? <td className="px-4 py-3 font-medium">{item.studentName}</td> : null}
                  {showInstructor ? <td className="px-4 py-3">{item.instructorName}</td> : null}
                  <td className="px-4 py-3">
                    {item.groupName}
                    <span className="text-muted-foreground"> · {item.courseName}</span>
                  </td>
                  <td className="px-4 py-3">{item.period}</td>
                  <td className="px-4 py-3">{RATING_LABELS[item.overall]}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setDownloadError(null);
            setEmailNotice(null);
            setEmailAddress('');
          }
        }}
      >
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>{selected.studentName}</DialogTitle>
              <DialogDescription>
                {selected.courseName} · {selected.groupName} · {selected.period} · {selected.instructorName} ·{' '}
                {formatDate(selected.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                Sent to <span className="font-medium">{selected.sentTo}</span>
              </p>
              <RatingLine label="Overall" value={selected.overall} />
              <RatingLine label="Participation" value={selected.participation} />
              <RatingLine label="Understanding" value={selected.understanding} />
              <RatingLine label="Practice" value={selected.practice} />
              <RatingLine label="Attendance" value={selected.attendance} />
              <TextBlock title="Strengths" body={selected.strengths} />
              <TextBlock title="What to improve" body={selected.improvements} />
              <TextBlock title="Next steps" body={selected.nextSteps} />
              {downloadError ? <p className="text-sm text-red-600">{downloadError}</p> : null}

              <div className="space-y-2 border-t pt-3">
                <Label>Resend to email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={selected.sentTo}
                    value={emailAddress}
                    onChange={(e) => { setEmailAddress(e.target.value); setEmailNotice(null); }}
                  />
                  <Button
                    variant="outline"
                    disabled={emailSending || !emailAddress.trim()}
                    onClick={() => void resendEmail(selected)}
                  >
                    {emailSending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
                {emailNotice ? (
                  <p className={`text-sm ${emailNotice.includes('sent') ? 'text-emerald-700' : 'text-red-600'}`}>{emailNotice}</p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button onClick={() => void download(selected)}>Download PDF</Button>
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}

function RatingLine({ label, value }: { label: string; value: FeedbackRating }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {RATING_LABELS[value]}
    </p>
  );
}

function TextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-GB');
}
