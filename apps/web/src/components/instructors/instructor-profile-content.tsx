'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { InstructorDetail, InstructorStudent } from '@unity/types';
import { Download, Mail } from 'lucide-react';
import { fetchInstructor, fetchMyInstructor, sendInstructorReportEmail } from '@/lib/instructors-api';
import { getAccessToken } from '@/lib/auth/token-storage';
import { hasPermission, hasRole, isAdminPortalUser } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackHistory } from '@/components/instructors/feedback-history';
import { InstructorFeedbackDialog } from '@/components/instructors/instructor-feedback-dialog';

export function InstructorProfileContent({ self = false }: { self?: boolean }) {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const allowed = self
    ? hasRole(user, 'INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
    : isAdminPortalUser(user) && hasPermission(user, 'instructors.read');
  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackStudent, setFeedbackStudent] = useState<InstructorStudent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInstructor(self ? await fetchMyInstructor() : await fetchInstructor(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instructor');
    } finally {
      setLoading(false);
    }
  }, [params.id, self]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <EmptyState
        title="Access restricted"
        description={
          self
            ? 'Your instructor profile is available when you are signed in as an instructor.'
            : 'Instructor profiles are available only to Super Admins and Admins.'
        }
      />
    );
  }

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error || !instructor) {
    return <ErrorState title="Instructor unavailable" description={error ?? 'Not found'} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        {self ? null : (
          <p className="text-sm text-muted-foreground">
            <Link href="/instructors" className="hover:underline">
              Instructors
            </Link>
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold">{instructor.name}</h1>
        <p className="text-sm text-muted-foreground">{instructor.email}</p>
      </div>

      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">{notice}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Info label="Phone" value={instructor.phone} />
        <Info label="Active groups" value={String(instructor.activeGroupsCount)} />
      </div>

      {instructor.bio ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Bio</h2>
          <p className="rounded-xl border p-4 text-sm">{instructor.bio}</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-medium">Assigned groups</h2>
        {instructor.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No groups assigned yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Enrolled</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {instructor.groups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/groups/${group.id}`} className="hover:underline">
                        {group.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{group.courseName}</td>
                    <td className="px-4 py-3">{group.enrolledCount}</td>
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

      <section>
        <h2 className="mb-2 text-lg font-medium">Students</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Send one feedback PDF to a student. It covers the period, the overall result, participation, understanding,
          practice, attendance, strengths, what to improve, and the next steps.
        </p>
        {(instructor.students ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No students are assigned to this instructor yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(instructor.students ?? []).map((student) => (
                  <tr key={student.enrollmentId} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/students/${student.studentId}`} className="hover:underline">
                        {student.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{student.groupName}</td>
                    <td className="px-4 py-3">{student.courseName}</td>
                    <td className="px-4 py-3">{student.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{student.status === 'PENDING' ? 'Waiting' : 'Active'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setFeedbackStudent(student)}>
                        Give feedback
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Feedback sent</h2>
        <FeedbackHistory instructorId={instructor.id} showInstructor={false} />
      </section>

      <MonthlyReportSection instructorId={instructor.id} instructorName={instructor.name} />

      <InstructorFeedbackDialog
        instructorId={instructor.id}
        student={feedbackStudent}
        open={feedbackStudent !== null}
        onOpenChange={(open) => {
          if (!open) setFeedbackStudent(null);
        }}
        onSent={setNotice}
      />
    </div>
  );
}

function defaultDateRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(from), to: fmt(to) };
}

function MonthlyReportSection({ instructorId, instructorName }: { instructorId: string; instructorName: string }) {
  const defaults = defaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [downloading, setDownloading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  async function downloadPdf() {
    if (!fromDate || !toDate) return;
    setDownloading(true);
    try {
      const token = getAccessToken();
      if (!token) return;
      const params = new URLSearchParams({ fromDate, toDate });
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/instructors/${instructorId}/report/pdf?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = instructorName.replace(/\s+/g, '-');
      link.download = `Raport-${safeName}-${fromDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleSendEmail() {
    if (!emailAddress.trim() || !fromDate || !toDate) return;
    setEmailSending(true);
    setEmailNotice(null);
    try {
      await sendInstructorReportEmail(instructorId, fromDate, toDate, emailAddress.trim());
      setEmailNotice(`Email sent to ${emailAddress.trim()}.`);
    } catch (err) {
      setEmailNotice(err instanceof Error ? err.message : 'Could not send email');
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>Monthly report</CardTitle>
          <CardDescription>
            Generate a PDF report with groups, sessions, attendance, feedback, and compensation for any period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button variant="outline" disabled={downloading || !fromDate || !toDate} onClick={() => void downloadPdf()}>
              <Download className="mr-1.5 h-4 w-4" />
              {downloading ? 'Downloading…' : 'Download PDF'}
            </Button>
            <Button variant="outline" disabled={!fromDate || !toDate} onClick={() => { setEmailOpen(true); setEmailNotice(null); }}>
              <Mail className="mr-1.5 h-4 w-4" />
              Send Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={emailOpen} onOpenChange={(open) => { if (!open) { setEmailOpen(false); setEmailNotice(null); setEmailAddress(''); } }}>
        <DialogHeader>
          <DialogTitle>Send instructor report</DialogTitle>
          <DialogDescription>
            {instructorName} — {fromDate} to {toDate}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Email address</Label>
          <Input
            type="email"
            placeholder="recipient@example.com"
            value={emailAddress}
            onChange={(e) => { setEmailAddress(e.target.value); setEmailNotice(null); }}
          />
          {emailNotice ? (
            <p className={`text-sm ${emailNotice.includes('sent') ? 'text-emerald-700' : 'text-red-600'}`}>{emailNotice}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
          <Button disabled={emailSending || !emailAddress.trim()} onClick={() => void handleSendEmail()}>
            {emailSending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </Dialog>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  );
}
