'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { InvoiceListItem, InvoiceListQuery } from '@unity/types';
import { archiveInvoice, createInvoice, fetchInvoices, sendInvoiceEmail } from '@/lib/invoices-api';
import { fetchStudent, fetchStudents } from '@/lib/students-api';
import { isAdminPortalUser } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, EmptyState } from '@/components/dashboard/dashboard-states';
import { Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function emptyInvoice() {
  const today = todayInput();
  return {
    studentId: '',
    studentName: '',
    date: today,
    description: '',
    price: '',
    email: '',
    kind: 'paid' as 'paid' | 'due',
    familyMembers: [] as Array<{ id: string; name: string }>,
    selectedFamilyIds: [] as string[],
    familyPrices: {} as Record<string, string>,
    combined: false,
  };
}

export function InvoicesPageContent() {
  const { user } = useAuth();
  const allowed = isAdminPortalUser(user);

  const [query, setQuery] = useState<InvoiceListQuery>({ page: 1, pageSize: 20 });
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [studentQuery, setStudentQuery] = useState('');
  const [studentHits, setStudentHits] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [fillingEmail, setFillingEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createState, setCreateState] = useState(emptyInvoice);
  const [archiveTarget, setArchiveTarget] = useState<InvoiceListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    if (!createOpen) return;
    const handle = window.setTimeout(() => {
      setSearchingStudents(true);
      void fetchStudents({ search: studentQuery.trim() || undefined, pageSize: 20 })
        .then((res) =>
          setStudentHits(res.data.map((student) => ({ id: student.id, name: student.fullName, email: student.email }))),
        )
        .catch(() => setStudentHits([]))
        .finally(() => setSearchingStudents(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [createOpen, studentQuery]);

  const previewTotal = useMemo(() => {
    const selected = createState.familyMembers.filter((member) => createState.selectedFamilyIds.includes(member.id));
    if (createState.combined && selected.length) {
      const price = Number(createState.price || 0);
      return price > 0 ? price.toFixed(2) : '0.00';
    }
    const extra = selected.reduce((sum, member) => sum + Number(createState.familyPrices[member.id] || 0), 0);
    const price = Number(createState.price || 0) + extra;
    return price > 0 ? price.toFixed(2) : '0.00';
  }, [createState]);

  async function selectStudent(student: { id: string; name: string; email: string | null }) {
    setCreateState((prev) => ({
      ...prev,
      studentId: student.id,
      studentName: student.name,
      email: student.email ?? '',
      familyMembers: [],
      selectedFamilyIds: [],
      familyPrices: {},
      combined: false,
    }));
    setFillingEmail(true);
    try {
      const profile = await fetchStudent(student.id);
      const guardianEmail = profile.guardians.find((guardian) => guardian.email)?.email ?? '';
      const email = student.email ?? profile.student.email ?? guardianEmail;
      const familyMembers = (profile.family?.members ?? [])
        .filter((member) => member.id !== student.id)
        .map((member) => ({ id: member.id, name: member.fullName }));
      setCreateState((prev) =>
        prev.studentId === student.id ? { ...prev, email, familyMembers } : prev,
      );
    } catch {
      // The address can still be typed in.
    } finally {
      setFillingEmail(false);
    }
  }

  async function handleCreate() {
    setCreateError(null);
    try {
      const paid = createState.kind === 'paid';
      const selected = createState.familyMembers.filter((member) =>
        createState.selectedFamilyIds.includes(member.id),
      );
      const combined = createState.combined && selected.length > 0;
      const names = [createState.studentName, ...selected.map((member) => member.name)].filter(Boolean);
      const items = combined
        ? [
            {
              description: `Combined price for ${names.join(', ')}`,
              quantity: 1,
              unitPrice: Number(createState.price),
            },
          ]
        : [
            {
              description: createState.description,
              quantity: 1,
              unitPrice: Number(createState.price),
            },
            ...selected.map((member) => ({
              description: `${createState.description} · ${member.name}`,
              quantity: 1,
              unitPrice: Number(createState.familyPrices[member.id]),
            })),
          ];
      const invoice = await createInvoice({
        studentId: createState.studentId,
        ...(selected.length ? { studentIds: selected.map((member) => member.id) } : {}),
        ...(combined ? { combinedPrice: Number(createState.price) } : {}),
        issueDate: createState.date,
        dueDate: createState.date,
        billingPeriod: displayDate(createState.date),
        ...(paid ? { status: 'PAID' as const } : {}),
        items,
      });
      const email = createState.email.trim();
      if (email) {
        try {
          await sendInvoiceEmail(invoice.id, { email });
          setNotice(
            paid
              ? `Sent the payment confirmation and PDF to ${email}.`
              : `Sent the invoice for payment and PDF to ${email}.`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Could not send the email';
          setNotice(`The invoice was saved, but the email could not be sent. ${message}`);
        }
      } else {
        setNotice(null);
      }
      setCreateOpen(false);
      setCreateState(emptyInvoice());
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create invoice');
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await archiveInvoice(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive invoice');
      setArchiveTarget(null);
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
            Record a payment and email the confirmation, or send an invoice that still needs to be paid.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateError(null);
            setCreateState(emptyInvoice());
            setStudentQuery('');
            setStudentHits([]);
            setSearchingStudents(true);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Create invoice
        </Button>
      </div>

      {notice ? (
        <p className={notice.includes('could not') ? 'text-sm text-red-600' : 'text-sm text-emerald-700'}>{notice}</p>
      ) : null}

      <Input
        className="max-w-sm"
        placeholder="Search invoice or student..."
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
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
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
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm">
                          Open
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(invoice)}>
                        Archive
                      </Button>
                    </div>
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
          <DialogDescription>
            Choose whether the student has already paid or still needs to pay. An email includes the message and the PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="radio"
                name="invoice-kind"
                className="mt-1"
                checked={createState.kind === 'paid'}
                onChange={() => setCreateState((prev) => ({ ...prev, kind: 'paid' }))}
              />
              <span>
                <span className="font-medium">Student has paid</span>
                <span className="mt-0.5 block text-muted-foreground">Email the confirmation and the PDF.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="radio"
                name="invoice-kind"
                className="mt-1"
                checked={createState.kind === 'due'}
                onChange={() => setCreateState((prev) => ({ ...prev, kind: 'due' }))}
              />
              <span>
                <span className="font-medium">Invoice for payment</span>
                <span className="mt-0.5 block text-muted-foreground">Email the bill and ask them to pay.</span>
              </span>
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-student-search">Student</Label>
            {createState.studentId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{createState.studentName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCreateState((prev) => ({
                      ...prev,
                      studentId: '',
                      studentName: '',
                      email: '',
                      familyMembers: [],
                      selectedFamilyIds: [],
                      familyPrices: {},
                      combined: false,
                    }))
                  }
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="invoice-student-search"
                  placeholder="Search by name, email, or phone"
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  autoComplete="off"
                />
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {searchingStudents ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                  ) : studentHits.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No students match that search.</p>
                  ) : (
                    studentHits.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => void selectStudent(student)}
                      >
                        {student.name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoice-date">Date</Label>
            <Input
              id="invoice-date"
              type="date"
              value={createState.date}
              onChange={(e) => setCreateState((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          {createState.familyMembers.length ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Family on this invoice</p>
              <p className="text-xs text-muted-foreground">
                Add another family member to the same invoice, with their own price or one combined price.
              </p>
              {createState.familyMembers.map((member) => {
                const selected = createState.selectedFamilyIds.includes(member.id);
                return (
                  <div key={member.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="flex flex-1 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          setCreateState((prev) => ({
                            ...prev,
                            selectedFamilyIds: event.target.checked
                              ? [...prev.selectedFamilyIds, member.id]
                              : prev.selectedFamilyIds.filter((id) => id !== member.id),
                          }))
                        }
                      />
                      {member.name}
                    </label>
                    {selected && !createState.combined ? (
                      <Input
                        className="sm:max-w-[140px]"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        value={createState.familyPrices[member.id] ?? ''}
                        onChange={(event) =>
                          setCreateState((prev) => ({
                            ...prev,
                            familyPrices: { ...prev.familyPrices, [member.id]: event.target.value },
                          }))
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
              {createState.selectedFamilyIds.length ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createState.combined}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, combined: event.target.checked }))}
                  />
                  One combined price for everyone selected
                </label>
              ) : null}
            </div>
          ) : null}
          <Input
            placeholder="Description"
            value={createState.description}
            onChange={(e) => setCreateState((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="space-y-1">
            <Label htmlFor="invoice-email">
              {createState.kind === 'paid' ? 'Email the confirmation to' : 'Email the invoice to'}
            </Label>
            <Input
              id="invoice-email"
              type="email"
              placeholder="student@email.com"
              value={createState.email}
              onChange={(e) => setCreateState((prev) => ({ ...prev, email: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {fillingEmail
                ? 'Looking up the saved email…'
                : createState.studentId && !createState.email
                  ? 'No email is saved for this student. Type one to send the invoice.'
                  : createState.kind === 'paid'
                    ? 'Filled from the student. Clear it to save the payment without sending.'
                    : 'Filled from the student. Clear it to save the invoice without sending.'}
            </p>
          </div>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder={createState.combined ? 'Combined price' : 'Price'}
            value={createState.price}
            onChange={(e) => setCreateState((prev) => ({ ...prev, price: e.target.value }))}
          />
          <p className="text-sm text-muted-foreground">Total: EUR {previewTotal}</p>
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
              !createState.date ||
              !createState.price ||
              (!createState.combined && !createState.description.trim()) ||
              createState.selectedFamilyIds.some(
                (id) => !createState.combined && (createState.familyPrices[id] ?? '') === '',
              )
            }
          >
            {createState.email.trim()
              ? createState.kind === 'paid'
                ? 'Save and send'
                : 'Create and send'
              : 'Create'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={() => setArchiveTarget(null)}>
        <DialogHeader>
          <DialogTitle>Archive invoice</DialogTitle>
          <DialogDescription>
            Archive {archiveTarget ? `${archiveTarget.invoiceNumber} for ${archiveTarget.studentName}` : 'this invoice'}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setArchiveTarget(null)}>
            Cancel
          </Button>
          <Button onClick={() => void handleArchive()}>Archive</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
