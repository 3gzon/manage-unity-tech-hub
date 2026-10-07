'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PaymentListItem, PaymentListQuery, PaymentMethod, StudentPaymentContext, TuitionQuote } from '@unity/types';
import {
  createPayment,
  fetchMonthlyPaymentSummary,
  fetchPayments,
  fetchStudentPaymentContext,
  voidPayment,
} from '@/lib/payments-api';
import { fetchStudents } from '@/lib/students-api';
import { hasRole } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, EmptyState } from '@/components/dashboard/dashboard-states';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'];

export function PaymentsPageContent() {
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN');

  const [query, setQuery] = useState<PaymentListQuery>({ page: 1, pageSize: 20 });
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<{ totalAmount: string; paymentCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [context, setContext] = useState<StudentPaymentContext | null>(null);
  const [form, setForm] = useState(emptyPaymentForm);
  const [voidTarget, setVoidTarget] = useState<PaymentListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPayments(query);
      setPayments(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchMonthlyPaymentSummary(summaryMonth);
      setSummary({ totalAmount: res.totalAmount, paymentCount: res.paymentCount });
    } catch {
      setSummary(null);
    }
  }, [summaryMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void fetchStudents({ page: 1, pageSize: 100 })
      .then((res) => setStudents(res.data.map((s) => ({ id: s.id, name: s.fullName }))))
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    if (!form.studentId) {
      setContext(null);
      return;
    }
    let cancelled = false;
    void fetchStudentPaymentContext(form.studentId)
      .then((res) => {
        if (cancelled) return;
        setContext(res);
        setForm((prev) => {
          if (prev.studentId !== res.studentId) return prev;
          const invoiceId = res.unpaidInvoices.some((invoice) => invoice.id === prev.invoiceId) ? prev.invoiceId : '';
          return invoiceId === prev.invoiceId ? prev : { ...prev, invoiceId };
        });
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.studentId]);

  useEffect(() => {
    if (!context) return;
    setForm((prev) => {
      if (prev.studentId !== context.studentId) return prev;
      const amount = suggestedAmount(context, prev.invoiceId, prev.applyTuitionDiscount);
      const summary = discountNote(context.tuition);
      const replaceAmount = prev.amount === '' || sameMoney(prev.amount, prev.lastSuggested);
      const replaceNotes = prev.notes === '' || prev.notes === prev.lastSummary;
      if (
        sameMoney(prev.amount, amount) &&
        prev.notes === (replaceNotes ? summary : prev.notes) &&
        prev.lastSuggested === amount &&
        prev.lastSummary === summary
      ) {
        return prev;
      }
      return {
        ...prev,
        lastSuggested: amount,
        lastSummary: summary,
        amount: replaceAmount ? amount : prev.amount,
        notes: replaceNotes ? summary : prev.notes,
      };
    });
  }, [context, form.invoiceId, form.applyTuitionDiscount]);

  const selectedInvoiceOutstanding = useMemo(() => {
    if (!context || !form.invoiceId) return null;
    return context.unpaidInvoices.find((inv) => inv.id === form.invoiceId)?.remainingAmount ?? null;
  }, [context, form.invoiceId]);

  async function handleCreate() {
    setCreateError(null);
    try {
      await createPayment({
        studentId: form.studentId,
        invoiceId: form.invoiceId || undefined,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod as PaymentMethod,
        paidAt: form.paidAt,
        fiscalCoupon: form.fiscalCoupon || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        applyTuitionDiscount: form.applyTuitionDiscount,
      });
      setCreateOpen(false);
      setForm(emptyPaymentForm());
      setContext(null);
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create payment');
    }
  }

  async function handleVoid() {
    if (!voidTarget) return;
    try {
      await voidPayment(voidTarget.id);
      setVoidTarget(null);
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void payment');
    }
  }

  if (!allowed) {
    return <EmptyState title="Access restricted" description="Payments are available only to admins." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Record student payments. Extra-course and family-pack discounts come from Settings.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Record payment</Button>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Monthly payment summary</p>
            <p className="text-sm text-muted-foreground">
              {summary ? `EUR ${summary.totalAmount} from ${summary.paymentCount} payments` : 'Unavailable'}
            </p>
          </div>
          <Input
            type="month"
            className="w-full md:w-[220px]"
            value={summaryMonth}
            onChange={(e) => setSummaryMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-5">
        <Input
          placeholder="Search student, invoice, fiscal coupon..."
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
          value={query.studentId ?? ''}
          onChange={(e) => setQuery((prev) => ({ ...prev, page: 1, studentId: e.target.value || undefined }))}
        >
          <option value="">All students</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </Select>
        <Select
          value={query.method ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({ ...prev, page: 1, method: (e.target.value as PaymentMethod) || undefined }))
          }
        >
          <option value="">All methods</option>
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={query.fromDate ?? ''}
          onChange={(e) => setQuery((prev) => ({ ...prev, page: 1, fromDate: e.target.value || undefined }))}
        />
        <Input
          type="date"
          value={query.toDate ?? ''}
          onChange={(e) => setQuery((prev) => ({ ...prev, page: 1, toDate: e.target.value || undefined }))}
        />
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load payments" description={error} onRetry={() => void load()} />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments found" description="Record a payment to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Fiscal coupon</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Recorded By</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{payment.date}</td>
                  <td className="px-4 py-3">{payment.studentName}</td>
                  <td className="px-4 py-3">
                    {payment.invoiceId ? (
                      <Link href={`/invoices/${payment.invoiceId}`} className="hover:underline">
                        {payment.invoiceNumber}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">{payment.fiscalCoupon ?? '—'}</td>
                  <td className="px-4 py-3">EUR {payment.amount}</td>
                  <td className="px-4 py-3">{payment.method}</td>
                  <td className="px-4 py-3">{payment.recordedBy}</td>
                  <td className="px-4 py-3">
                    <Badge variant={payment.status === 'VOIDED' ? 'secondary' : 'outline'}>{payment.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={payment.status === 'VOIDED'}
                      onClick={() => setVoidTarget(payment)}
                    >
                      Void
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {meta.page} of {meta.totalPages} · {meta.total} payments
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
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Select the student invoice, then enter the fiscal coupon number from the cash register.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select
            value={form.studentId}
            onChange={(e) =>
              setForm((prev) => ({
                ...emptyPaymentForm(),
                paymentMethod: prev.paymentMethod,
                paidAt: prev.paidAt,
                studentId: e.target.value,
              }))
            }
          >
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </Select>

          {context ? <TuitionBreakdown context={context} /> : null}

          <Select
            value={form.invoiceId}
            onChange={(e) => setForm((prev) => ({ ...prev, invoiceId: e.target.value }))}
          >
            <option value="">Select invoice</option>
            {(context?.unpaidInvoices ?? []).map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} · EUR {invoice.remainingAmount}
              </option>
            ))}
          </Select>

          {selectedInvoiceOutstanding ? (
            <p className="text-sm text-muted-foreground">
              {context &&
              form.applyTuitionDiscount &&
              hasPackDiscount(context.tuition) &&
              selectedInvoiceMatchesTuition(context, form.invoiceId) &&
              !sameMoney(selectedInvoiceOutstanding, suggestedAmount(context, form.invoiceId, true))
                ? `Selected invoice remaining: EUR ${selectedInvoiceOutstanding}. After discounts the invoice due becomes EUR ${suggestedAmount(context, form.invoiceId, true)}.`
                : `Selected invoice remaining: EUR ${selectedInvoiceOutstanding}`}
            </p>
          ) : null}

          {context && hasPackDiscount(context.tuition) ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.applyTuitionDiscount}
                onChange={(e) => setForm((prev) => ({ ...prev, applyTuitionDiscount: e.target.checked }))}
              />
              <span>
                Count the extra-course ({context.tuition.multiCourseRate}%) and family-pack ({context.tuition.familyRate}%) discounts on this payment.
              </span>
            </label>
          ) : null}

          {context && form.invoiceId && form.applyTuitionDiscount && hasPackDiscount(context.tuition) && !selectedInvoiceMatchesTuition(context, form.invoiceId) ? (
            <p className="text-sm text-amber-700">
              This invoice does not match the monthly tuition, so the discount stays on the payment amount and is not written onto the invoice.
            </p>
          ) : null}

          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <Select
            value={form.paymentMethod}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
          >
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={form.paidAt}
            onChange={(e) => setForm((prev) => ({ ...prev, paidAt: e.target.value }))}
          />
          <Input
            placeholder="Fiscal coupon number"
            value={form.fiscalCoupon}
            onChange={(e) => setForm((prev) => ({ ...prev, fiscalCoupon: e.target.value }))}
          />
          <Input
            placeholder="Reference (optional)"
            value={form.reference}
            onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
          />
          <Input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
          {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!form.studentId || !form.invoiceId || !form.fiscalCoupon.trim() || !form.amount || Number(form.amount) <= 0}
          >
            Save payment
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(voidTarget)} onOpenChange={() => setVoidTarget(null)}>
        <DialogHeader>
          <DialogTitle>Void payment</DialogTitle>
          <DialogDescription>
            Void payment of EUR {voidTarget?.amount} for {voidTarget?.studentName}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setVoidTarget(null)}>
            Cancel
          </Button>
          <Button onClick={() => void handleVoid()}>Confirm void</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function emptyPaymentForm() {
  return {
    studentId: '',
    invoiceId: '',
    amount: '',
    paymentMethod: 'CASH',
    paidAt: new Date().toISOString().slice(0, 10),
    fiscalCoupon: '',
    reference: '',
    notes: '',
    applyTuitionDiscount: true,
    lastSuggested: '',
    lastSummary: '',
  };
}

