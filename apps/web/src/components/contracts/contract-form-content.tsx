'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type {
  EmploymentContractDetail,
  EmploymentContractInput,
  EmploymentContractStatus,
  EmploymentContractType,
  ManagedUser,
} from '@unity/types';
import { createContract, downloadContractPdf, fetchContract, updateContract } from '@/lib/contracts-api';
import { fetchUsers } from '@/lib/users-api';
import { isSuperAdmin } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const TYPES: EmploymentContractType[] = ['COLLABORATION', 'INDEFINITE', 'FIXED_TERM', 'SPECIFIC_TASK'];
const STATUSES: EmploymentContractStatus[] = ['DRAFT', 'ISSUED', 'ACTIVE', 'TERMINATED'];
const DEFAULT_PERCENTAGE_BASE =
  'Collected student payments for groups assigned to the collaborator';

function typeLabel(type: EmploymentContractType) {
  if (type === 'INDEFINITE') return 'Indefinite employment';
  if (type === 'FIXED_TERM') return 'Fixed-term employment';
  if (type === 'SPECIFIC_TASK') return 'Specific-task employment';
  return 'Collaboration (percentage)';
}

function emptyForm(): EmploymentContractInput & { status?: EmploymentContractStatus } {
  return {
    employeeUserId: '',
    type: 'COLLABORATION',
    timeType: 'PART_TIME',
    employerName: 'Unity Tech Hub',
    employerSeat: 'Prishtine, Republika e Kosoves',
    employerRegistrationNumber: '',
    employeeFirstName: '',
    employeeLastName: '',
    employeeQualification: '',
    employeeResidence: '',
    employeePersonalNumber: '',
    jobTitle: '',
    jobNature: 'Teaching collaboration / instruction services',
    jobDescription: '',
    workplace: 'Unity Tech Hub, Prishtine',
    workInMultipleLocations: false,
    weeklyHours: 20,
    workSchedule: 'As scheduled with assigned groups',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    baseSalary: 0,
    collaborationPercentage: 40,
    percentageBase: DEFAULT_PERCENTAGE_BASE,
    allowances: '',
    paymentDay: 5,
    annualLeaveDays: 0,
    noticePeriodDays: 15,
    terminationTerms: '',
    probationMonths: 0,
    agreedTerms: '',
    notes: '',
    status: 'DRAFT',
  };
}

function fromDetail(contract: EmploymentContractDetail) {
  return {
    employeeUserId: contract.employeeUserId,
    type: contract.type,
    timeType: contract.timeType,
    employerName: contract.employerName,
    employerSeat: contract.employerSeat,
    employerRegistrationNumber: contract.employerRegistrationNumber,
    employeeFirstName: contract.employeeFirstName,
    employeeLastName: contract.employeeLastName,
    employeeQualification: contract.employeeQualification,
    employeeResidence: contract.employeeResidence,
    employeePersonalNumber: contract.employeePersonalNumber ?? '',
    jobTitle: contract.jobTitle,
    jobNature: contract.jobNature,
    jobDescription: contract.jobDescription,
    workplace: contract.workplace,
    workInMultipleLocations: contract.workInMultipleLocations,
    weeklyHours: contract.weeklyHours,
    workSchedule: contract.workSchedule,
    startDate: contract.startDate,
    endDate: contract.endDate ?? '',
    baseSalary: Number(contract.baseSalary),
    collaborationPercentage: contract.collaborationPercentage ? Number(contract.collaborationPercentage) : 40,
    percentageBase: contract.percentageBase ?? DEFAULT_PERCENTAGE_BASE,
    allowances: contract.allowances ?? '',
    paymentDay: contract.paymentDay ?? 5,
    annualLeaveDays: contract.annualLeaveDays,
    noticePeriodDays: contract.noticePeriodDays,
    terminationTerms: contract.terminationTerms ?? '',
    probationMonths: contract.probationMonths,
    agreedTerms: contract.agreedTerms ?? '',
    notes: contract.notes ?? '',
    status: contract.status,
  };
}

