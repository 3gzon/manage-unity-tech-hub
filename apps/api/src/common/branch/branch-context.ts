import { AsyncLocalStorage } from 'node:async_hooks';
import { NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

export const VUSHTRRI_BRANCH_ID = 'a1000000-0000-4000-8000-000000000001';
export const SKENDERAJ_BRANCH_ID = 'a2000000-0000-4000-8000-000000000002';

const TENANT_MODELS = new Set([
  'Student',
  'Parent',
  'Instructor',
  'Course',
  'Group',
  'Family',
  'Enrollment',
  'ClassSession',
  'Attendance',
  'StudentFeedback',
  'Discount',
  'Invoice',
  'Payment',
  'Expense',
  'EmploymentContract',
  'Certificate',
  'InstructorCompensationRule',
  'InstructorCompensation',
  'SystemSettings',
  'CourseMaterialTopic',
  'CourseMaterial',
  'CourseMaterialReview',
  'CourseMaterialComment',
]);

const LIST_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const branchStorage = new AsyncLocalStorage<{ branchId: string | null }>();

export function bindBranchContext(next: () => void) {
  branchStorage.run({ branchId: null }, next);
}

export function setCurrentBranch(branchId: string | null) {
  const store = branchStorage.getStore();
  if (store) store.branchId = branchId;
}

export function currentBranchId() {
  return branchStorage.getStore()?.branchId ?? null;
}

function delegateName(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type ScopeArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  create?: Record<string, unknown>;
};

export async function applyBranchScope(
  base: PrismaClient,
  model: string | undefined,
  operation: string,
  args: ScopeArgs,
  query: (args: ScopeArgs) => Promise<unknown>,
) {
  const branchId = currentBranchId();
  if (!branchId || !model || !TENANT_MODELS.has(model)) {
    return query(args);
  }

  if (LIST_OPERATIONS.has(operation)) {
    args.where = { AND: [args.where ?? {}, { branchId }] };
    return query(args);
  }

  if (operation === 'create') {
    args.data = { ...(args.data as Record<string, unknown>), branchId: (args.data as Record<string, unknown> | undefined)?.branchId ?? branchId };
    return query(args);
  }

  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const rows = Array.isArray(args.data) ? args.data : args.data ? [args.data] : [];
    args.data = rows.map((row) => ({ ...row, branchId: row.branchId ?? branchId }));
    return query(args);
  }

  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    const result = (await query(args)) as { branchId?: string } | null;
    if (result && result.branchId && result.branchId !== branchId) {
      if (operation === 'findUniqueOrThrow') {
        throw new NotFoundException('Record not found');
      }
      return null;
    }
    return result;
  }

  if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
    const delegate = (base as unknown as Record<string, { findUnique: (input: unknown) => Promise<{ branchId?: string } | null> }>)[
      delegateName(model)
    ];
    if (delegate && args.where) {
      const existing = await delegate.findUnique({ where: args.where, select: { branchId: true } });
      if (!existing || existing.branchId !== branchId) {
        throw new NotFoundException('Record not found');
      }
    }
    if (operation === 'upsert' && args.create) {
      args.create = { ...args.create, branchId: args.create.branchId ?? branchId };
    }
    return query(args);
  }

  return query(args);
}
