import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { setCurrentBranch, VUSHTRRI_BRANCH_ID } from './branch-context';

@Injectable()
export class BranchContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const user = request.user;
    if (!user) {
      setCurrentBranch(null);
      return true;
    }

    if (user.roles.includes('SUPER_ADMIN')) {
      const header = request.headers['x-branch-id'];
      const requested = Array.isArray(header) ? header[0] : header;
      const branch = isUuid(requested)
        ? await this.prisma.branch.findUnique({ where: { id: requested }, select: { id: true } })
        : null;
      setCurrentBranch(branch?.id ?? VUSHTRRI_BRANCH_ID);
      return true;
    }

    setCurrentBranch(user.branchId);
    return true;
  }
}

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
