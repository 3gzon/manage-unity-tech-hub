import type { ClassSessionStatus as ApiClassSessionStatus } from '@unity/types';
import { ClassSessionStatus } from '@prisma/client';

export function toApiSessionStatus(status: ClassSessionStatus): ApiClassSessionStatus {
  return status as ApiClassSessionStatus;
}
