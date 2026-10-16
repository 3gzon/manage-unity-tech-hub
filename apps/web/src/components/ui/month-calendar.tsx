'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface MonthCalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: string[];
  marked?: string[];
  counts?: Record<string, number>;
  onSelect: (date: string) => void;
}

export function MonthCalendar({ month, onMonthChange, selected, marked = [], counts = {}, onSelect }: MonthCalendarProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = toDateInputValue(new Date());
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div className="w-full max-w-md rounded-xl border bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next month"
          onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;
          const date = toDateInputValue(new Date(year, monthIndex, day));
          const isSelected = selected.includes(date);
          const count = counts[date] ?? (marked.includes(date) ? 1 : 0);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-xl text-sm',
                isSelected ? 'bg-[#046bd2] text-white' : 'hover:bg-slate-50',
                date === today && !isSelected && 'ring-1 ring-[#046bd2]',
              )}
            >
              {day}
              {count > 1 ? (
                <span
                  className={cn(
                    'mt-0.5 rounded-full px-1.5 text-[10px] font-semibold leading-4',
                    isSelected ? 'bg-white/25 text-white' : 'bg-[#046bd2]/10 text-[#046bd2]',
                  )}
                >
                  {count}
                </span>
              ) : count === 1 ? (
                <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', isSelected ? 'bg-[#00FF88]' : 'bg-[#046bd2]')} />
              ) : (
                <span className="mt-0.5 h-1.5 w-1.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
