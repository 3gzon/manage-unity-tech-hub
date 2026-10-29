'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { GroupListItem, TodayClassItem } from '@unity/types';
import { fetchGroups } from '@/lib/academics-api';
import { fetchTodayClasses } from '@/lib/attendance-api';
import { GroupClassPresence } from '@/components/attendance/group-class-presence';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Skeleton } from '@/components/ui/skeleton';

export function InstructorAttendanceContent() {
  const searchParams = useSearchParams();
  const requestedGroupId = searchParams.get('group');
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [today, setToday] = useState<TodayClassItem[]>([]);
  const [groupId, setGroupId] = useState<string | null>(requestedGroupId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupResponse, classes] = await Promise.all([
        fetchGroups({ page: 1, pageSize: 100 }),
        fetchTodayClasses().catch(() => [] as TodayClassItem[]),
      ]);
      setGroups(groupResponse.data);
      setToday(classes);
      setGroupId((current) => {
        const preferred = requestedGroupId ?? current;
        if (preferred && groupResponse.data.some((group) => group.id === preferred)) return preferred;
        return groupResponse.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your groups');
    } finally {
      setLoading(false);
    }
  }, [requestedGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = groups.find((group) => group.id === groupId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Students are listed down the side. Each class day is a column.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <ErrorState title="Attendance unavailable" description={error} onRetry={() => void load()} />
      ) : groups.length === 0 ? (
        <EmptyState title="No groups assigned" description="Attendance appears here once you are assigned to a group." />
      ) : (
        <>
          {groups.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => {
                const active = group.id === groupId;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setGroupId(group.id)}
                    className={
                      active
                        ? 'rounded-full bg-[#03FE94] px-4 py-2 text-sm font-medium text-white'
                        : 'rounded-full bg-white px-4 py-2 text-sm font-medium text-[#020D23] shadow-sm hover:bg-[#e7f1ff]'
                    }
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          {today.length > 0 ? (
            <p className="text-sm text-slate-500">
              Today:{' '}
              {today
                .map((item) => `${item.groupName} ${item.startTime.slice(0, 5)}–${item.endTime.slice(0, 5)}`)
                .join(' · ')}
            </p>
          ) : null}

          {selected ? (
            <section className="space-y-2">
              <div>
                <h2 className="text-lg font-medium text-[#020D23]">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.courseName}</p>
              </div>
              <GroupClassPresence groupId={selected.id} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