function TuitionBreakdown({ context }: { context: StudentPaymentContext }) {
  const { tuition } = context;
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <p>Outstanding invoices: EUR {context.outstandingBalance}</p>
      <p>Monthly tuition: EUR {tuition.grossAmount}</p>
      {tuition.lines.map((line) => (
        <p key={line.enrollmentId} className="text-muted-foreground">
          {line.courseName} · {line.groupName}: EUR {line.listPrice}
          {Number(line.manualDiscount) > 0 ? ` · enrollment discount EUR ${line.manualDiscount}` : ''}
          {line.isExtraCourse ? ` · extra course ${tuition.multiCourseRate}% off EUR ${line.multiCourseDiscount}` : ''}
        </p>
      ))}
      {tuition.familyPack ? (
        <p>
          Family pack {tuition.familyRate}% off with {tuition.familyStudentNames.join(', ')}: EUR {tuition.familyDiscount}
        </p>
      ) : null}
      <p className="font-medium">Amount due this month: EUR {tuition.netAmount}</p>
      {!hasPackDiscount(tuition) && tuition.courseCount > 0 ? (
        <p className="text-muted-foreground">One course and no enrolled sibling, so there is no extra 10% discount.</p>
      ) : null}
    </div>
  );
}

function hasPackDiscount(tuition: TuitionQuote) {
  return Number(tuition.multiCourseDiscount) > 0 || Number(tuition.familyDiscount) > 0;
}

