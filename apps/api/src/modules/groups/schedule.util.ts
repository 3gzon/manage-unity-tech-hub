import { DAY_LABELS, type GroupScheduleEntry } from '@unity/types';

export function mapScheduleEntry(schedule: {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}): GroupScheduleEntry {
  return {
    id: schedule.id,
    dayOfWeek: schedule.dayOfWeek,
    dayLabel: DAY_LABELS[schedule.dayOfWeek] ?? `Day ${schedule.dayOfWeek}`,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  };
}

export function formatSchedulesLabel(
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
): string {
  if (!schedules.length) return 'No schedule';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return schedules
    .map((s) => `${days[s.dayOfWeek] ?? '?'} ${s.startTime}-${s.endTime}`)
    .join(', ');
}
