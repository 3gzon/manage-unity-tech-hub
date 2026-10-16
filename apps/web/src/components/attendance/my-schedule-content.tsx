'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClassSessionListItem, GroupListItem } from '@unity/types';
import { fetchGroups } from '@/lib/academics-api';
import { createGroupSession, deleteGroupSession, fetchGroupSessions } from '@/lib/attendance-api';
import { DayClasses, sessionCounts } from '@/components/attendance/day-classes';
import { MonthCalendar, parseDateInput, toDateInputValue } from '@/components/ui/month-calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/dashboard/dashboard-states';

export function MyScheduleContent() {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pickedDate, setPickedDate] = useState(() => toDateInputValue(new Date()));
  const [sessions, setSessions] = useState<ClassSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchGroups({ page: 1, pageSize: 100 });
      setGroups(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const loadSessions = useCallback(async () => {
    if (groups.length === 0) {
      setSessions([]);
      return;
    }
    const fromDate = toDateInputValue(new Date(month.getFullYear(), month.getMonth(), 1));
    const toDate = toDateInputValue(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const responses = await Promise.all(
      groups.map((group) => fetchGroupSessions(group.id, { page: 1, pageSize: 100, fromDate, toDate })),
    );
    setSessions(responses.flatMap((response) => response.data));
  }, [groups, month]);

  useEffect(() => {
    void loadSessions().catch(() => setSessions([]));
  }, [loadSessions]);

  const daySessions = sessions.filter((session) => session.sessionDate.slice(0, 10) === pickedDate);

  async function saveClass(input: { groupId: string; sessionId?: string; startTime: string; endTime: string }) {
    await createGroupSession(input.groupId, {
      sessionId: input.sessionId,
      sessionDate: pickedDate,
      startTime: input.startTime,
      endTime: input.endTime,
    });
    await loadSessions();
  }

  async function removeClass(input: { groupId: string; sessionId: string }) {
    await deleteGroupSession(input.groupId, input.sessionId);
    await loadSessions();
  }

  if (loading) return <Skeleton className="h-80 w-full max-w-md" />;
  if (error) return <ErrorState title="Unable to load schedule" description={error} onRetry={() => void loadGroups()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">My Schedule</h1>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No group to schedule yet.</p>
      ) : (
        <>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={[pickedDate]}
            counts={sessionCounts(sessions)}
            onSelect={setPickedDate}
          />
          <DayClasses
            dateLabel={parseDateInput(pickedDate).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            sessions={daySessions}
            groups={groups.map((group) => ({ id: group.id, name: group.name }))}
            onSave={saveClass}
            onRemove={removeClass}
          />
        </>
      )}
    </div>
  );
}
