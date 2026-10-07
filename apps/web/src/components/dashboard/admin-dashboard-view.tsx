'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminDashboardResponse } from '@unity/types';
import {
  FileWarning,
  GraduationCap,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { fetchAdminDashboard } from '@/lib/dashboard-api';
import { MetricCard, MetricCardSkeleton, PanelSkeleton, EmptyState, ErrorState } from './dashboard-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function AdminDashboardView() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelSkeleton />
          <PanelSkeleton />
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Operational overview for Unity Tech Hub administration.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Active Students" value={metrics.activeStudents} icon={GraduationCap} />
        <MetricCard title="Active Groups" value={metrics.activeGroups} icon={Users} />
        <MetricCard title="Active Instructors" value={metrics.activeInstructors} icon={Users} />
        <MetricCard title="Revenue This Month" value={`€${metrics.revenueThisMonth}`} icon={TrendingUp} />
        <MetricCard title="Outstanding Payments" value={`€${metrics.outstandingPayments}`} icon={Wallet} />
        <MetricCard title="Unpaid Invoices" value={metrics.unpaidInvoices} icon={FileWarning} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Latest recorded payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentPayments.length === 0 ? (
              <EmptyState title="No payments yet" description="Recorded payments will appear here." />
            ) : (
              data.recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{payment.studentName}</p>
                    <p className="text-xs text-muted-foreground">{payment.paymentDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">€{payment.amount}</p>
                    <Badge variant="secondary">{payment.method}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
            <CardDescription>Next scheduled sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingClasses.length === 0 ? (
              <EmptyState title="No upcoming classes" description="Scheduled sessions will appear here." />
            ) : (
              data.upcomingClasses.map((session) => (
                <div key={session.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{session.groupName}</p>
                  <p className="text-xs text-muted-foreground">{session.courseName}</p>
                  <p className="mt-1 text-xs">
                    {session.sessionDate} · {session.startTime}-{session.endTime}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding Invoices</CardTitle>
            <CardDescription>Unpaid and partially paid invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.outstandingInvoices.length === 0 ? (
              <EmptyState title="No outstanding invoices" description="All invoices are settled." />
            ) : (
              data.outstandingInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{invoice.studentName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">€{invoice.remainingAmount}</p>
                    <Badge variant="outline">{invoice.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Enrollments</CardTitle>
            <CardDescription>Latest student enrollments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentEnrollments.length === 0 ? (
              <EmptyState title="No enrollments yet" description="New enrollments will appear here." />
            ) : (
              data.recentEnrollments.map((enrollment) => (
                <div key={enrollment.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{enrollment.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {enrollment.groupName} · {enrollment.courseName}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{enrollment.status}</Badge>
                    <span className="text-xs text-muted-foreground">{enrollment.startDate}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
