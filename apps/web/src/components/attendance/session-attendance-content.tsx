'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AttendanceStatus, SessionAttendanceResponse } from '@unity/types';
import { fetchSessionAttendance, updateSessionAttendance } from '@/lib/attendance-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

export function SessionAttendanceContent() {
  const params = useParams<{ sessionId: string }>();
  const [data, setData] = useState<SessionAttendanceResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
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
    setSaving(true);
    setError(null);
    try {
      const records = data.records.map((record) => ({
        studentId: record.studentId,
        status: markAllPresent ? ('PRESENT' as const) : draft[record.studentId] ?? 'ABSENT',
      }));
      const updated = await updateSessionAttendance(params.sessionId, { records, markAllPresent, completeSession });
      setData(updated);
      setDraft(Object.fromEntries(updated.records.map((record) => [record.studentId, record.status])));
      const absent = updated.records.filter((record) => record.status === 'ABSENT');
      setSaved(
        absent.length
          ? 'Attendance saved. Open WhatsApp for each student marked absent.'
          : 'Attendance saved.',
      );
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 text-center font-medium">Present</th>
              <th className="px-4 py-3 text-center font-medium">Absent</th>
              <th className="px-4 py-3 text-center font-medium">Late</th>
              <th className="px-4 py-3 text-center font-medium">Excused</th>
              <th className="px-4 py-3 font-medium">Stats</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {data.records.map((record) => (
              <tr key={record.studentId} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{record.studentName}</td>
                {STATUSES.map((status) => (
                  <td key={status} className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name={`attendance-${record.studentId}`}
                      checked={(draft[record.studentId] ?? record.status) === status}
                      onChange={() => setStatus(record.studentId, status)}
                      aria-label={`${record.studentName} ${status}`}
                    />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{record.statistics.attendancePercentage}%</Badge>
                    <span className="text-xs text-muted-foreground">
                      P{record.statistics.present} A{record.statistics.absent} L{record.statistics.late} E
                      {record.statistics.excused}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(draft[record.studentId] ?? record.status) === 'ABSENT' ? (
                    record.whatsappUrl ? (
                      <a
                        className="text-sm font-medium underline"
                        href={record.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {record.contactName ? `WhatsApp ${record.contactName}` : 'WhatsApp'}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Add a guardian phone</span>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
