'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { GroupAttendanceResponse } from '@unity/types';
import { fetchGroupAttendance } from '@/lib/attendance-api';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { Skeleton } from '@/components/ui/skeleton';

function presenceLabel(inClass: boolean | null) {
  if (inClass === true) return 'In class';
  if (inClass === false) return 'Not in class';
  return 'Not marked';
}

export function GroupClassPresence({ groupId }: { groupId: string }) {
  const [data, setData] = useState<GroupAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchGroupAttendance(groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (error) return <ErrorState title="Unable to load class attendance" description={error} onRetry={() => void load()} />;
  if (!data?.students.length) {
    return <p className="text-sm text-muted-foreground">No enrolled students to show attendance for.</p>;
  }
  if (!data.sessions.length) {
    return <p className="text-sm text-muted-foreground">No classes have been scheduled for this group yet.</p>;
  }

  return (
    <div className="space-y-3">
      {data.students.map((student) => {
        const open = openStudentId === student.studentId;
        return (
          <div key={student.studentId} className="rounded-xl border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setOpenStudentId(open ? null : student.studentId)}
            >
              <div>
                <p className="font-medium">{student.studentName}</p>
                <p className="text-xs text-muted-foreground">
                  In class {student.classesAttended} of {student.classesHeld} classes
                </p>
              </div>
              <Badge variant="outline">
                {student.classesHeld === 0
                  ? '—'
                  : `${Math.round((student.classesAttended / student.classesHeld) * 100)}%`}
              </Badge>
            </button>
            {open ? (
              <div className="space-y-2 border-t px-4 py-3">
                {student.records.map((record) => (
                  <div key={record.sessionId} className="flex items-center justify-between text-sm">
                    <Link href={`/attendance/${record.sessionId}`} className="hover:underline">
                      {record.sessionDate} · {record.startTime}
                    </Link>
                    <Badge variant={record.inClass ? 'outline' : 'secondary'}>{presenceLabel(record.inClass)}</Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
