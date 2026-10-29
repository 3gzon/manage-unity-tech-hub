'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InvoiceDetail } from '@unity/types';
import { archiveInvoice, fetchInvoice, sendInvoiceEmail } from '@/lib/invoices-api';
import { getAccessToken } from '@/lib/auth/token-storage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function statusLabel(status: InvoiceDetail['status']) {
  switch (status) {
    case 'PAID': return 'Paid';
    case 'UNPAID': return 'Unpaid';
    case 'PARTIALLY_PAID': return 'Partially paid';
    case 'OVERDUE': return 'Overdue';
    case 'CANCELLED': return 'Cancelled';
    default: return status;
  }
}

function statusVariant(status: InvoiceDetail['status']): 'default' | 'outline' | 'secondary' {
  if (status === 'PAID') return 'default';
  if (status === 'OVERDUE') return 'secondary';
  return 'outline';
}

export function InvoiceDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

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

  async function handleArchive() {
    if (!invoice) return;
    setActionError(null);
    try {
      await archiveInvoice(invoice.id);
      router.push('/invoices');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not archive invoice');
      setArchiveOpen(false);
    }
  }

  async function handleSendEmail() {
    if (!invoice) return;
    setEmailSending(true);
    try {
      await sendInvoiceEmail(invoice.id, { email: emailAddress.trim() });
      setEmailNotice(`Email sent to ${emailAddress.trim()}.`);
      setEmailOpen(false);
    } catch (err) {
      setEmailNotice(err instanceof Error ? err.message : 'Could not send email');
    } finally {
      setEmailSending(false);
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{invoice.invoiceNumber}</h1>
            <Badge variant={statusVariant(invoice.status)}>{statusLabel(invoice.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/students/${invoice.studentId}`} className="hover:underline">
              {invoice.studentName}
            </Link>
            {' · '}{invoice.billingPeriod}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEmailAddress(invoice.studentEmail ?? '');
              setEmailNotice(null);
              setEmailOpen(true);
            }}
          >
            Send email
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleDownloadPdf().catch((err: Error) => setActionError(err.message))}
          >
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => setArchiveOpen(true)}>
            Archive
          </Button>
        </div>
      </div>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {emailNotice ? (
        <p className={`text-sm ${emailNotice.includes('sent') ? 'text-emerald-700' : 'text-red-600'}`}>{emailNotice}</p>
      ) : null}

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div>
          <p className="text-muted-foreground">Issue date</p>
          <p className="font-medium">{invoice.issueDate}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Due date</p>
          <p className="font-medium">{invoice.dueDate}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="font-medium">EUR {invoice.total}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <p className={`font-medium ${Number(invoice.remainingAmount) > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
            EUR {invoice.remainingAmount}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Unit price</th>
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

      {invoice.payments.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-base font-medium">Payments</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{payment.date}</td>
                    <td className="px-4 py-3">{payment.method.replace('_', ' ')}</td>
                    <td className="px-4 py-3">EUR {payment.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogHeader>
          <DialogTitle>Send invoice by email</DialogTitle>
          <DialogDescription>
            {invoice.status === 'PAID'
              ? 'Send the payment confirmation and PDF to this address.'
              : 'Send the invoice and PDF to this address.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="invoice-email-send">Email address</Label>
          <Input
            id="invoice-email-send"
            type="email"
            placeholder="student@email.com"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEmailOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSendEmail()}
            disabled={emailSending || !emailAddress.trim()}
          >
            {emailSending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogHeader>
          <DialogTitle>Archive invoice</DialogTitle>
          <DialogDescription>Archive {invoice.invoiceNumber}?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setArchiveOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleArchive()}>Archive</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
