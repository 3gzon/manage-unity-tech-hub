'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, MessageSquare, X } from 'lucide-react';
import type { AttendanceStatus, GroupAttendanceResponse, GroupStudentAttendanceRecord } from '@unity/types';
import { fetchGroupAttendance, saveGroupAttendance } from '@/lib/attendance-api';
import { hasPermission } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { Skeleton } from '@/components/ui/skeleton';

type CellDraft = { status: AttendanceStatus | null; notes: string };
type CommentEditor = {
  sessionId: string;
  studentId: string;
  studentName: string;
  note: string;
  top: number;
  left: number;
};

function cellKey(sessionId: string, studentId: string) {
  return `${sessionId}:${studentId}`;
}

function toDraft(data: GroupAttendanceResponse) {
  const draft: Record<string, CellDraft> = {};
  for (const student of data.students) {
    for (const record of student.records) {
      draft[cellKey(record.sessionId, student.studentId)] = {
        status: record.status,
        notes: record.notes ?? '',
      };
    }
  }
  return draft;
}

function visualMark(status: AttendanceStatus | null) {
  if (status === 'PRESENT' || status === 'LATE') return 'check';
  if (status === 'ABSENT' || status === 'EXCUSED') return 'cross';
  return 'empty';
}

function cycleStatus(status: AttendanceStatus | null): AttendanceStatus | null {
  const mark = visualMark(status);
  if (mark === 'empty') return 'PRESENT';
  if (mark === 'check') return 'ABSENT';
  return null;
}

function monthKey(sessionDate: string) {
  return sessionDate.slice(0, 7);
}

