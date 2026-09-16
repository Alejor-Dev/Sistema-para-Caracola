import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ActionContext } from './users.service';
import { CreateRoleDto, UpdateRoleDto } from './role.dto';

const roleSelect = {
  id: true, code: true, name: true, description: true, isSystem: true, archivedAt: true,
  permissions: { select: { permission: { select: { code: true, module: true, description: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.role.findMany({ where: { archivedAt: null }, orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], select: roleSelect });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  async create(input: CreateRoleDto, context: ActionContext) {
    const codes = [...new Set(input.permissionCodes)];
    return this.prisma.$transaction(async (tx) => {
      const permissions = await this.resolvePermissions(tx, codes);
      if (await tx.role.findUnique({ where: { code: input.code } })) throw new ConflictException('El código de rol ya existe.');
      const role = await tx.role.create({
        data: { code: input.code, name: input.name.trim(), description: input.description?.trim(), permissions: { create: permissions.map(({ id }) => ({ permissionId: id })) } },
        select: roleSelect,
      });
      await this.audit(tx, context, 'role.created', role.id, undefined, this.snapshot(role));
      return role;
    });
  }

  async update(id: string, input: UpdateRoleDto, context: ActionContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.role.findUnique({ where: { id }, select: roleSelect });
      if (!current || current.archivedAt) throw new NotFoundException('El rol no existe.');
      if (current.isSystem) throw new ConflictException('Los roles del sistema no pueden modificarse.');
      const permissions = input.permissionCodes ? await this.resolvePermissions(tx, [...new Set(input.permissionCodes)]) : undefined;
      const role = await tx.role.update({
        where: { id },
        data: {
          name: input.name?.trim(), description: input.description?.trim(),
          ...(permissions ? { permissions: { deleteMany: {}, create: permissions.map(({ id: permissionId }) => ({ permissionId })) } } : {}),
        },
        select: roleSelect,
      });
      if (permissions) {
        const userIds = await tx.userRole.findMany({ where: { roleId: id }, select: { userId: true } });
        await tx.session.updateMany({ where: { userId: { in: userIds.map(({ userId }) => userId) }, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'role_permissions_changed' } });
      }
      await this.audit(tx, context, 'role.updated', id, this.snapshot(current), this.snapshot(role));
      return role;
    });
  }

  async archive(id: string, context: ActionContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.role.findUnique({ where: { id }, select: roleSelect });
      if (!current || current.archivedAt) throw new NotFoundException('El rol no existe.');
      if (current.isSystem) throw new ConflictException('Los roles del sistema no pueden archivarse.');
      if (current._count.users > 0) throw new ConflictException('No se puede archivar un rol asignado a usuarios.');
      await tx.role.update({ where: { id }, data: { archivedAt: new Date() } });
      await this.audit(tx, context, 'role.archived', id, this.snapshot(current), { archived: true });
    });
  }

  private async resolvePermissions(tx: Prisma.TransactionClient, codes: string[]) {
    if (codes.length === 0) throw new BadRequestException('Debe seleccionar al menos un permiso.');
    const permissions = await tx.permission.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
    if (permissions.length !== codes.length) throw new BadRequestException('Uno o más permisos no existen.');
    return permissions;
  }

  private snapshot(role: { code: string; name: string; description: string | null; permissions: Array<{ permission: { code: string } }> }) {
    return { code: role.code, name: role.name, description: role.description, permissions: role.permissions.map(({ permission }) => permission.code).sort() };
  }

  private async audit(tx: Prisma.TransactionClient, context: ActionContext, action: string, entityId: string, beforeData?: Prisma.InputJsonValue, afterData?: Prisma.InputJsonValue) {
    await tx.auditLog.create({ data: { actorUserId: context.actor.id, action, entityType: 'role', entityId, beforeData, afterData, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
  }
}
