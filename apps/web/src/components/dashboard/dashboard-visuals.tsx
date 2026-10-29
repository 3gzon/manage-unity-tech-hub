'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function VerticalBars({
  items,
  activeLabel,
  onSelect,
}: {
  items: Array<{ label: string; value: number }>;
  activeLabel?: string | null;
  onSelect?: (label: string) => void;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="flex h-48 items-end gap-2">
      {items.map((item, index) => {
        const active = !activeLabel || activeLabel === item.label;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect?.(item.label)}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="text-[11px] font-semibold text-slate-500">{item.value}</span>
            <span
              className={cn(
                'w-full max-w-9 origin-bottom rounded-t-2xl transition-all duration-500',
                active ? 'bg-[#03FE94] group-hover:bg-[#02cb78]' : 'bg-[#03FE94]/25',
              )}
              style={{
                height: `${Math.max(item.value === 0 ? 8 : 14, (item.value / max) * 128)}px`,
                transitionDelay: `${index * 35}ms`,
              }}
            />
            <span className="text-[10px] font-medium text-slate-400">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ShareBars({
  items,
}: {
  items: Array<{ id: string; label: string; meta: string; value: number; display: string; color: string }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="group">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-[#020D23]">{item.label}</p>
              <p className="truncate text-xs text-slate-400">{item.meta}</p>
            </div>
            <p className="shrink-0 font-semibold text-[#020D23]">{item.display}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700 group-hover:brightness-110"
              style={{ width: `${Math.max(8, (item.value / max) * 100)}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FlowLine({ values, stroke = '#03FE94' }: { values: number[]; stroke?: string }) {
  const gradientId = useId().replace(/:/g, '');
  if (values.length < 2) {
    return <p className="py-8 text-center text-sm text-slate-400">Not enough points for a trend yet.</p>;
  }

  const width = 320;
  const height = 128;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = width / (values.length - 1);
  const coords = values.map((value, index) => {
    const x = index * step;
    const y = height - 12 - ((value - min) / span) * (height - 28);
    return { x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `M ${line} L ${width},${height} L 0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={index === coords.length - 1 ? 5 : 3} fill={stroke}>
          <title>{values[index]}</title>
        </circle>
      ))}
    </svg>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayLabel(sessionDate: string) {
  const date = new Date(`${sessionDate}T12:00:00`);
  return WEEKDAYS[date.getDay()] ?? 'Sun';
}

export function weekdayCounts(dates: string[]) {
  const counts = new Map(WEEKDAYS.map((day) => [day, 0]));
  for (const sessionDate of dates) {
    const label = weekdayLabel(sessionDate);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return WEEKDAYS.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}
