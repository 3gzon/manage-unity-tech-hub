import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { runWithAuditContext } from './audit-context';
import { getClientIp, getUserAgent } from './audit-request';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const meta = {
      userId: req.user?.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    };

    return new Observable((subscriber) => {
      return runWithAuditContext(meta, () => next.handle().subscribe(subscriber));
    });
  }
}