export function ContractFormContent({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const allowed = isSuperAdmin(user);

  const [employees, setEmployees] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [contractNumber, setContractNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchUsers({ page: 1, pageSize: 100 })
      .then((res) =>
        setEmployees(res.data.filter((item) => item.role === 'ADMIN' || item.role === 'INSTRUCTOR')),
      )
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !params.id) return;
    void fetchContract(params.id)
      .then((contract) => {
        setForm(fromDetail(contract));
        setContractNumber(contract.contractNumber);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contract'))
      .finally(() => setLoading(false));
  }, [mode, params.id]);

  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === form.employeeUserId),
    [employees, form.employeeUserId],
  );

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { status, ...formFields } = form;
      const payload: EmploymentContractInput = {
        ...formFields,
        endDate: form.type === 'INDEFINITE' ? undefined : form.endDate || undefined,
        collaborationPercentage:
          form.type === 'COLLABORATION' ? form.collaborationPercentage : undefined,
        percentageBase: form.type === 'COLLABORATION' ? form.percentageBase || DEFAULT_PERCENTAGE_BASE : undefined,
        employeePersonalNumber: form.employeePersonalNumber || undefined,
        allowances: form.allowances || undefined,
        terminationTerms: form.terminationTerms || undefined,
        agreedTerms: form.agreedTerms || undefined,
        notes: form.notes || undefined,
      };
      if (mode === 'create') {
        const created = await createContract(payload);
        router.push(`/contracts/${created.id}`);
        return;
      }
        const updated = await updateContract(params.id, { ...payload, status });
      setForm(fromDetail(updated));
      setContractNumber(updated.contractNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save contract');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return <EmptyState title="Access restricted" description="Employment contracts are available only to Super Admin." />;
  }

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error && mode === 'edit' && !contractNumber) {
    return <ErrorState title="Contract unavailable" description={error} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Back to contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {mode === 'create'
            ? form.type === 'COLLABORATION'
              ? 'New collaboration agreement'
              : 'New employment contract'
            : contractNumber}
        </h1>
        <p className="text-sm text-muted-foreground">
          Employment contracts follow Kosovo Labour Law No. 03/L-212. Collaboration is for instructors paid a
          percentage from student payments, based on the agreement you discuss.
        </p>
        {form.status ? (
          <div className="mt-2">
            <Badge variant="outline">{form.status}</Badge>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Section title={form.type === 'COLLABORATION' ? 'Collaborator' : 'Employee'}>
        <Select
          value={form.employeeUserId}
          onChange={(e) => {
            const employee = employees.find((item) => item.id === e.target.value);
            setForm((current) => ({
              ...current,
              employeeUserId: e.target.value,
              employeeFirstName: employee?.firstName ?? current.employeeFirstName,
              employeeLastName: employee?.lastName ?? current.employeeLastName,
            }));
          }}
        >
          <option value="">{form.type === 'COLLABORATION' ? 'Select instructor' : 'Select employee'}</option>
          {employees
            .filter((item) => form.type !== 'COLLABORATION' || item.role === 'INSTRUCTOR')
            .map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} · {employee.role}
            </option>
          ))}
        </Select>
        {selectedEmployee ? (
          <p className="text-sm text-muted-foreground">{selectedEmployee.email}</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="First name">
            <Input value={form.employeeFirstName} onChange={(e) => patch('employeeFirstName', e.target.value)} />
          </Field>
          <Field label="Last name">
            <Input value={form.employeeLastName} onChange={(e) => patch('employeeLastName', e.target.value)} />
          </Field>
          <Field label="Qualification">
            <Input value={form.employeeQualification} onChange={(e) => patch('employeeQualification', e.target.value)} />
          </Field>
          <Field label="Residence">
            <Input value={form.employeeResidence} onChange={(e) => patch('employeeResidence', e.target.value)} />
          </Field>
          <Field label="Personal number (optional)">
            <Input
              value={form.employeePersonalNumber}
              onChange={(e) => patch('employeePersonalNumber', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Employer (Neni 11.1.1)">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Employer name">
            <Input value={form.employerName} onChange={(e) => patch('employerName', e.target.value)} />
          </Field>
          <Field label="Seat">
            <Input value={form.employerSeat} onChange={(e) => patch('employerSeat', e.target.value)} />
          </Field>
          <Field label="Business registration number">
            <Input
              value={form.employerRegistrationNumber}
              onChange={(e) => patch('employerRegistrationNumber', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title={form.type === 'COLLABORATION' ? 'Agreement type and duration' : 'Contract type and duration (Neni 10)'}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as EmploymentContractType;
                setForm((current) => ({
                  ...current,
                  type,
                  employeeUserId:
                    type === 'COLLABORATION' &&
                    employees.find((item) => item.id === current.employeeUserId)?.role !== 'INSTRUCTOR'
                      ? ''
                      : current.employeeUserId,
                  endDate: type === 'INDEFINITE' || type === 'COLLABORATION' ? '' : current.endDate,
                  jobNature:
                    type === 'COLLABORATION'
                      ? 'Teaching collaboration / instruction services'
                      : current.jobNature === 'Teaching collaboration / instruction services'
                        ? 'Teaching and education services'
                        : current.jobNature,
                  annualLeaveDays: type === 'COLLABORATION' ? 0 : Math.max(current.annualLeaveDays, 20),
                  probationMonths: type === 'COLLABORATION' ? 0 : current.probationMonths || 3,
                  noticePeriodDays: type === 'COLLABORATION' ? 15 : Math.max(current.noticePeriodDays, 7),
                  collaborationPercentage: current.collaborationPercentage || 40,
                  percentageBase: current.percentageBase || DEFAULT_PERCENTAGE_BASE,
                }));
              }}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Time">
            <Select value={form.timeType} onChange={(e) => patch('timeType', e.target.value as 'FULL_TIME' | 'PART_TIME')}>
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
            </Select>
          </Field>
          {mode === 'edit' ? (
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => patch('status', e.target.value as EmploymentContractStatus)}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Start date">
            <Input type="date" value={form.startDate} onChange={(e) => patch('startDate', e.target.value)} />
          </Field>
          {form.type === 'COLLABORATION' ? (
            <Field label="End date (optional)">
              <Input type="date" value={form.endDate} onChange={(e) => patch('endDate', e.target.value)} />
            </Field>
          ) : form.type !== 'INDEFINITE' ? (
            <Field label={form.type === 'SPECIFIC_TASK' ? 'End date (max 120 days)' : 'End date (max 10 years)'}>
              <Input type="date" value={form.endDate} onChange={(e) => patch('endDate', e.target.value)} />
            </Field>
          ) : null}
        </div>
      </Section>

      <Section title="Job (Neni 11.1.3-11.1.5)">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Job title">
            <Input value={form.jobTitle} onChange={(e) => patch('jobTitle', e.target.value)} />
          </Field>
          <Field label="Nature / type of work">
            <Input value={form.jobNature} onChange={(e) => patch('jobNature', e.target.value)} />
          </Field>
        </div>
        <Field label="Duties">
          <Textarea value={form.jobDescription} onChange={(e) => patch('jobDescription', e.target.value)} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Workplace">
            <Input value={form.workplace} onChange={(e) => patch('workplace', e.target.value)} />
          </Field>
          <Field label={form.type === 'COLLABORATION' ? 'Expected weekly hours' : 'Weekly hours (max 40)'}>
            <Input
              type="number"
              min={form.type === 'COLLABORATION' ? 0 : 1}
              max={40}
              value={form.weeklyHours}
              onChange={(e) => patch('weeklyHours', Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Work schedule">
          <Input value={form.workSchedule} onChange={(e) => patch('workSchedule', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.workInMultipleLocations}
            onChange={(e) => patch('workInMultipleLocations', e.target.checked)}
          />
          Work may be performed in different locations
        </label>
      </Section>

      <Section
        title={
          form.type === 'COLLABORATION'
            ? 'Percentage compensation'
            : 'Pay, leave and notice (Neni 11.1.8-11.1.10, Neni 15)'
        }
      >
        {form.type === 'COLLABORATION' ? (
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Instructor share (%)">
              <Input
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                value={form.collaborationPercentage || ''}
                onChange={(e) => patch('collaborationPercentage', Number(e.target.value))}
              />
            </Field>
            <Field label="Payment day">
              <Input
                type="number"
                min={1}
                max={31}
                value={form.paymentDay ?? ''}
                onChange={(e) => patch('paymentDay', Number(e.target.value))}
              />
            </Field>
            <Field label="Notice period days">
              <Input
                type="number"
                min={0}
                value={form.noticePeriodDays}
                onChange={(e) => patch('noticePeriodDays', Number(e.target.value))}
              />
            </Field>
            <Field label="Optional monthly minimum (EUR)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.baseSalary || ''}
                onChange={(e) => patch('baseSalary', Number(e.target.value))}
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Base salary (EUR / month)">
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={form.baseSalary || ''}
                onChange={(e) => patch('baseSalary', Number(e.target.value))}
              />
            </Field>
            <Field label="Payment day">
              <Input
                type="number"
                min={1}
                max={31}
                value={form.paymentDay ?? ''}
                onChange={(e) => patch('paymentDay', Number(e.target.value))}
              />
            </Field>
            <Field label={form.type === 'SPECIFIC_TASK' ? 'Annual leave days' : 'Annual leave days (min 20)'}>
              <Input
                type="number"
                min={form.type === 'SPECIFIC_TASK' ? 0 : 20}
                value={form.annualLeaveDays}
                onChange={(e) => patch('annualLeaveDays', Number(e.target.value))}
              />
            </Field>
            <Field label="Notice period days (min 7)">
              <Input
                type="number"
                min={7}
                value={form.noticePeriodDays}
                onChange={(e) => patch('noticePeriodDays', Number(e.target.value))}
              />
            </Field>
            <Field label="Probation months (0-6)">
              <Input
                type="number"
                min={0}
                max={6}
                value={form.probationMonths ?? 0}
                onChange={(e) => patch('probationMonths', Number(e.target.value))}
              />
            </Field>
          </div>
        )}
        {form.type === 'COLLABORATION' ? (
          <Field label="Percentage is calculated from">
            <Input
              value={form.percentageBase}
              onChange={(e) => patch('percentageBase', e.target.value)}
            />
          </Field>
        ) : null}
        <Field label={form.type === 'COLLABORATION' ? 'Other agreed amounts' : 'Allowances / other income'}>
          <Input value={form.allowances} onChange={(e) => patch('allowances', e.target.value)} />
        </Field>
        <Field label="Additional termination terms">
          <Textarea value={form.terminationTerms} onChange={(e) => patch('terminationTerms', e.target.value)} />
        </Field>
      </Section>

      <Section title={form.type === 'COLLABORATION' ? 'Terms agreed in discussion' : 'Terms agreed in discussion (Neni 11.1.11)'}>
        <p className="text-sm text-muted-foreground">
          {form.type === 'COLLABORATION'
            ? 'Write the exact deal for this instructor: which groups or courses the percentage covers, when it is paid, and any extra points from the discussion.'
            : 'Put here everything negotiated with this employee that is not in the standard fields: teaching load, bonuses, remote days, extra leave, confidentiality, or other agreed points.'}
        </p>
        <Textarea
          value={form.agreedTerms}
          onChange={(e) => patch('agreedTerms', e.target.value)}
          className="min-h-[140px]"
        />
      </Section>

      <Section title="Internal notes">
        <p className="text-sm text-muted-foreground">Not printed on the contract PDF.</p>
        <Textarea value={form.notes} onChange={(e) => patch('notes', e.target.value)} />
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void handleSave()}
          disabled={
            saving ||
            !form.employeeUserId ||
            !form.jobTitle ||
            !form.jobDescription ||
            !form.employerRegistrationNumber ||
            !form.employeeQualification ||
            !form.employeeResidence ||
            (form.type !== 'INDEFINITE' && form.type !== 'COLLABORATION' && !form.endDate) ||
            (form.type === 'COLLABORATION' && !form.collaborationPercentage) ||
            (form.type !== 'COLLABORATION' && !form.baseSalary)
          }
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create contract' : 'Save changes'}
        </Button>
        {mode === 'edit' && contractNumber && params.id ? (
          <Button
            variant="outline"
            onClick={() => void downloadContractPdf(params.id, contractNumber).catch((err: Error) => setError(err.message))}
          >
            Generate PDF
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
