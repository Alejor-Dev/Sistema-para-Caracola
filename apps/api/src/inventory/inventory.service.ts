import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustInventoryDto, InventoryQueryDto, MovementQueryDto } from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: InventoryQueryDto) {
    const alertIds = query.status === 'low'
      ? (await this.prisma.$queryRaw<Array<{ variant_id: string }>>`
          SELECT b.variant_id FROM inventory_balances b
          JOIN product_variants v ON v.id = b.variant_id
          JOIN products p ON p.id = v.product_id
          WHERE b.quantity > 0 AND b.quantity <= COALESCE(v.min_stock_override, p.min_stock)
            AND v.archived_at IS NULL AND p.archived_at IS NULL
        `).map(({ variant_id }) => variant_id)
      : undefined;
    const where: Prisma.InventoryBalanceWhereInput = {
      ...(query.status === 'out' ? { quantity: 0 } : {}),
      ...(query.status === 'low' ? { variantId: { in: alertIds } } : {}),
      variant: { archivedAt: null, product: { archivedAt: null }, ...(query.search ? { OR: [
        { sku: { contains: query.search, mode: 'insensitive' } }, { barcode: { contains: query.search, mode: 'insensitive' } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
      ] } : {}) },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryBalance.count({ where }),
      this.prisma.inventoryBalance.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ quantity: 'asc' }, { updatedAt: 'desc' }], include: { variant: { include: { product: { select: { id: true, name: true, minStock: true } }, color: true, size: true } } } }),
    ]);
    const mapped = rows.map((row) => ({ ...row, minimum: row.variant.minStockOverride ?? row.variant.product.minStock, available: row.quantity - row.reservedQuantity }));
    return { data: mapped, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } };
  }

  async movements(query: MovementQueryDto) {
    const where = { variantId: query.variantId };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { occurredAt: 'desc' }, include: { variant: { include: { product: { select: { name: true } }, color: { select: { name: true } }, size: { select: { name: true } } } }, user: { select: { displayName: true } } } }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } };
  }

  async adjust(input: AdjustInventoryDto, context: ActionContext) {
    if (['LOSS', 'DAMAGED'].includes(input.type) && input.quantityDelta > 0) throw new BadRequestException('Una pérdida o daño debe disminuir el stock.');
    if (['INITIAL', 'PURCHASE'].includes(input.type) && input.quantityDelta < 0) throw new BadRequestException('Este movimiento debe aumentar el stock.');
    if (['LOSS', 'DAMAGED', 'CORRECTION'].includes(input.type) && !input.notes) throw new BadRequestException('Debe explicar el motivo del ajuste.');
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ quantity: number }>>`SELECT quantity FROM inventory_balances WHERE variant_id = ${input.variantId}::uuid FOR UPDATE`;
      if (!rows[0]) throw new NotFoundException('La variante no existe o no tiene saldo de inventario.');
      const before = rows[0].quantity; const after = before + input.quantityDelta;
      if (after < 0) throw new BadRequestException('El stock no puede quedar negativo.');
      await tx.inventoryBalance.update({ where: { variantId: input.variantId }, data: { quantity: after, version: { increment: 1 } } });
      const movement = await tx.inventoryMovement.create({ data: { variantId: input.variantId, type: input.type, quantityDelta: input.quantityDelta, quantityBefore: before, quantityAfter: after, reasonCode: input.reasonCode.trim(), notes: input.notes?.trim(), userId: context.actor.id } });
      await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'inventory.adjusted', entityType: 'product_variant', entityId: input.variantId, beforeData: { quantity: before }, afterData: { quantity: after, delta: input.quantityDelta, type: input.type, movementId: movement.id }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
      return movement;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
