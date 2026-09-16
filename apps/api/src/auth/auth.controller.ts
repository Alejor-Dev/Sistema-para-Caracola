import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/request-user';
import { Public } from '../common/public.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './change-password.dto';
import { LoginDto } from './login.dto';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly audit: AuditService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() input: LoginDto, @Req() request: Request & { id?: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(input.username, input.password, { ip: request.ip, userAgent: request.get('user-agent') });
    response.cookie(process.env.SESSION_COOKIE_NAME ?? 'crm_session', result.token, this.cookieOptions(result.expiresAt));
    await this.audit.record({ action: 'auth.login', entityType: 'session', entityId: result.sessionId, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id });
    return { expiresAt: result.expiresAt };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    const { sessionId: _, ...user } = request.user;
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.user.sessionId);
    response.clearCookie(process.env.SESSION_COOKIE_NAME ?? 'crm_session', { path: '/' });
    await this.audit.record({ actorUserId: request.user.id, action: 'auth.logout', entityType: 'session', entityId: request.user.sessionId, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id });
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@Body() input: ChangePasswordDto, @Req() request: AuthenticatedRequest): Promise<void> {
    await this.auth.changePassword(request.user.id, request.user.sessionId, input.currentPassword, input.newPassword);
    await this.audit.record({ actorUserId: request.user.id, action: 'auth.password_changed', entityType: 'user', entityId: request.user.id, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id });
  }

  private cookieOptions(expires: Date) {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', expires };
  }
}