function monthTitle(key: string) {
  const year = Number(key.slice(0, 4));
  const monthIndex = Number(key.slice(5, 7));
  return new Date(year, monthIndex - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function columnHeading(sessionDate: string, startTime: string, showTime: boolean) {
  const date = new Date(`${sessionDate}T12:00:00`);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: date.toLocaleDateString(undefined, { day: 'numeric' }),
    time: showTime ? startTime.slice(0, 5) : null,
  };
}

export function GroupClassPresence({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'attendance.manage');
  const [data, setData] = useState<GroupAttendanceResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, CellDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState<CommentEditor | null>(null);
  const [openMonths, setOpenMonths] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchGroupAttendance(groupId);
      setData(response);
      setDraft(toDraft(response));
      setComment(null);
      setOpenMonths(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(() => {
    const sessions = [...(data?.sessions ?? [])].sort(
      (left, right) => left.sessionDate.localeCompare(right.sessionDate) || left.startTime.localeCompare(right.startTime),
    );
    const perDay = new Map<string, number>();
    for (const session of sessions) perDay.set(session.sessionDate, (perDay.get(session.sessionDate) ?? 0) + 1);
    return sessions.map((session) => ({ ...session, showTime: (perDay.get(session.sessionDate) ?? 0) > 1 }));
  }, [data]);

  const months = useMemo(() => {
    const grouped = new Map<string, typeof columns>();
    for (const session of columns) {
      const key = monthKey(session.sessionDate);
      grouped.set(key, [...(grouped.get(key) ?? []), session]);
    }
    return [...grouped.entries()].map(([key, sessions]) => ({
      key,
      title: monthTitle(key),
      sessions,
      current: key === currentMonthKey(),
    }));
  }, [columns]);

  const openMonthKeys = openMonths ?? months.filter((month) => month.current).map((month) => month.key);

  function toggleMonth(key: string) {
    setOpenMonths((current) => {
      const list = current ?? months.filter((month) => month.current).map((month) => month.key);
      return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
    });
  }

  const dirtyKeys = useMemo(() => {
    if (!data) return [];
    const original = toDraft(data);
    return Object.keys(draft).filter((key) => {
      const current = draft[key];
      const saved = original[key];
      if (!current || !saved) return false;
      return current.status !== saved.status || current.notes.trim() !== saved.notes.trim();
    });
  }, [data, draft]);

  function updateCell(sessionId: string, studentId: string, patch: Partial<CellDraft>) {
    const key = cellKey(sessionId, studentId);
    setDraft((current) => ({
      ...current,
      [key]: { status: null, notes: '', ...current[key], ...patch },
    }));
  }

  function cycleCell(sessionId: string, studentId: string) {
    const key = cellKey(sessionId, studentId);
    const next = cycleStatus(draft[key]?.status ?? null);
    updateCell(sessionId, studentId, next === null ? { status: null, notes: '' } : { status: next });
  }

  async function save() {
    if (!data) return;
    const missing = dirtyKeys.flatMap((key) => {
      const cell = draft[key];
      if (!cell || cell.status !== 'ABSENT' || cell.notes.trim()) return [];
      const [sessionId, studentId] = key.split(':');
      const student = data.students.find((row) => row.studentId === studentId);
      const session = data.sessions.find((row) => row.sessionId === sessionId);
      return [`${student?.studentName ?? 'A student'} on ${session?.sessionDate ?? 'that day'}`];
    });
    if (missing.length) {
      setError(`Add a comment explaining why ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await saveGroupAttendance(groupId, {
        changes: dirtyKeys.map((key) => {
          const [sessionId, studentId] = key.split(':');
          const cell = draft[key] ?? { status: null, notes: '' };
          return {
            sessionId: sessionId ?? '',
            studentId: studentId ?? '',
            mark: cell.status ?? 'CLEAR',
            notes: cell.notes.trim(),
          };
        }),
      });
      setData(updated);
      setDraft(toDraft(updated));
      setComment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error && !data) return <ErrorState title="Unable to load class attendance" description={error} onRetry={() => void load()} />;
  if (!data?.students.length) {
    return <p className="text-sm text-muted-foreground">No enrolled students to show attendance for.</p>;
  }
  if (!columns.length) {
    return <p className="text-sm text-muted-foreground">No classes have been scheduled for this group yet.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-xs text-slate-500">
        <p>Click once for present, again for absent, and a third time to clear.</p>
        <p>Hover a cell and use the note icon to add a comment.</p>
      </div>
      {error ? <p className="px-1 pt-1 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-1">
      {months.map((month) => {
        const open = openMonthKeys.includes(month.key);
        return (
        <section key={month.key} id={`attendance-${month.key}`}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => toggleMonth(month.key)}
            className="flex items-center gap-2 rounded-xl px-1 py-2.5 text-left"
          >
            <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            <span className="text-sm font-semibold text-[#020D23]">{month.title}</span>
            <span className="text-xs text-slate-500">
              {month.sessions.length} {month.sessions.length === 1 ? 'class' : 'classes'}
              {month.current ? ' · This month' : ''}
            </span>
          </button>
          {open ? (
          <div className="overflow-x-auto">
            <table className="w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-56 bg-[#eef6f2] px-4 py-3 text-left font-medium text-slate-500">
                    Student
                  </th>
                  {month.sessions.map((session) => {
                    const heading = columnHeading(session.sessionDate, session.startTime, session.showTime);
                    return (
                      <th key={session.sessionId} className="w-16 px-1 py-2 text-center font-medium text-[#020D23]">
                        <span className="block text-xs text-slate-400">{heading.weekday}</span>
                        <span className="block text-sm">{heading.day}</span>
                        {heading.time ? <span className="block text-[10px] text-slate-400">{heading.time}</span> : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.students.map((student) => {
                  const stat = student.months.find((item) => item.month === month.key);
                  return (
                    <tr key={student.studentId}>
                      <th className="sticky left-0 z-10 w-56 bg-[#eef6f2] px-4 py-3 text-left font-medium text-[#020D23]">
                        <span className="block">{student.studentName}</span>
                        <span className="mt-1 block text-[11px] font-normal text-slate-400">
                          {stat && stat.held > 0 ? `${formatPercent(stat.percentage)} in class` : 'No classes yet'}
                        </span>
                      </th>
                      {month.sessions.map((session) => {
                        const record = student.records.find((item) => item.sessionId === session.sessionId);
                        const cell = draft[cellKey(session.sessionId, student.studentId)] ?? {
                          status: record?.status ?? null,
                          notes: record?.notes ?? '',
                        };
                        return (
                          <AttendanceCell
                            key={session.sessionId}
                            record={record}
                            status={cell.status}
                            notes={cell.notes}
                            canEdit={canEdit}
                            label={`${student.studentName}, ${session.sessionDate}`}
                            onCycle={() => cycleCell(session.sessionId, student.studentId)}
                            onComment={(anchor) =>
                              setComment({
                                sessionId: session.sessionId,
                                studentId: student.studentId,
                                studentName: student.studentName,
                                note: cell.notes,
                                top: anchor.bottom + 8,
                                left: Math.min(anchor.left, window.innerWidth - 280),
                              })
                            }
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : null}
        </section>
        );
      })}
      </div>
      {canEdit && dirtyKeys.length > 0 ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 px-1 py-3">
          <p className="text-sm text-slate-500">
            {dirtyKeys.length} unsaved {dirtyKeys.length === 1 ? 'change' : 'changes'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                if (!data) return;
                setDraft(toDraft(data));
                setComment(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      ) : null}
      {comment ? (
        <CommentPopup
          editor={comment}
          onChange={(note) => setComment((current) => (current ? { ...current, note } : current))}
          onCancel={() => setComment(null)}
          onSave={() => {
            updateCell(comment.sessionId, comment.studentId, { notes: comment.note });
            setComment(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AttendanceCell({
  record,
  status,
  notes,
  canEdit,
  label,
  onCycle,
  onComment,
}: {
  record?: GroupStudentAttendanceRecord;
  status: AttendanceStatus | null;
  notes: string;
  canEdit: boolean;
  label: string;
  onCycle: () => void;
  onComment: (anchor: DOMRect) => void;
}) {
  const mark = visualMark(status);
  const hasNote = notes.trim().length > 0;
  const markLabel = mark === 'check' ? 'present' : mark === 'cross' ? 'absent' : 'not marked';

  return (
    <td className="p-1 text-center">
      <div
        className={`group relative mx-auto flex h-12 w-14 items-center justify-center rounded-xl ${
          mark === 'check' ? 'bg-emerald-50' : mark === 'cross' ? 'bg-rose-50' : 'bg-slate-50/60'
        }`}
      >
        <button
          type="button"
          disabled={!canEdit}
          aria-label={`${label}, ${markLabel}${hasNote ? ', has a comment' : ''}${record ? '' : ''}. Click to change.`}
          onClick={onCycle}
          className="flex h-full w-full items-center justify-center rounded-xl disabled:cursor-default"
        >
          {mark === 'check' ? <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} /> : null}
          {mark === 'cross' ? <X className="h-4 w-4 text-rose-500" strokeWidth={2.5} /> : null}
        </button>
        {canEdit ? (
          <button
            type="button"
            aria-label={`Comment for ${label}`}
            onClick={(event) => onComment(event.currentTarget.getBoundingClientRect())}
            className={`absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition ${
              hasNote ? 'opacity-100 text-[#03FE94]' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <MessageSquare className="h-3 w-3" />
          </button>
        ) : hasNote ? (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#03FE94]" />
        ) : null}
      </div>
    </td>
  );
}

function CommentPopup({
  editor,
  onChange,
  onCancel,
  onSave,
}: {
  editor: CommentEditor;
  onChange: (note: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button type="button" aria-label="Close comment" className="fixed inset-0 z-40 cursor-default" onClick={onCancel} />
      <div
        role="dialog"
        aria-label={`Comment for ${editor.studentName}`}
        className="fixed z-50 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl"
        style={{ top: editor.top, left: Math.max(12, editor.left) }}
      >
        <p className="mb-2 text-sm font-medium text-[#020D23]">{editor.studentName}</p>
        <textarea
          autoFocus
          value={editor.note}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add a comment"
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#03FE94]/40 focus:ring-2 focus:ring-[#03FE94]/15"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
