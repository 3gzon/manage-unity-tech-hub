'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { fetchSettings, updateSettings } from '@/lib/settings-api';
import { hasPermission } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/dashboard/dashboard-states';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function SettingsPageContent() {
  const { user } = useAuth();
  const allowed = hasPermission(user, 'settings.manage') || user?.roles.includes('SUPER_ADMIN');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    schoolName: '',
    currency: 'EUR',
    email: '',
    phone: '',
    address: '',
    multiCourseDiscountPercent: '10',
    familyPackDiscountPercent: '10',
    invoiceDueDay: '10',
  });

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    void fetchSettings()
      .then((settings) => {
        setForm({
          schoolName: settings.schoolName,
          currency: settings.currency,
          email: settings.email ?? '',
          phone: settings.phone ?? '',
          address: settings.address ?? '',
          multiCourseDiscountPercent: settings.multiCourseDiscountPercent,
          familyPackDiscountPercent: settings.familyPackDiscountPercent,
          invoiceDueDay: String(settings.invoiceDueDay),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, [allowed]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const settings = await updateSettings({
        schoolName: form.schoolName.trim(),
        currency: form.currency.trim().toUpperCase(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        multiCourseDiscountPercent: Number(form.multiCourseDiscountPercent),
        familyPackDiscountPercent: Number(form.familyPackDiscountPercent),
        invoiceDueDay: Number(form.invoiceDueDay),
      });
      setForm((prev) => ({
        ...prev,
        multiCourseDiscountPercent: settings.multiCourseDiscountPercent,
        familyPackDiscountPercent: settings.familyPackDiscountPercent,
      }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return <EmptyState title="Access restricted" description="System settings are available only to admins." />;
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">School details and the discounts used on invoices and payments.</p>
      </div>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-medium">School</h2>
        <Field label="Name">
          <Input value={form.schoolName} onChange={(e) => setForm((prev) => ({ ...prev, schoolName: e.target.value }))} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
        </Field>
        <Field label="Address">
          <Textarea value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-medium">Billing</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Currency">
            <Input
              maxLength={3}
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label="Invoice due day">
            <Input
              type="number"
              min={1}
              max={28}
              value={form.invoiceDueDay}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceDueDay: e.target.value }))}
            />
          </Field>
          <Field label="Extra course discount %">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.multiCourseDiscountPercent}
              onChange={(e) => setForm((prev) => ({ ...prev, multiCourseDiscountPercent: e.target.value }))}
            />
          </Field>
          <Field label="Family pack discount %">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.familyPackDiscountPercent}
              onChange={(e) => setForm((prev) => ({ ...prev, familyPackDiscountPercent: e.target.value }))}
            />
          </Field>
        </div>
        <p className="text-sm text-muted-foreground">
          The most expensive course stays full price. Each extra course is discounted, then the family pack discount applies to what remains. Invoices are due on this day of the month.
        </p>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">Settings saved.</p> : null}

      <Button
        onClick={() => void handleSave()}
        disabled={saving || !form.schoolName.trim() || form.currency.trim().length !== 3}
      >
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
