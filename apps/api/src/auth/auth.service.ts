import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/request-user';

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos.';

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string, context: { ip?: string; userAgent?: string }) {
    const normalized = username.trim().toLowerCase();
    const attemptKey = `${context.ip ?? 'local'}:${normalized}`;
    this.assertLoginRateLimit(attemptKey);
    const user = await this.prisma.user.findUnique({ where: { username: normalized } });

    if (!user || user.status !== 'ACTIVE' || (user.lockedUntil && user.lockedUntil > new Date())) {
      this.recordFailedAttempt(attemptKey);
      await this.fakeVerify(password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      this.recordFailedAttempt(attemptKey);
      const failures = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failures,
          lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    this.loginAttempts.delete(attemptKey);

    const token = randomBytes(32).toString('base64url');
    const ttlHours = this.numberEnv('SESSION_TTL_HOURS', 12);
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
      return tx.session.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          ip: context.ip,
          userAgent: context.userAgent?.slice(0, 512),
          expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
        },
      });
    });

    return { token, sessionId: session.id, expiresAt: session.expiresAt };
  }

  async authenticate(token?: string): Promise<RequestUser | null> {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
    });

    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || session.user.status !== 'ACTIVE') return null;

    const idleMinutes = this.numberEnv('SESSION_IDLE_MINUTES', 30);
    if (session.lastSeenAt.getTime() + idleMinutes * 60_000 <= now.getTime()) {
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: now, revokeReason: 'idle_timeout' } });
      return null;
    }

    if (session.lastSeenAt.getTime() + 60_000 < now.getTime()) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    const permissions = new Set<string>();
    for (const userRole of session.user.roles) {
      for (const rolePermission of userRole.role.permissions) permissions.add(rolePermission.permission.code);
    }

    return {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      permissions: [...permissions].sort(),
      sessionId: session.id,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'logout' } });
  }

  async changePassword(userId: string, sessionId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }
    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente de la actual.');
    }
    const passwordHash = await AuthService.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
      this.prisma.session.updateMany({ where: { userId, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'password_changed' } }),
    ]);
  }

  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: Number(process.env.ARGON2_MEMORY_KIB ?? 65_536),
      timeCost: Number(process.env.ARGON2_TIME_COST ?? 3),
      parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async fakeVerify(password: string): Promise<void> {
    const dummy = '$argon2id$v=19$m=65536,t=3,p=1$MDAwMDAwMDAwMDAwMDAwMA$1Hob6ofhXm6q0q5aX5y0opQBo/VwN34j5H7nVdXo9XA';
    try { await argon2.verify(dummy, password); } catch { /* Mantiene una ruta temporal similar sin revelar usuarios. */ }
  }

  private numberEnv(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private assertLoginRateLimit(key: string): void {
    const attempt = this.loginAttempts.get(key);
    if (!attempt) return;
    if (attempt.resetAt <= Date.now()) {
      this.loginAttempts.delete(key);
      return;
    }
    if (attempt.count >= 10) {
      throw new HttpException('Demasiados intentos. Espere un minuto antes de volver a intentar.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailedAttempt(key: string): void {
    const now = Date.now();
    const current = this.loginAttempts.get(key);
    this.loginAttempts.set(key, current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + 60_000 });
    if (this.loginAttempts.size > 5_000) {
      for (const [candidate, attempt] of this.loginAttempts) if (attempt.resetAt <= now) this.loginAttempts.delete(candidate);
    }
  }
}
