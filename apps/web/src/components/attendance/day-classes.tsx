'use client';

import { useEffect, useState } from 'react';
import type { ClassSessionListItem } from '@unity/types';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';

export function sessionCounts(sessions: Array<{ sessionDate: string }>) {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    const date = session.sessionDate.slice(0, 10);
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return counts;
}

export function DayClasses({
  dateLabel,
  sessions,
  groups,
  groupId,
  canEdit = true,
  onSave,
  onRemove,
}: {
  dateLabel: string;
  sessions: ClassSessionListItem[];
  groups?: Array<{ id: string; name: string }>;
  groupId?: string;
  canEdit?: boolean;
  onSave: (input: { groupId: string; sessionId?: string; startTime: string; endTime: string }) => Promise<void>;
  onRemove: (input: { groupId: string; sessionId: string }) => Promise<void>;
}) {
  const ordered = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.groupName.localeCompare(b.groupName));

  return (
    <div className="max-w-md space-y-3">
      <p className="text-base font-semibold text-[#020D23]">{dateLabel}</p>
      {ordered.map((session) => (
        <SessionTimeRow
          key={session.id}
          session={session}
          showGroup={Boolean(groups)}
          canEdit={canEdit}
          onSave={onSave}
          onRemove={onRemove}
        />
      ))}
      {canEdit ? (
        <AddClassRow
          groups={groups}
          groupId={groupId}
          hasClasses={ordered.length > 0}
          onSave={onSave}
        />
      ) : ordered.length === 0 ? (
        <p className="text-sm text-slate-500">No class scheduled for this day.</p>
      ) : null}
    </div>
  );
}

function SessionTimeRow({
  session,
  showGroup,
  canEdit,
  onSave,
  onRemove,
}: {
  session: ClassSessionListItem;
  showGroup: boolean;
  canEdit: boolean;
  onSave: (input: { groupId: string; sessionId?: string; startTime: string; endTime: string }) => Promise<void>;
  onRemove: (input: { groupId: string; sessionId: string }) => Promise<void>;
}) {
  const [startTime, setStartTime] = useState(session.startTime.slice(0, 5));
  const [endTime, setEndTime] = useState(session.endTime.slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = !startTime || !endTime || startTime >= endTime;

  useEffect(() => {
    setStartTime(session.startTime.slice(0, 5));
    setEndTime(session.endTime.slice(0, 5));
  }, [session.id, session.startTime, session.endTime]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ groupId: session.groupId, sessionId: session.id, startTime, endTime });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this class');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      await onRemove({ groupId: session.groupId, sessionId: session.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this class');
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgb(15_23_42/0.05)]">
      {showGroup ? <p className="mb-3 text-sm font-semibold text-[#020D23]">{session.groupName}</p> : null}
      <TimeFields
        idPrefix={session.id}
        startTime={startTime}
        endTime={endTime}
        disabled={!canEdit || saving || removing}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
      />
      {invalid && startTime && endTime ? (
        <p className="mt-2 text-sm text-red-600">End time must be after the start time.</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={saving || removing || invalid} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Update class time'}
          </Button>
          <Button variant="outline" disabled={saving || removing} onClick={() => void remove()}>
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AddClassRow({
  groups,
  groupId,
  hasClasses,
  onSave,
}: {
  groups?: Array<{ id: string; name: string }>;
  groupId?: string;
  hasClasses: boolean;
  onSave: (input: { groupId: string; startTime: string; endTime: string }) => Promise<void>;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(groupId ?? groups?.[0]?.id ?? '');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = !startTime || !endTime || startTime >= endTime;
  const targetGroupId = groups ? selectedGroupId : groupId;

  useEffect(() => {
    if (groupId) {
      setSelectedGroupId(groupId);
      return;
    }
    setSelectedGroupId((current) => {
      if (groups?.some((group) => group.id === current)) return current;
      return groups?.[0]?.id ?? '';
    });
  }, [groupId, groups]);

  async function save() {
    if (!targetGroupId) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ groupId: targetGroupId, startTime, endTime });
      setStartTime('18:00');
      setEndTime('19:00');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule this class');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgb(15_23_42/0.05)]">
      <p className="mb-3 text-sm font-semibold text-[#020D23]">{hasClasses ? 'Add another class' : 'Schedule a class'}</p>
      {groups ? (
        <div className="mb-3 space-y-1">
          <Label htmlFor="add-class-group">Group</Label>
          <Select id="add-class-group" value={selectedGroupId} disabled={saving} onChange={(event) => setSelectedGroupId(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <TimeFields
        idPrefix="add-class"
        startTime={startTime}
        endTime={endTime}
        disabled={saving}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
      />
      {invalid && startTime && endTime ? (
        <p className="mt-2 text-sm text-red-600">End time must be after the start time.</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <Button className="mt-3" disabled={saving || invalid || !targetGroupId} onClick={() => void save()}>
        {saving ? 'Saving…' : hasClasses ? 'Add class' : 'Schedule class'}
      </Button>
    </div>
  );
}

function TimeFields({
  idPrefix,
  startTime,
  endTime,
  disabled,
  onStartTimeChange,
  onEndTimeChange,
}: {
  idPrefix: string;
  startTime: string;
  endTime: string;
  disabled?: boolean;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-start`}>Start</Label>
        <Input
          id={`${idPrefix}-start`}
          type="time"
          value={startTime}
          disabled={disabled}
          onChange={(event) => onStartTimeChange(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-end`}>End</Label>
        <Input
          id={`${idPrefix}-end`}
          type="time"
          value={endTime}
          disabled={disabled}
          onChange={(event) => onEndTimeChange(event.target.value)}
        />
      </div>
    </div>
  );
}
