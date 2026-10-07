import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditRequestMeta {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const auditContext = new AsyncLocalStorage<AuditRequestMeta>();

export function runWithAuditContext<T>(meta: AuditRequestMeta, fn: () => T): T {
  return auditContext.run(meta, fn);
}

export function getAuditContext(): AuditRequestMeta | undefined {
  return auditContext.getStore();
}
