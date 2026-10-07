'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { InvoiceDetail } from '@unity/types';
import {
  cancelInvoice,
  fetchInvoice,
} from '@/lib/invoices-api';
import { createPayment } from '@/lib/payments-api';
import { getAccessToken } from '@/lib/auth/token-storage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function InvoiceDetailContent() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payment, setPayment] = useState({
    amount: '',
    method: 'CASH',
    paymentDate: new Date().toISOString().slice(0, 10),
    fiscalCoupon: '',
    reference: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvoice(await fetchInvoice(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRecordPayment() {
    if (!invoice) return;
    setActionError(null);
    try {
      await createPayment({
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        amount: Number(payment.amount),
        paymentMethod: payment.method as 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER',
        paidAt: payment.paymentDate,
        fiscalCoupon: payment.fiscalCoupon || undefined,
        reference: payment.reference || undefined,
      });
      setPaymentOpen(false);
      setPayment({
        amount: '',
        method: 'CASH',
        paymentDate: new Date().toISOString().slice(0, 10),
        fiscalCoupon: '',
        reference: '',
      });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not record payment');
    }
  }

  async function handleCancelInvoice() {
    if (!invoice) return;
    setActionError(null);
    try {
      await cancelInvoice(invoice.id);
      setCancelOpen(false);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel invoice');
    }
  }

  async function handleDownloadPdf() {
    if (!invoice) return;
    const token = getAccessToken();
    if (!token) return;

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/invoices/${invoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Could not download PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (error || !invoice) {
    return <ErrorState title="Invoice unavailable" description={error ?? 'Not found'} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">
            ← Back to invoices
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.studentName} · {invoice.billingPeriod}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPaymentOpen(true)} disabled={invoice.status === 'CANCELLED' || invoice.remainingAmount === '0.00'}>
            Record payment
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleDownloadPdf().catch((err: Error) => setActionError(err.message))}
          >
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button
            variant="outline"
            onClick={() => setCancelOpen(true)}
            disabled={invoice.status === 'PAID' || invoice.status === 'CANCELLED'}
          >
            Cancel invoice
          </Button>
        </div>
      </div>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Info label="Issue Date" value={invoice.issueDate} />
        <Info label="Due Date" value={invoice.dueDate} />
        <div className="rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="mt-2">
            <Badge variant="outline">{invoice.status}</Badge>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Quantity</th>
              <th className="px-4 py-3 font-medium">Unit Price</th>
              <th className="px-4 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">EUR {item.unitPrice}</td>
                <td className="px-4 py-3">EUR {item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Payments and fiscal coupons</h2>
        {(invoice.payments ?? []).length ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Fiscal coupon</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.payments ?? []).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{row.date}</td>
                    <td className="px-4 py-3">EUR {row.amount}</td>
                    <td className="px-4 py-3">{row.method}</td>
                    <td className="px-4 py-3">{row.fiscalCoupon ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.status === 'VOIDED' ? 'secondary' : 'outline'}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No payments linked yet. Record a payment with a fiscal coupon.</p>
        )}
      </section>

      <div className="ml-auto grid w-full gap-2 rounded-xl border p-4 text-sm md:w-[360px]">
        <SummaryRow label="Subtotal" value={invoice.subtotal} />
        <SummaryRow label="Discount" value={invoice.discount} />
        <SummaryRow label="Total" value={invoice.total} bold />
        <SummaryRow label="Paid" value={invoice.paidAmount} />
        <SummaryRow label="Remaining" value={invoice.remainingAmount} bold />
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Link this invoice to the fiscal coupon issued for the student.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={payment.amount}
            onChange={(e) => setPayment((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <Select
            value={payment.method}
            onChange={(e) => setPayment((prev) => ({ ...prev, method: e.target.value }))}
          >
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </Select>
          <Input
            type="date"
            value={payment.paymentDate}
            onChange={(e) => setPayment((prev) => ({ ...prev, paymentDate: e.target.value }))}
          />
          <Input
            placeholder="Fiscal coupon number"
            value={payment.fiscalCoupon}
            onChange={(e) => setPayment((prev) => ({ ...prev, fiscalCoupon: e.target.value }))}
          />
          <Input
            placeholder="Reference (optional)"
            value={payment.reference}
            onChange={(e) => setPayment((prev) => ({ ...prev, reference: e.target.value }))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPaymentOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleRecordPayment()}
            disabled={!payment.amount || !payment.fiscalCoupon.trim()}
          >
            Save payment
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogHeader>
          <DialogTitle>Cancel invoice</DialogTitle>
          <DialogDescription>This marks the invoice as cancelled.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCancelOpen(false)}>
            Keep invoice
          </Button>
          <Button onClick={() => void handleCancelInvoice()}>Confirm cancel</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : ''}>EUR {value}</span>
    </div>
  );
}
