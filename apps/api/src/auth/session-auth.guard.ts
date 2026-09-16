import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import type { RequestUser } from '../common/request-user';
import { AuthService } from './auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crm_session';
    const token = (request.cookies as Record<string, string> | undefined)?.[cookieName];
    const user = await this.auth.authenticate(token);
    if (!user) throw new UnauthorizedException('Debe iniciar sesión.');
    request.user = user;
    return true;
  }
}
