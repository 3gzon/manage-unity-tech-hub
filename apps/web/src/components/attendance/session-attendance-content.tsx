'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AttendanceStatus, SessionAttendanceResponse } from '@unity/types';
import { fetchSessionAttendance, updateSessionAttendance } from '@/lib/attendance-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';

export function SessionAttendanceContent() {
  const params = useParams<{ sessionId: string }>();
  const [data, setData] = useState<SessionAttendanceResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSessionAttendance(params.sessionId);
      setData(response);
      setDraft(Object.fromEntries(response.records.map((r) => [r.studentId, r.status])));
      setReasons(Object.fromEntries(response.records.map((r) => [r.studentId, r.notes ?? ''])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [params.sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDraft((prev) => ({ ...prev, [studentId]: status }));
  }

  async function save(markAllPresent = false, completeSession = true) {
    if (!data) return;
    const missingReason = markAllPresent
      ? []
      : data.records.filter((record) => (draft[record.studentId] ?? record.status) === 'ABSENT' && !(reasons[record.studentId] ?? '').trim());
    if (missingReason.length) {
      setError(`Add a comment explaining why ${missingReason.map((record) => record.studentName).join(', ')} ${missingReason.length === 1 ? 'is' : 'are'} missing.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const records = data.records.map((record) => {
        const status = markAllPresent ? ('PRESENT' as const) : draft[record.studentId] ?? 'PRESENT';
        return {
          studentId: record.studentId,
          status,
          notes: status === 'ABSENT' ? reasons[record.studentId]?.trim() : undefined,
        };
      });
      const updated = await updateSessionAttendance(params.sessionId, { records, markAllPresent, completeSession });
      setData(updated);
      setDraft(Object.fromEntries(updated.records.map((record) => [record.studentId, record.status])));
      setReasons(Object.fromEntries(updated.records.map((record) => [record.studentId, record.notes ?? ''])));
      const emails = (updated.emailNotices ?? []).map((notice) => `${notice.studentName}: ${notice.detail}`).join(' ');
      setSaved(['Attendance saved.', emails].filter(Boolean).join(' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error && !data) {
    return <ErrorState title="Session unavailable" description={error} onRetry={() => void load()} />;
  }
  if (!data) return null;

  const { session } = data;
  const counts = data.records.reduce(
    (summary, record) => {
      const status = draft[record.studentId] ?? record.status;
      summary[status] += 1;
      return summary;
    },
    { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/attendance" className="text-sm text-muted-foreground hover:underline">
            ← Back to today&apos;s classes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{session.groupName}</h1>
          <p className="text-sm text-muted-foreground">
            {session.courseName} · {session.sessionDate} · {session.startTime}–{session.endTime}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void save(true)} disabled={saving}>
            Mark all present
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save attendance'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="secondary">Present {counts.PRESENT}</Badge>
        <Badge variant="secondary">Absent {counts.ABSENT}</Badge>
        <Badge variant="secondary">Late {counts.LATE}</Badge>
        <Badge variant="secondary">Excused {counts.EXCUSED}</Badge>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}

      <div className="space-y-3">
        {data.records.map((record) => {
          const status = draft[record.studentId] ?? record.status;
          const missingComment = status === 'ABSENT' && !(reasons[record.studentId] ?? '').trim();
          return (
            <div
              key={record.studentId}
              className={`rounded-xl border p-4 ${status === 'ABSENT' ? 'border-red-200 bg-red-50' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{record.studentName}</p>
                  <p className="text-xs text-muted-foreground">{record.statistics.attendancePercentage}% so far</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusButton
                    label="Here"
                    active={status === 'PRESENT'}
                    tone="present"
                    onClick={() => setStatus(record.studentId, 'PRESENT')}
                  />
                  <StatusButton
                    label="Missing"
                    active={status === 'ABSENT'}
                    tone="absent"
                    onClick={() => setStatus(record.studentId, 'ABSENT')}
                  />
                  <StatusButton
                    label="Late"
                    active={status === 'LATE'}
                    tone="other"
                    onClick={() => setStatus(record.studentId, 'LATE')}
                  />
                  <StatusButton
                    label="Excused"
                    active={status === 'EXCUSED'}
                    tone="other"
                    onClick={() => setStatus(record.studentId, 'EXCUSED')}
                  />
                </div>
              </div>
              {status === 'ABSENT' ? (
                <div className="mt-3 space-y-2">
                  <Input
                    aria-label={`Why ${record.studentName} is missing`}
                    placeholder="Why is this student missing?"
                    value={reasons[record.studentId] ?? ''}
                    className={missingComment ? 'border-red-500' : undefined}
                    onChange={(event) =>
                      setReasons((prev) => ({ ...prev, [record.studentId]: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {record.notifyEmails.length
                      ? `Absence email goes to ${record.notifyEmails.join(', ')}`
                      : 'No email address, so no absence email will be sent.'}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusButton({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'present' | 'absent' | 'other';
  onClick: () => void;
}) {
  const activeClass =
    tone === 'present' ? 'bg-emerald-600 text-white' : tone === 'absent' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium ${active ? activeClass : 'border bg-background'}`}
    >
      {label}
    </button>
  );
}
