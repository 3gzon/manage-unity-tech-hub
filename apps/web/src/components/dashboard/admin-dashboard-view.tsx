'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminDashboardResponse } from '@unity/types';
import { FileWarning, GraduationCap, TrendingUp, Users, Wallet } from 'lucide-react';
import { fetchAdminDashboard } from '@/lib/dashboard-api';
import { MetricCard, MetricCardSkeleton, PanelSkeleton, EmptyState, ErrorState } from './dashboard-states';
import { FlowLine, ShareBars, VerticalBars, weekdayCounts, weekdayLabel } from './dashboard-visuals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const BAR_COLORS = ['#03FE94', '#00b86b', '#F50057', '#7c3aed', '#f59e0b', '#0ea5e9'];

export function AdminDashboardView() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekday, setWeekday] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classBars = useMemo(
    () => weekdayCounts((data?.upcomingClasses ?? []).map((session) => session.sessionDate)),
    [data],
  );
  const visibleClasses = useMemo(() => {
    if (!data) return [];
    if (!weekday) return data.upcomingClasses;
    return data.upcomingClasses.filter((session) => weekdayLabel(session.sessionDate) === weekday);
  }, [data, weekday]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelSkeleton />
          <PanelSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void load()} />;
  }

  if (!data) {
    return null;
  }

  const { metrics } = data;
  const paymentValues = data.recentPayments.map((payment) => Number(payment.amount) || 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active Students" value={metrics.activeStudents} icon={GraduationCap} tone="rose" />
        <MetricCard title="Active Groups" value={metrics.activeGroups} icon={Users} tone="sand" />
        <MetricCard title="Active Instructors" value={metrics.activeInstructors} icon={Users} tone="mint" />
        <MetricCard title="Unpaid Invoices" value={metrics.unpaidInvoices} icon={FileWarning} tone="lilac" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Upcoming classes</CardTitle>
              <CardDescription>Tap a day to filter the list</CardDescription>
            </div>
            {weekday ? (
              <button
                type="button"
                onClick={() => setWeekday(null)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Clear {weekday}
              </button>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <VerticalBars
              items={classBars}
              activeLabel={weekday}
              onSelect={(label) => setWeekday((current) => (current === label ? null : label))}
            />
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {visibleClasses.length === 0 ? (
                <EmptyState title="No classes" description="Nothing scheduled for this day." />
              ) : (
                visibleClasses.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl bg-slate-50 px-3 py-2.5 transition hover:bg-[#e7f1ff]"
                  >
                    <p className="text-sm font-medium text-[#020D23]">{session.groupName}</p>
                    <p className="text-xs text-slate-500">
                      {session.courseName} · {session.sessionDate} · {session.startTime}–{session.endTime}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Payment flow</CardTitle>
            <CardDescription>Latest recorded amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <FlowLine values={paymentValues} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#e7f1ff] p-3">
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5 text-[#03FE94]" /> This month
                </p>
                <p className="mt-1 text-lg font-bold text-[#020D23]">€{metrics.revenueThisMonth}</p>
              </div>
              <div className="rounded-2xl bg-[#fff4d6] p-3">
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Wallet className="h-3.5 w-3.5 text-[#b45309]" /> Outstanding
                </p>
                <p className="mt-1 text-lg font-bold text-[#020D23]">€{metrics.outstandingPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardDescription>Share of the latest receipts</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentPayments.length === 0 ? (
              <EmptyState title="No payments yet" description="Recorded payments will appear here." />
            ) : (
              <ShareBars
                items={data.recentPayments.map((payment, index) => ({
                  id: payment.id,
                  label: payment.studentName,
                  meta: `${payment.paymentDate} · ${payment.method}`,
                  value: Number(payment.amount) || 0,
                  display: `€${payment.amount}`,
                  color: BAR_COLORS[index % BAR_COLORS.length] ?? '#03FE94',
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding invoices</CardTitle>
            <CardDescription>Still waiting on payment</CardDescription>
          </CardHeader>
          <CardContent>
            {data.outstandingInvoices.length === 0 ? (
              <EmptyState title="No outstanding invoices" description="All invoices are settled." />
            ) : (
              <ShareBars
                items={data.outstandingInvoices.map((invoice, index) => ({
                  id: invoice.id,
                  label: invoice.invoiceNumber,
                  meta: `${invoice.studentName} · due ${invoice.dueDate}`,
                  value: Number(invoice.remainingAmount) || 0,
                  display: `€${invoice.remainingAmount}`,
                  color: BAR_COLORS[(index + 2) % BAR_COLORS.length] ?? '#F50057',
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent enrollments</CardTitle>
            <CardDescription>Newest students in groups</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentEnrollments.length === 0 ? (
              <EmptyState title="No enrollments yet" description="New enrollments will appear here." />
            ) : (
              data.recentEnrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 transition hover:bg-[#e5f8ee]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#020D23]">{enrollment.studentName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {enrollment.groupName} · {enrollment.startDate}
                    </p>
                  </div>
                  <Badge variant="secondary">{enrollment.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
