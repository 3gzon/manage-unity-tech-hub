import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TONES = {
  rose: { card: 'bg-[#ffe8ee]', icon: 'bg-white text-[#e11d48]' },
  sand: { card: 'bg-[#fff4d6]', icon: 'bg-white text-[#b45309]' },
  mint: { card: 'bg-[#e5f8ee]', icon: 'bg-white text-[#047857]' },
  lilac: { card: 'bg-[#eee7ff]', icon: 'bg-white text-[#6d28d9]' },
  sky: { card: 'bg-[#e6fff5]', icon: 'bg-white text-[#020D23]' },
  peach: { card: 'bg-[#ffe8dc]', icon: 'bg-white text-[#c2410c]' },
} as const;

export type MetricTone = keyof typeof TONES;

export function MetricCard({
  title,
  value,
  icon: Icon,
  tone = 'sky',
  hint,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: MetricTone;
  hint?: string;
}) {
  const colors = TONES[tone];

  return (
    <div
      className={cn(
        'dash-rise rounded-3xl p-4 shadow-[0_8px_24px_rgb(15_23_42/0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgb(15_23_42/0.08)]',
        colors.card,
      )}
    >
      <div className={cn('mb-5 flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm', colors.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold tracking-tight text-[#020D23]">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{title}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card className="rounded-3xl">
      <CardHeader className="pb-2">
        <Skeleton className="h-10 w-10 rounded-2xl" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="mt-2 h-4 w-28" />
      </CardContent>
    </Card>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-700">{title}</p>
      <p className="mt-1 text-sm text-red-600">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm hover:bg-red-50"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
