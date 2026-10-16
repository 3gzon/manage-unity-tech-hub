'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { InvoiceDetail } from '@unity/types';
import { archiveInvoice, fetchInvoice } from '@/lib/invoices-api';
import { getAccessToken } from '@/lib/auth/token-storage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/dashboard/dashboard-states';
import { Skeleton } from '@/components/ui/skeleton';

export function InvoiceDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

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

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3">EUR {item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm font-medium">Total: EUR {invoice.total}</p>

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
