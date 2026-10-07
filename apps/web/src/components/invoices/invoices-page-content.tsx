'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { InvoiceListItem, InvoiceListQuery, InvoiceStatus } from '@unity/types';
import { createInvoice, fetchInvoices, generateMonthlyInvoices } from '@/lib/invoices-api';
import { fetchStudents } from '@/lib/students-api';
import { hasRole } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, EmptyState } from '@/components/dashboard/dashboard-states';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const STATUSES: InvoiceStatus[] = ['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

export function InvoicesPageContent() {
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN');

  const [query, setQuery] = useState<InvoiceListQuery>({ page: 1, pageSize: 20 });
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createState, setCreateState] = useState({
    studentId: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    billingPeriod: '',
    discount: '',
    itemDescription: '',
    itemQuantity: '1',
    itemUnitPrice: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchInvoices(query);
      setInvoices(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchStudents({ page: 1, pageSize: 100 })
      .then((res) => setStudents(res.data.map((s) => ({ id: s.id, name: s.fullName }))))
      .catch(() => setStudents([]));
  }, []);

  const quickTotal = useMemo(() => {
    const qty = Number(createState.itemQuantity || 0);
    const price = Number(createState.itemUnitPrice || 0);
    const discount = Number(createState.discount || 0);
    const raw = qty * price - discount;
    return raw > 0 ? raw.toFixed(2) : '0.00';
  }, [createState.discount, createState.itemQuantity, createState.itemUnitPrice]);

  async function handleGenerate() {
    setGenerateMessage(null);
    setError(null);
    setGenerating(true);
    try {
      const result = await generateMonthlyInvoices({ month: billingMonth });
      const created = result.created.length;
      setGenerateMessage(
        created
          ? `Created ${created} invoice${created === 1 ? '' : 's'} for ${result.month}. ${result.skipped} already billed or not billable.`
          : `No new invoices for ${result.month}. ${result.skipped} students were already billed or not billable.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate invoices');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate() {
    setCreateError(null);
    try {
      await createInvoice({
        studentId: createState.studentId,
        issueDate: createState.issueDate,
        dueDate: createState.dueDate,
        billingPeriod: createState.billingPeriod,
        discount: createState.discount ? Number(createState.discount) : undefined,
        items: [
          {
            description: createState.itemDescription,
            quantity: Number(createState.itemQuantity),
            unitPrice: Number(createState.itemUnitPrice),
          },
        ],
      });
      setCreateOpen(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create invoice');
    }
  }

  if (!allowed) {
    return <EmptyState title="Access restricted" description="Invoices are available only to admins." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Generate a month from enrollments. Extra-course and family-pack discounts from Settings are already taken off.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input type="month" className="w-full sm:w-[180px]" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} />
          <Button variant="outline" onClick={() => void handleGenerate()} disabled={generating || !billingMonth}>
            {generating ? 'Generating…' : 'Generate invoices'}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create invoice
          </Button>
        </div>
      </div>
      {generateMessage ? <p className="text-sm text-muted-foreground">{generateMessage}</p> : null}

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-4">
        <Input
          placeholder="Search invoice, student, period..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setQuery((prev) => ({
                ...prev,
                page: 1,
                search: (e.target as HTMLInputElement).value || undefined,
              }));
            }
          }}
        />
        <Select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              status: (e.target.value as InvoiceStatus) || undefined,
            }))
          }
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-52 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load invoices" description={error} onRetry={() => void load()} />
      ) : invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Create your first invoice to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3">{invoice.studentName}</td>
                  <td className="px-4 py-3">{invoice.billingPeriod}</td>
                  <td className="px-4 py-3">EUR {invoice.amount}</td>
                  <td className="px-4 py-3">EUR {invoice.paid}</td>
                  <td className="px-4 py-3">EUR {invoice.remaining}</td>
                  <td className="px-4 py-3">{invoice.dueDate}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{invoice.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${invoice.id}`}>
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {meta.page} of {meta.totalPages} · {meta.total} invoices
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>Totals are recalculated server-side.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select
            value={createState.studentId}
            onChange={(e) => setCreateState((prev) => ({ ...prev, studentId: e.target.value }))}
          >
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Billing period (e.g. September 2026)"
            value={createState.billingPeriod}
            onChange={(e) => setCreateState((prev) => ({ ...prev, billingPeriod: e.target.value }))}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="date"
              value={createState.issueDate}
              onChange={(e) => setCreateState((prev) => ({ ...prev, issueDate: e.target.value }))}
            />
            <Input
              type="date"
              value={createState.dueDate}
              onChange={(e) => setCreateState((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Item description"
            value={createState.itemDescription}
            onChange={(e) => setCreateState((prev) => ({ ...prev, itemDescription: e.target.value }))}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Quantity"
              value={createState.itemQuantity}
              onChange={(e) => setCreateState((prev) => ({ ...prev, itemQuantity: e.target.value }))}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit price"
              value={createState.itemUnitPrice}
              onChange={(e) => setCreateState((prev) => ({ ...prev, itemUnitPrice: e.target.value }))}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Discount"
              value={createState.discount}
              onChange={(e) => setCreateState((prev) => ({ ...prev, discount: e.target.value }))}
            />
          </div>
          <p className="text-sm text-muted-foreground">Preview total: EUR {quickTotal}</p>
          {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={
              !createState.studentId ||
              !createState.billingPeriod.trim() ||
              !createState.itemDescription.trim() ||
              !createState.itemUnitPrice
            }
          >
            Create
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
