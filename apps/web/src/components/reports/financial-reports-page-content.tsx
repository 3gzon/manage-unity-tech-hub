'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { FinancialNamedAmount, FinancialReportPreset, FinancialReportResponse } from '@unity/types';
import {
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  FileCheck2,
  FileWarning,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { fetchFinancialReport } from '@/lib/reports-api';
import { hasPermission, hasRole } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, MetricCard, MetricCardSkeleton, PanelSkeleton } from '@/components/dashboard/dashboard-states';
import { Input } from '@/components/ui/input';

const PRESETS: Array<{ id: FinancialReportPreset; label: string }> = [
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'LAST_MONTH', label: 'Last Month' },
  { id: 'LAST_3_MONTHS', label: 'Last 3 Months' },
  { id: 'CUSTOM', label: 'Custom Range' },
];

function money(value: string) {
  const amount = Number(value);
  const prefix = amount < 0 ? '-EUR ' : 'EUR ';
  return `${prefix}${Math.abs(amount).toFixed(2)}`;
}

export function FinancialReportsPageContent() {
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN') && hasPermission(user, 'reports.financial');

  const [preset, setPreset] = useState<FinancialReportPreset>('THIS_MONTH');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [report, setReport] = useState<FinancialReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    if (preset === 'CUSTOM' && (!fromDate || !toDate)) {
      setError('Choose a start and end date for a custom range.');
      setReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setReport(
        await fetchFinancialReport({
          preset,
          fromDate: preset === 'CUSTOM' ? fromDate : undefined,
          toDate: preset === 'CUSTOM' ? toDate : undefined,
        }),
      );
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Failed to load financial report');
    } finally {
      setLoading(false);
    }
  }, [allowed, preset, fromDate, toDate]);

  useEffect(() => {
    if (preset !== 'CUSTOM') {
      void load();
    }
  }, [load, preset]);

  if (!allowed) {
    return (
      <EmptyState
        title="Access restricted"
        description="Financial reports are available only to admins with reports.financial."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financial Reports</h1>
          <p className="text-sm text-muted-foreground">
            Revenue, expenses, and outstanding balances calculated on the server.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <Button
                key={item.id}
                variant={preset === item.id ? 'default' : 'outline'}
                onClick={() => setPreset(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {preset === 'CUSTOM' ? (
            <div className="flex flex-wrap items-end gap-2">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              <Button onClick={() => void load()} disabled={!fromDate || !toDate}>
                Apply
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {report ? (
        <p className="text-sm text-muted-foreground">
          Period {report.fromDate} to {report.toDate}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <MetricCardSkeleton key={index} />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
        </div>
      ) : error ? (
        <ErrorState title="Unable to load financial report" description={error} onRetry={() => void load()} />
      ) : report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Revenue" value={money(report.metrics.revenue)} icon={TrendingUp} />
            <MetricCard title="Expected Revenue" value={money(report.metrics.expectedRevenue)} icon={CircleDollarSign} />
            <MetricCard title="Outstanding Balance" value={money(report.metrics.outstandingBalance)} icon={Wallet} />
            <MetricCard title="Paid Invoices" value={report.metrics.paidInvoices} icon={FileCheck2} />
            <MetricCard title="Unpaid Invoices" value={report.metrics.unpaidInvoices} icon={FileWarning} />
            <MetricCard title="Expenses" value={money(report.metrics.expenses)} icon={Banknote} />
            <MetricCard title="Instructor Compensation" value={money(report.metrics.instructorCompensation)} icon={Scale} />
            <MetricCard title="Net Result" value={money(report.metrics.netResult)} icon={AlertTriangle} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Monthly revenue" description="Collected payments by month">
              <VerticalBars items={report.charts.monthlyRevenue} />
            </ChartCard>
            <ChartCard title="Revenue by course" description="Payments allocated from active enrollments">
              <HorizontalBars items={report.charts.revenueByCourse} />
            </ChartCard>
            <ChartCard title="Outstanding balances" description="Highest student balances in the period">
              <HorizontalBars items={report.charts.outstandingBalances} />
            </ChartCard>
            <ChartCard title="Payment methods" description="Active payments in the period">
              <HorizontalBars items={report.charts.paymentMethods} />
            </ChartCard>
            <ChartCard title="Expenses by category" description="Active expenses in the period">
              <HorizontalBars items={report.charts.expensesByCategory} />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Top outstanding balances</CardTitle>
                <CardDescription>Students with the highest remaining invoice totals</CardDescription>
              </CardHeader>
              <CardContent>
                {report.tables.topOutstandingBalances.length === 0 ? (
                  <EmptyState title="No outstanding balances" description="No unpaid invoices in this period." />
                ) : (
                  <SimpleTable
                    headers={['Student', 'Invoices', 'Remaining']}
                    rows={report.tables.topOutstandingBalances.map((row) => [
                      row.studentName,
                      String(row.invoiceCount),
                      money(row.remainingAmount),
                    ])}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latest payments</CardTitle>
                <CardDescription>Most recent collected payments</CardDescription>
              </CardHeader>
              <CardContent>
                {report.tables.latestPayments.length === 0 ? (
                  <EmptyState title="No payments" description="No active payments in this period." />
                ) : (
                  <SimpleTable
                    headers={['Date', 'Student', 'Amount']}
                    rows={report.tables.latestPayments.map((row) => [
                      row.date,
                      `${row.studentName} · ${row.method}`,
                      money(row.amount),
                    ])}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overdue invoices</CardTitle>
                <CardDescription>Invoices past due as of the period end</CardDescription>
              </CardHeader>
              <CardContent>
                {report.tables.overdueInvoices.length === 0 ? (
                  <EmptyState title="No overdue invoices" description="Nothing is past due in this period." />
                ) : (
                  <SimpleTable
                    headers={['Invoice', 'Due', 'Remaining']}
                    rows={report.tables.overdueInvoices.map((row) => [
                      `${row.invoiceNumber} · ${row.studentName}`,
                      row.dueDate,
                      money(row.remainingAmount),
                    ])}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function maxAmount(items: FinancialNamedAmount[]) {
  return items.reduce((max, item) => Math.max(max, Math.abs(Number(item.amount))), 0);
}

function HorizontalBars({ items }: { items: FinancialNamedAmount[] }) {
  if (items.length === 0) {
    return <EmptyState title="No data" description="Nothing to chart for this period." />;
  }
  const max = maxAmount(items) || 1;
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = `${(Math.abs(Number(item.amount)) / max) * 100}%`;
        return (
          <div key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span>{item.label}</span>
              <span className="font-medium">{money(item.amount)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VerticalBars({ items }: { items: FinancialNamedAmount[] }) {
  if (items.length === 0) {
    return <EmptyState title="No data" description="Nothing to chart for this period." />;
  }
  const max = maxAmount(items) || 1;
  return (
    <div className="flex h-56 items-end gap-3">
      {items.map((item) => {
        const height = `${(Math.abs(Number(item.amount)) / max) * 100}%`;
        return (
          <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <p className="text-xs font-medium">{money(item.amount)}</p>
            <div className="flex h-40 w-full items-end rounded-md bg-muted">
              <div className="w-full rounded-md bg-primary" style={{ height }} />
            </div>
            <p className="w-full truncate text-center text-xs text-muted-foreground">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="pb-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