function discountNote(tuition: TuitionQuote) {
  return hasPackDiscount(tuition) ? tuition.summary : '';
}

function sameMoney(left: string, right: string) {
  if (left === right) return true;
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 0.001;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function selectedInvoiceMatchesTuition(context: StudentPaymentContext, invoiceId: string) {
  const invoice = context.unpaidInvoices.find((item) => item.id === invoiceId);
  if (!invoice) return false;
  return invoiceMatchesTuition(invoice, context.tuition);
}

function invoiceMatchesTuition(
  invoice: StudentPaymentContext['unpaidInvoices'][number],
  tuition: TuitionQuote,
) {
  const subtotal = Number(invoice.subtotal);
  const gross = Number(tuition.grossAmount);
  const afterManual = round2(gross - Number(tuition.manualDiscount));
  return Math.abs(subtotal - gross) < 0.001 || Math.abs(subtotal - afterManual) < 0.001;
}

function suggestedAmount(context: StudentPaymentContext, invoiceId: string, applyDiscount: boolean) {
  const { tuition } = context;
  const invoice = context.unpaidInvoices.find((item) => item.id === invoiceId);
  const pack = Number(tuition.multiCourseDiscount) + Number(tuition.familyDiscount);
  if (!invoice) {
    if (applyDiscount && pack > 0) return tuition.netAmount;
    const beforePacks = round2(Number(tuition.grossAmount) - Number(tuition.manualDiscount));
    return beforePacks > 0 ? beforePacks.toFixed(2) : '';
  }
  if (applyDiscount && pack > 0 && invoiceMatchesTuition(invoice, tuition)) {
    const gross = Number(tuition.grossAmount);
    const manual = Number(tuition.manualDiscount);
    const afterManual = round2(gross - manual);
    const target =
      Math.abs(Number(invoice.subtotal) - gross) < 0.001 ? round2(manual + pack) : round2(pack);
    const nextDiscount = Math.max(Number(invoice.discount), target);
    const paid = round2(Number(invoice.total) - Number(invoice.remainingAmount));
    const nextTotal = round2(Number(invoice.subtotal) - nextDiscount);
    return Math.max(0, round2(nextTotal - paid)).toFixed(2);
  }
  return invoice.remainingAmount;
}
