'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CompensationListQuery,
  CompensationLookups,
  CompensationPreview,
  CompensationRecord,
  CompensationRule,
  CompensationStatus,
  CompensationType,
  CreateCompensationRuleRequest,
} from '@unity/types';
import {
  adjustCompensation,
  archiveCompensationRule,
  calculateCompensation,
  createCompensationRule,
  fetchCompensationLookups,
  fetchCompensationRecords,
  fetchCompensationRules,
  saveCompensationSnapshot,
  updateCompensationStatus,
} from '@/lib/compensation-api';
import { hasPermission, hasRole } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Tab = 'calculator' | 'history' | 'rules';

const TYPES: CompensationType[] = ['FIXED', 'PERCENTAGE', 'PER_STUDENT', 'HOURLY'];
const STATUSES: CompensationStatus[] = ['DRAFT', 'APPROVED', 'PAID'];

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function money(value: string | null | undefined) {
  if (!value) return '—';
  return `EUR ${value}`;
}

function statusVariant(status: CompensationStatus | null) {
  if (status === 'PAID') return 'default' as const;
  if (status === 'APPROVED') return 'secondary' as const;
  return 'outline' as const;
}

export function CompensationPageContent() {
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN');
  const canManage = hasPermission(user, 'compensation.manage');

  const [tab, setTab] = useState<Tab>('calculator');
  const [lookups, setLookups] = useState<CompensationLookups>({
    instructors: [],
    courses: [],
    groups: [],
  });

  const [period, setPeriod] = useState(currentPeriod());
  const [instructorId, setInstructorId] = useState('');
  const [preview, setPreview] = useState<CompensationPreview | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [historyQuery, setHistoryQuery] = useState<CompensationListQuery>({ page: 1, pageSize: 20 });
  const [records, setRecords] = useState<CompensationRecord[]>([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [rulesQuery, setRulesQuery] = useState<CompensationListQuery>({ page: 1, pageSize: 20 });
  const [rules, setRules] = useState<CompensationRule[]>([]);
  const [rulesMeta, setRulesMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<CreateCompensationRuleRequest>({
    instructorId: '',
    type: 'PERCENTAGE',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  const [adjustTarget, setAdjustTarget] = useState<CompensationRecord | null>(null);
  const [adjustments, setAdjustments] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    try {
      setLookups(await fetchCompensationLookups());
    } catch {
      setLookups({ instructors: [], courses: [], groups: [] });
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetchCompensationRecords(historyQuery);
      setRecords(res.data);
      setHistoryMeta(res.meta);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load compensation history');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyQuery]);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const res = await fetchCompensationRules(rulesQuery);
      setRules(res.data);
      setRulesMeta(res.meta);
    } catch (err) {
      setRulesError(err instanceof Error ? err.message : 'Failed to load compensation rules');
    } finally {
      setRulesLoading(false);
    }
  }, [rulesQuery]);

  useEffect(() => {
    if (!allowed) return;
    void loadLookups();
  }, [allowed, loadLookups]);

  useEffect(() => {
    if (!allowed || tab !== 'history') return;
    void loadHistory();
  }, [allowed, tab, loadHistory]);

  useEffect(() => {
    if (!allowed || tab !== 'rules') return;
    void loadRules();
  }, [allowed, tab, loadRules]);

  const instructorGroups = useMemo(
    () => lookups.groups.filter((group) => !ruleForm.instructorId || group.instructorId === ruleForm.instructorId),
    [lookups.groups, ruleForm.instructorId],
  );

  async function handleCalculate() {
    setCalcError(null);
    setCalculating(true);
    try {
      setPreview(await calculateCompensation({ instructorId, period }));
    } catch (err) {
      setPreview(null);
      setCalcError(err instanceof Error ? err.message : 'Could not calculate compensation');
    } finally {
      setCalculating(false);
    }
  }

  async function handleSaveSnapshot() {
    setCalcError(null);
    setSaving(true);
    try {
      setPreview(await saveCompensationSnapshot({ instructorId, period }));
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : 'Could not save compensation snapshot');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRule() {
    setRuleError(null);
    try {
      const payload: CreateCompensationRuleRequest = {
        instructorId: ruleForm.instructorId,
        type: ruleForm.type,
        effectiveFrom: ruleForm.effectiveFrom,
        courseId: ruleForm.courseId || undefined,
        groupId: ruleForm.groupId || undefined,
        effectiveUntil: ruleForm.effectiveUntil || undefined,
      };
      if (ruleForm.type === 'PERCENTAGE') payload.percentage = Number(ruleForm.percentage);
      if (ruleForm.type === 'FIXED') payload.fixedAmount = Number(ruleForm.fixedAmount);
      if (ruleForm.type === 'PER_STUDENT') payload.amountPerStudent = Number(ruleForm.amountPerStudent);
      if (ruleForm.type === 'HOURLY') payload.hourlyRate = Number(ruleForm.hourlyRate);

      await createCompensationRule(payload);
      setRuleOpen(false);
      setRuleForm({
        instructorId: '',
        type: 'PERCENTAGE',
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
      await loadRules();
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : 'Could not create rule');
    }
  }

  async function handleArchiveRule(id: string) {
    try {
      await archiveCompensationRule(id);
      await loadRules();
    } catch (err) {
      setRulesError(err instanceof Error ? err.message : 'Could not archive rule');
    }
  }

  async function handleAdjust() {
    if (!adjustTarget) return;
    setAdjustError(null);
    try {
      await adjustCompensation(adjustTarget.id, {
        adjustments: Number(adjustments),
        adjustmentReason,
      });
      setAdjustTarget(null);
      setAdjustments('');
      setAdjustmentReason('');
      await loadHistory();
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Could not apply adjustment');
    }
  }

  async function handleStatus(record: CompensationRecord, status: CompensationStatus) {
    try {
      await updateCompensationStatus(record.id, { status });
      await loadHistory();
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  if (!allowed) {
    return (
      <EmptyState
        title="Access restricted"
        description="Instructor compensation is available only to admins."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Instructor Compensation</h1>
          <p className="text-sm text-muted-foreground">
            Calculate monthly payouts from saved rules. Approved snapshots stay frozen when rules change.
          </p>
        </div>
        {canManage && tab === 'rules' ? (
          <Button onClick={() => setRuleOpen(true)}>New rule</Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['calculator', 'Calculator'],
          ['history', 'History'],
          ['rules', 'Rules'],
        ] as const).map(([value, label]) => (
          <Button key={value} variant={tab === value ? 'default' : 'outline'} onClick={() => setTab(value)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === 'calculator' ? (
        <section className="space-y-4">
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-[220px_1fr_auto_auto]">
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <Select value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
              <option value="">Select instructor</option>
              {lookups.instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </Select>
            <Button disabled={!instructorId || !period || calculating} onClick={() => void handleCalculate()}>
              {calculating ? 'Calculating…' : 'Calculate'}
            </Button>
            {canManage ? (
              <Button
                variant="outline"
                disabled={!preview || saving}
                onClick={() => void handleSaveSnapshot()}
              >
                {saving ? 'Saving…' : 'Save snapshot'}
              </Button>
            ) : null}
          </div>

          {calcError ? <ErrorState title="Calculation failed" description={calcError} /> : null}

          {calculating ? (
            <Skeleton className="h-56 w-full" />
          ) : preview ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryCard label="Revenue basis" value={money(preview.totalGrossRevenue)} />
                <SummaryCard label="Calculated" value={money(preview.totalCalculated)} />
                <SummaryCard label="Adjustments" value={money(preview.totalAdjustments)} />
                <SummaryCard label="Final amount" value={money(preview.totalFinal)} />
              </div>
              {preview.lines.length === 0 ? (
                <EmptyState
                  title="No groups taught"
                  description="This instructor has no overlapping groups, enrollments, or snapshots for the selected month."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-full text-sm">
                    <thead className="border-b bg-muted/40 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">Group</th>
                        <th className="px-4 py-3 font-medium">Students</th>
                        <th className="px-4 py-3 font-medium">Revenue basis</th>
                        <th className="px-4 py-3 font-medium">Rule</th>
                        <th className="px-4 py-3 font-medium">Calculated</th>
                        <th className="px-4 py-3 font-medium">Adjustments</th>
                        <th className="px-4 py-3 font-medium">Final</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lines.map((line) => (
                        <tr key={line.groupId} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium">{line.groupName}</p>
                            <p className="text-xs text-muted-foreground">{line.courseName}</p>
                          </td>
                          <td className="px-4 py-3">{line.studentCount}</td>
                          <td className="px-4 py-3">{money(line.grossRevenue)}</td>
                          <td className="px-4 py-3">
                            <p>{line.ruleLabel}</p>
                            {line.hoursTaught !== '0.00' ? (
                              <p className="text-xs text-muted-foreground">{line.hoursTaught} hours</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">{money(line.calculatedAmount)}</td>
                          <td className="px-4 py-3">
                            {money(line.adjustments)}
                            {line.adjustmentReason ? (
                              <p className="text-xs text-muted-foreground">{line.adjustmentReason}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">{money(line.finalAmount)}</td>
                          <td className="px-4 py-3">
                            {line.existingStatus ? (
                              <Badge variant={statusVariant(line.existingStatus)}>
                                {line.existingStatus}
                                {line.locked ? ' · locked' : ''}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Unsaved</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="Choose a month and instructor"
              description="The calculator shows groups taught, student count, revenue basis, matched rule, and final amount."
            />
          )}
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className="space-y-4">
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
            <Select
              value={historyQuery.instructorId ?? ''}
              onChange={(e) =>
                setHistoryQuery((prev) => ({ ...prev, page: 1, instructorId: e.target.value || undefined }))
              }
            >
              <option value="">All instructors</option>
              {lookups.instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </Select>
            <Input
              type="month"
              value={historyQuery.period ?? ''}
              onChange={(e) =>
                setHistoryQuery((prev) => ({ ...prev, page: 1, period: e.target.value || undefined }))
              }
            />
            <Select
              value={historyQuery.status ?? ''}
              onChange={(e) =>
                setHistoryQuery((prev) => ({
                  ...prev,
                  page: 1,
                  status: (e.target.value as CompensationStatus) || undefined,
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

          {historyLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : historyError ? (
            <ErrorState title="Unable to load history" description={historyError} onRetry={() => void loadHistory()} />
          ) : records.length === 0 ? (
            <EmptyState title="No snapshots yet" description="Save a monthly calculation to keep a historical record." />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Instructor</th>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-4 py-3 font-medium">Students</th>
                    <th className="px-4 py-3 font-medium">Revenue</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Calculated</th>
                    <th className="px-4 py-3 font-medium">Adjustments</th>
                    <th className="px-4 py-3 font-medium">Final</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{record.period}</td>
                      <td className="px-4 py-3">{record.instructorName}</td>
                      <td className="px-4 py-3">
                        <p>{record.groupName}</p>
                        <p className="text-xs text-muted-foreground">{record.courseName}</p>
                      </td>
                      <td className="px-4 py-3">{record.studentCount}</td>
                      <td className="px-4 py-3">{money(record.grossRevenue)}</td>
                      <td className="px-4 py-3">{record.calculationType}</td>
                      <td className="px-4 py-3">{money(record.calculatedAmount)}</td>
                      <td className="px-4 py-3">
                        {money(record.adjustments)}
                        {record.adjustmentReason ? (
                          <p className="text-xs text-muted-foreground">{record.adjustmentReason}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{money(record.finalAmount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {canManage && record.status === 'DRAFT' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAdjustTarget(record);
                                setAdjustments(record.adjustments);
                                setAdjustmentReason(record.adjustmentReason ?? '');
                              }}
                            >
                              Adjust
                            </Button>
                          ) : null}
                          {canManage && record.status === 'DRAFT' ? (
                            <Button variant="ghost" size="sm" onClick={() => void handleStatus(record, 'APPROVED')}>
                              Approve
                            </Button>
                          ) : null}
                          {canManage && record.status === 'APPROVED' ? (
                            <Button variant="ghost" size="sm" onClick={() => void handleStatus(record, 'PAID')}>
                              Mark paid
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

          <Pager
            page={historyMeta.page}
            totalPages={historyMeta.totalPages}
            total={historyMeta.total}
            noun="records"
            onPrev={() => setHistoryQuery((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
            onNext={() => setHistoryQuery((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
          />
        </section>
      ) : null}

      {tab === 'rules' ? (
        <section className="space-y-4">
          <div className="rounded-xl border p-4 md:w-80">
            <Select
              value={rulesQuery.instructorId ?? ''}
              onChange={(e) =>
                setRulesQuery((prev) => ({ ...prev, page: 1, instructorId: e.target.value || undefined }))
              }
            >
              <option value="">All instructors</option>
              {lookups.instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </Select>
          </div>

          {rulesLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : rulesError ? (
            <ErrorState title="Unable to load rules" description={rulesError} onRetry={() => void loadRules()} />
          ) : rules.length === 0 ? (
            <EmptyState title="No compensation rules" description="Create a rule before calculating monthly payouts." />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Instructor</th>
                    <th className="px-4 py-3 font-medium">Scope</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">Effective</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{rule.instructorName}</td>
                      <td className="px-4 py-3">
                        {rule.groupName ?? rule.courseName ?? 'All groups'}
                      </td>
                      <td className="px-4 py-3">{rule.type}</td>
                      <td className="px-4 py-3">{ruleValue(rule)}</td>
                      <td className="px-4 py-3">
                        {rule.effectiveFrom}
                        {rule.effectiveUntil ? ` – ${rule.effectiveUntil}` : ' – open'}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <Button variant="ghost" size="sm" onClick={() => void handleArchiveRule(rule.id)}>
                            Archive
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pager
            page={rulesMeta.page}
            totalPages={rulesMeta.totalPages}
            total={rulesMeta.total}
            noun="rules"
            onPrev={() => setRulesQuery((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
            onNext={() => setRulesQuery((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
          />
        </section>
      ) : null}

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogHeader>
          <DialogTitle>New compensation rule</DialogTitle>
          <DialogDescription>
            Group rules override course rules, which override instructor-wide rules.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select
            value={ruleForm.instructorId}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, instructorId: e.target.value, groupId: undefined }))}
          >
            <option value="">Select instructor</option>
            {lookups.instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </Select>
          <Select
            value={ruleForm.courseId ?? ''}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, courseId: e.target.value || undefined }))}
          >
            <option value="">All courses</option>
            {lookups.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </Select>
          <Select
            value={ruleForm.groupId ?? ''}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, groupId: e.target.value || undefined }))}
          >
            <option value="">All groups</option>
            {instructorGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Select
            value={ruleForm.type}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, type: e.target.value as CompensationType }))}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          {ruleForm.type === 'PERCENTAGE' ? (
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Percentage"
              value={ruleForm.percentage ?? ''}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, percentage: Number(e.target.value) }))}
            />
          ) : null}
          {ruleForm.type === 'FIXED' ? (
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Fixed amount"
              value={ruleForm.fixedAmount ?? ''}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, fixedAmount: Number(e.target.value) }))}
            />
          ) : null}
          {ruleForm.type === 'PER_STUDENT' ? (
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount per student"
              value={ruleForm.amountPerStudent ?? ''}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, amountPerStudent: Number(e.target.value) }))}
            />
          ) : null}
          {ruleForm.type === 'HOURLY' ? (
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Hourly rate"
              value={ruleForm.hourlyRate ?? ''}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, hourlyRate: Number(e.target.value) }))}
            />
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Effective from</Label>
              <Input
                type="date"
                value={ruleForm.effectiveFrom}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Effective until</Label>
              <Input
                type="date"
                value={ruleForm.effectiveUntil ?? ''}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, effectiveUntil: e.target.value || undefined }))}
              />
            </div>
          </div>
          {ruleError ? <p className="text-sm text-red-600">{ruleError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRuleOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!ruleForm.instructorId || !ruleForm.effectiveFrom} onClick={() => void handleCreateRule()}>
            Save rule
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(adjustTarget)} onOpenChange={() => setAdjustTarget(null)}>
        <DialogHeader>
          <DialogTitle>Adjust compensation</DialogTitle>
          <DialogDescription>
            Adjustment for {adjustTarget?.instructorName} / {adjustTarget?.groupName} ({adjustTarget?.period}).
            This change is audited.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Calculated amount: {money(adjustTarget?.calculatedAmount)}
          </p>
          <Input
            type="number"
            step="0.01"
            placeholder="Adjustment (can be negative)"
            value={adjustments}
            onChange={(e) => setAdjustments(e.target.value)}
          />
          <Textarea
            placeholder="Reason (required)"
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
          />
          {adjustError ? <p className="text-sm text-red-600">{adjustError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAdjustTarget(null)}>
            Cancel
          </Button>
          <Button disabled={!adjustmentReason.trim() || adjustments === ''} onClick={() => void handleAdjust()}>
            Save adjustment
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function ruleValue(rule: CompensationRule) {
  if (rule.type === 'PERCENTAGE') return `${rule.percentage ?? '0.00'}%`;
  if (rule.type === 'FIXED') return money(rule.fixedAmount);
  if (rule.type === 'PER_STUDENT') return `${money(rule.amountPerStudent)} / student`;
  return `${money(rule.hourlyRate)} / hour`;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  noun,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  noun: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total} {noun}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
