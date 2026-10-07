import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthTokensResponse, AuthUser } from '@unity/types';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { REFRESH_TOKEN_COOKIE } from '../../common/constants/auth.constants';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import type { AuthTokensWithRefresh } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse> {
    const result = await this.authService.login(dto, this.getIp(req));
    this.setRefreshCookie(res, result.refreshToken);
    return this.stripRefreshToken(result);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse> {
    const refreshToken = dto.refreshToken ?? req.cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await this.authService.refresh(refreshToken, this.getIp(req));
    this.setRefreshCookie(res, result.refreshToken);
    return this.stripRefreshToken(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = dto.refreshToken ?? req.cookies?.[REFRESH_TOKEN_COOKIE];
    await this.authService.logout(refreshToken, user.id, this.getIp(req));
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
    return this.authService.getMe(user.id);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private stripRefreshToken(result: AuthTokensWithRefresh): AuthTokensResponse {
    const { refreshToken: _removed, ...response } = result;
    return response;
  }

  private getIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim();
    }
    return req.ip;
  }
}
