import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { InitializeAdminDto } from './initialize-admin.dto';
import { PERMISSION_CATALOG } from './permissions.catalog';

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async status(): Promise<{ initialized: boolean }> {
    return { initialized: (await this.prisma.user.count()) > 0 };
  }

  async initialize(input: InitializeAdminDto, context: { ip?: string; userAgent?: string; requestId?: string }) {
    const passwordHash = await AuthService.hashPassword(input.password);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73627401)`;
      if ((await tx.user.count()) > 0) throw new ConflictException('El sistema ya fue inicializado.');

      for (const [code, module, description] of PERMISSION_CATALOG) {
        await tx.permission.upsert({ where: { code }, update: { module, description }, create: { code, module, description } });
      }

      const permissions = await tx.permission.findMany({ select: { id: true } });
      const role = await tx.role.create({
        data: {
          code: 'administrator',
          name: 'Administrador',
          description: 'Acceso administrativo completo',
          isSystem: true,
          permissions: { create: permissions.map(({ id }) => ({ permissionId: id })) },
        },
      });
      const user = await tx.user.create({
        data: {
          username: input.username.trim().toLowerCase(),
          displayName: input.displayName.trim(),
          passwordHash,
          roles: { create: { roleId: role.id } },
        },
        select: { id: true, username: true, displayName: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'system.initialized',
          entityType: 'user',
          entityId: user.id,
          afterData: { username: user.username, role: role.code } as Prisma.InputJsonValue,
          ip: context.ip,
          userAgent: context.userAgent?.slice(0, 512),
          requestId: context.requestId,
        },
      });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
