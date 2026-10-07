'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CreateExpenseRequest,
  ExpenseCategory,
  ExpenseListItem,
  ExpenseListQuery,
  PaymentMethod,
} from '@unity/types';
import { EXPENSE_CATEGORIES } from '@unity/types';
import {
  createExpense,
  fetchExpenses,
  fetchMonthlyExpenseSummary,
  updateExpense,
  voidExpense,
} from '@/lib/expenses-api';
import { hasPermission, hasRole } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  SUPPLIES: 'Supplies',
  MARKETING: 'Marketing',
  SOFTWARE: 'Software',
  SALARIES: 'Salaries',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

function emptyForm() {
  return {
    category: 'OTHER' as ExpenseCategory,
    description: '',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: '',
    reference: '',
    notes: '',
  };
}

export function ExpensesPageContent() {
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN');
  const canManage = hasPermission(user, 'expenses.manage');

  const [query, setQuery] = useState<ExpenseListQuery>({ page: 1, pageSize: 20 });
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<{ totalAmount: string; expenseCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseListItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<ExpenseListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchExpenses(query);
      setExpenses(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchMonthlyExpenseSummary(summaryMonth);
      setSummary({ totalAmount: res.totalAmount, expenseCount: res.expenseCount });
    } catch {
      setSummary(null);
    }
  }, [summaryMonth]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  useEffect(() => {
    if (!allowed) return;
    void loadSummary();
  }, [allowed, loadSummary]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(expense: ExpenseListItem) {
    setEditing(expense);
    setForm({
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      expenseDate: expense.date,
      paymentMethod: expense.paymentMethod ?? '',
      reference: expense.reference ?? '',
      notes: expense.notes ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    const payload: CreateExpenseRequest = {
      category: form.category,
      description: form.description.trim(),
      amount: Number(form.amount),
      expenseDate: form.expenseDate,
      paymentMethod: (form.paymentMethod as PaymentMethod) || undefined,
      reference: form.reference.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (editing) {
        await updateExpense(editing.id, payload);
      } else {
        await createExpense(payload);
      }
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm());
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save expense');
    }
  }

  async function handleVoid() {
    if (!voidTarget) return;
    try {
      await voidExpense(voidTarget.id);
      setVoidTarget(null);
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void expense');
    }
  }

  if (!allowed) {
    return <EmptyState title="Access restricted" description="Expenses are available only to admins." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track operational costs. Voided records stay in history.</p>
        </div>
        {canManage ? <Button onClick={openCreate}>Record expense</Button> : null}
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Monthly total</p>
            <p className="text-sm text-muted-foreground">
              {summary
                ? `EUR ${summary.totalAmount} from ${summary.expenseCount} active expenses`
                : 'Unavailable'}
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

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
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
        <Select
          value={query.category ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              category: (e.target.value as ExpenseCategory) || undefined,
            }))
          }
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load expenses" description={error} onRetry={() => void load()} />
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses found" description="Record an expense to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Recorded By</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{expense.date}</td>
                  <td className="px-4 py-3">{CATEGORY_LABELS[expense.category]}</td>
                  <td className="px-4 py-3">{expense.description}</td>
                  <td className="px-4 py-3">EUR {expense.amount}</td>
                  <td className="px-4 py-3">{expense.recordedBy}</td>
                  <td className="px-4 py-3">
                    <Badge variant={expense.status === 'VOIDED' ? 'secondary' : 'outline'}>{expense.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {canManage && expense.status === 'ACTIVE' ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(expense)}>
                          Edit
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={expense.status === 'VOIDED'}
                          onClick={() => setVoidTarget(expense)}
                        >
                          Void
                        </Button>
                      ) : null}
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
          Page {meta.page} of {meta.totalPages} · {meta.total} expenses
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit expense' : 'Record expense'}</DialogTitle>
          <DialogDescription>Amounts are stored as decimals and validated on the server.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ExpenseCategory }))}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </div>
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <Input
            type="date"
            value={form.expenseDate}
            onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
          />
          <Select
            value={form.paymentMethod}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
          >
            <option value="">Payment method (optional)</option>
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Reference (optional)"
            value={form.reference}
            onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
          />
          <Textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!form.description.trim() || !form.amount || Number(form.amount) <= 0 || !form.expenseDate}
          >
            {editing ? 'Save changes' : 'Save expense'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(voidTarget)} onOpenChange={() => setVoidTarget(null)}>
        <DialogHeader>
          <DialogTitle>Void expense</DialogTitle>
          <DialogDescription>
            Void EUR {voidTarget?.amount} for {voidTarget?.description}? The record stays in history.
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
