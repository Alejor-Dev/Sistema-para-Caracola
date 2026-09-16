import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/request-user';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './user.dto';

export interface ActionContext { actor: RequestUser; ip?: string; userAgent?: string; requestId?: string }

const userSelect = {
  id: true, username: true, displayName: true, email: true, status: true, lastLoginAt: true, createdAt: true,
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({ where: { archivedAt: null }, orderBy: { displayName: 'asc' }, select: userSelect });
  }

  async create(input: CreateUserDto, context: ActionContext) {
    const roleIds = [...new Set(input.roleIds)];
    if (roleIds.length === 0) throw new BadRequestException('Debe asignar al menos un rol.');
    const passwordHash = await AuthService.hashPassword(input.password);
    return this.prisma.$transaction(async (tx) => {
      await this.assertRolesExist(tx, roleIds);
      const username = input.username.trim().toLowerCase();
      if (await tx.user.findUnique({ where: { username } })) throw new ConflictException('El nombre de usuario ya existe.');
      const user = await tx.user.create({
        data: {
          username, displayName: input.displayName.trim(), email: input.email?.trim().toLowerCase() || null, passwordHash,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        select: userSelect,
      });
      await this.audit(tx, context, 'user.created', user.id, undefined, this.snapshot(user));
      return user;
    });
  }

  async update(id: string, input: UpdateUserDto, context: ActionContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current || current.status === UserStatus.ARCHIVED) throw new NotFoundException('El usuario no existe.');
      if (id === context.actor.id && input.status && input.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('No puede desactivar su propia cuenta.');
      }
      const roleIds = input.roleIds ? [...new Set(input.roleIds)] : undefined;
      if (roleIds) {
        if (roleIds.length === 0) throw new BadRequestException('Debe asignar al menos un rol.');
        await this.assertRolesExist(tx, roleIds);
        await this.protectLastAdministrator(tx, current.id, roleIds, input.status ?? current.status);
      } else if (input.status && input.status !== UserStatus.ACTIVE) {
        await this.protectLastAdministrator(tx, current.id, current.roles.map(({ role }) => role.id), input.status);
      }
      const user = await tx.user.update({
        where: { id },
        data: {
          displayName: input.displayName?.trim(), email: input.email === undefined ? undefined : input.email.trim().toLowerCase(), status: input.status,
          ...(roleIds ? { roles: { deleteMany: {}, create: roleIds.map((roleId) => ({ roleId })) } } : {}),
        },
        select: userSelect,
      });
      if ((input.status && input.status !== UserStatus.ACTIVE) || roleIds) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'account_or_roles_changed' } });
      }
      await this.audit(tx, context, 'user.updated', id, this.snapshot(current), this.snapshot(user));
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async archive(id: string, context: ActionContext): Promise<void> {
    if (id === context.actor.id) throw new ForbiddenException('No puede archivar su propia cuenta.');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current || current.status === UserStatus.ARCHIVED) throw new NotFoundException('El usuario no existe.');
      await this.protectLastAdministrator(tx, id, current.roles.map(({ role }) => role.id), UserStatus.ARCHIVED);
      await tx.user.update({ where: { id }, data: { status: UserStatus.ARCHIVED, archivedAt: new Date() } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'user_archived' } });
      await this.audit(tx, context, 'user.archived', id, this.snapshot(current), { status: UserStatus.ARCHIVED });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async resetPassword(id: string, input: ResetPasswordDto, context: ActionContext): Promise<void> {
    const passwordHash = await AuthService.hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!user || user.status === UserStatus.ARCHIVED) throw new NotFoundException('El usuario no existe.');
      await tx.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'password_reset' } });
      await this.audit(tx, context, 'user.password_reset', id);
    });
  }

  private async assertRolesExist(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
    const count = await tx.role.count({ where: { id: { in: ids }, archivedAt: null } });
    if (count !== ids.length) throw new BadRequestException('Uno o más roles no existen o están archivados.');
  }

  private async protectLastAdministrator(tx: Prisma.TransactionClient, userId: string, resultingRoleIds: string[], resultingStatus: UserStatus): Promise<void> {
    const adminRole = await tx.role.findUnique({ where: { code: 'administrator' }, select: { id: true } });
    if (!adminRole) return;
    const stillAdmin = resultingStatus === UserStatus.ACTIVE && resultingRoleIds.includes(adminRole.id);
    if (stillAdmin) return;
    const activeAdmins = await tx.user.count({ where: { id: { not: userId }, status: UserStatus.ACTIVE, archivedAt: null, roles: { some: { roleId: adminRole.id } } } });
    if (activeAdmins === 0) throw new ConflictException('Debe existir al menos un administrador activo.');
  }

  private snapshot(user: { username: string; displayName: string; email: string | null; status: UserStatus; roles: Array<{ role: { code: string } }> }) {
    return { username: user.username, displayName: user.displayName, email: user.email, status: user.status, roles: user.roles.map(({ role }) => role.code) };
  }

  private async audit(tx: Prisma.TransactionClient, context: ActionContext, action: string, entityId: string, beforeData?: Prisma.InputJsonValue, afterData?: Prisma.InputJsonValue) {
    await tx.auditLog.create({ data: { actorUserId: context.actor.id, action, entityType: 'user', entityId, beforeData, afterData, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
  }
}
