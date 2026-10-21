import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser, BranchSummary, SystemRole } from '@unity/types';
import { currentBranchId } from '../../common/branch/branch-context';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { JwtPayload } from '../../common/interfaces/authenticated-user.interface';
import type { AuthTokensWithRefresh } from './auth.types';
import { toJwtDuration } from './auth.types';
import { LoginDto } from './dto/login.dto';

type UserWithAccess = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  status: string;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
  branchId: string | null;
  roles: { role: { name: string; permissions: { permission: { resource: string; action: string } }[] } }[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthTokensWithRefresh> {
    const user = await this.findUserByEmail(dto.email);

    if (!user || user.deletedAt) {
      await this.recordFailedLogin(dto.email, ipAddress);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'PENDING') {
      throw new ForbiddenException('Confirm your account from the email, then choose a password.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.recordFailedLogin(dto.email, ipAddress, user.id);
      throw new UnauthorizedException('Invalid email or password');
    }

    const authUser = await this.withBranches(user, this.toAuthUser(user));
    const tokens = await this.issueTokens(user, authUser);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.record({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      newValue: { email: user.email },
      ipAddress,
    });

    return tokens;
  }

  async refresh(refreshToken: string, ipAddress?: string): Promise<AuthTokensWithRefresh> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date() ||
      storedToken.user.deletedAt ||
      storedToken.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const authUser = await this.withBranches(storedToken.user as UserWithAccess, this.toAuthUser(storedToken.user as UserWithAccess));
    const tokens = await this.issueTokens(storedToken.user as UserWithAccess, authUser);

    await this.auditService.record({
      userId: storedToken.userId,
      action: 'TOKEN_REFRESH',
      entity: 'User',
      entityId: storedToken.userId,
      ipAddress,
    });

    return tokens;
  }

  async logout(refreshToken: string | undefined, userId: string, ipAddress?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.record({
      userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress,
    });
  }

  async sendConfirmation(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new BadRequestException('Instructor account was not created');
    const link = await this.issueAccountLink(user.id, 'CONFIRM_ACCOUNT', 7 * 24 * 60 * 60 * 1000);
    const result = await this.mail.sendAccountLink({
      to: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      link,
      purpose: 'confirm',
    });
    if (result.sentTo.length === 0) throw new BadRequestException(result.detail);
  }

  async forgotPassword(email: string) {
    const generic = 'If that email has an account, we sent instructions.';
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || user.deletedAt || user.status === 'DISABLED') return { detail: generic };

    if (user.status === 'PENDING') {
      await this.sendConfirmation(user.id);
      return { detail: generic };
    }

    const link = await this.issueAccountLink(user.id, 'RESET_PASSWORD', 60 * 60 * 1000);
    const result = await this.mail.sendAccountLink({
      to: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      link,
      purpose: 'reset',
    });
    if (result.sentTo.length === 0) throw new BadRequestException(result.detail);
    return { detail: generic };
  }

  async confirmAccount(token: string, password: string) {
    await this.consumeAccountToken(token, password, 'CONFIRM_ACCOUNT');
    return { detail: 'Account confirmed. Sign in with your new password.' };
  }

  async resetPassword(token: string, password: string) {
    await this.consumeAccountToken(token, password, 'RESET_PASSWORD');
    return { detail: 'Password updated. Sign in with your new password.' };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found');
    }

    return this.withBranches(user as UserWithAccess, this.toAuthUser(user as UserWithAccess));
  }

  private async issueTokens(
    user: UserWithAccess,
    authUser: AuthUser,
  ): Promise<AuthTokensWithRefresh> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: authUser.roles,
      permissions: authUser.permissions,
    };

    const expiresIn = toJwtDuration(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
      '15m',
    );
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
    });

    const refreshToken = randomBytes(64).toString('hex');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const expiresAt = this.addDuration(new Date(), refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    const expiresInSeconds = this.parseExpiresInSeconds(expiresIn);

    return {
      accessToken,
      expiresIn: expiresInSeconds,
      tokenType: 'Bearer',
      user: authUser,
      refreshToken,
    };
  }

  private async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  private toAuthUser(user: UserWithAccess): AuthUser {
    const roles = [
      ...new Set(user.roles.map((entry) => entry.role.name as SystemRole)),
    ];
    const permissions = [
      ...new Set(
        user.roles.flatMap((entry) =>
          entry.role.permissions.map(
            (rp) => `${rp.permission.resource}.${rp.permission.action}`,
          ),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      branch: null,
      branches: [],
    };
  }

  private async withBranches(user: UserWithAccess, auth: AuthUser): Promise<AuthUser> {
    const rows = await this.prisma.branch.findMany({ orderBy: { sortOrder: 'asc' } });
    const toSummary = (row: { id: string; code: string; name: string }): BranchSummary => ({
      id: row.id,
      code: row.code,
      name: row.name,
    });
    const home = rows.find((row) => row.id === user.branchId) ?? null;
    const branches = auth.roles.includes('SUPER_ADMIN')
      ? rows.map(toSummary)
      : home
        ? [toSummary(home)]
        : [];
    const activeId = currentBranchId() ?? home?.id ?? branches[0]?.id ?? null;
    return {
      ...auth,
      branches,
      branch: branches.find((item) => item.id === activeId) ?? branches[0] ?? null,
    };
  }

  private async issueAccountLink(userId: string, purpose: 'CONFIRM_ACCOUNT' | 'RESET_PASSWORD', ttlMs: number) {
    await this.prisma.accountToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = randomBytes(32).toString('hex');
    await this.prisma.accountToken.create({
      data: {
        userId,
        purpose,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    const origin = (this.configService.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').replace(/\/$/, '');
    const path = purpose === 'CONFIRM_ACCOUNT' ? 'confirm-account' : 'reset-password';
    return `${origin}/${path}?token=${token}`;
  }

  private async consumeAccountToken(
    token: string,
    password: string,
    purpose: 'CONFIRM_ACCOUNT' | 'RESET_PASSWORD',
  ) {
    const stored = await this.prisma.accountToken.findUnique({
      where: { tokenHash: this.hashToken(token.trim()) },
      include: { user: true },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date() || stored.purpose !== purpose) {
      throw new BadRequestException('This link is invalid or has expired.');
    }
    if (stored.user.deletedAt || stored.user.status === 'DISABLED') {
      throw new BadRequestException('This link is invalid or has expired.');
    }
    if (purpose === 'CONFIRM_ACCOUNT' && stored.user.status !== 'PENDING') {
      throw new BadRequestException('This account is already confirmed. Sign in or use forgot password.');
    }
    if (purpose === 'RESET_PASSWORD' && stored.user.status !== 'ACTIVE') {
      throw new BadRequestException('Confirm your account from the email, then choose a password.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash, status: 'ACTIVE' },
      }),
      this.prisma.accountToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordFailedLogin(email: string, ipAddress?: string, userId?: string) {
    await this.auditService.record({
      userId,
      action: 'LOGIN_FAILED',
      entity: 'User',
      entityId: userId ?? email,
      newValue: { email } as const,
      ipAddress,
    });
  }

  private parseExpiresInSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) {
      return 900;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 3600;
      case 'd':
        return amount * 86400;
      default:
        return 900;
    }
  }

  private addDuration(from: Date, value: string): Date {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) {
      return new Date(from.getTime() + 7 * 86400000);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    } as const;

    if (!unit || !(unit in multipliers)) {
      return new Date(from.getTime() + 7 * 86400000);
    }

    return new Date(from.getTime() + amount * multipliers[unit as keyof typeof multipliers]);
  }
}
