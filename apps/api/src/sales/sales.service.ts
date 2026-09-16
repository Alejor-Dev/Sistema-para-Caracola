import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { money, moneyText, sumMoney } from '../common/money';
import { RealtimeService } from '../realtime/realtime.service';
import { jsonSafe } from '../common/json-safe';
import { CatalogQueryDto, CreateSaleDto, SaleQueryDto } from './sale.dto';

const saleInclude = { customer: true, user: { select: { id: true, displayName: true } }, items: true, payments: { include: { paymentMethod: true } }, returns: { select: { id: true, number: true, type: true, refundAmount: true, replacementAmount: true, confirmedAt: true } } } as const;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeService) {}

  async catalog(query: CatalogQueryDto) {
    return this.prisma.productVariant.findMany({ where: { status: 'ACTIVE', archivedAt: null, product: { status: 'ACTIVE', archivedAt: null }, OR: [{ sku: { contains: query.search, mode: 'insensitive' } }, { barcode: { equals: query.search } }, { product: { name: { contains: query.search, mode: 'insensitive' } } }] }, take: query.limit, orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }], select: { id: true, sku: true, barcode: true, salePriceAmount: true, currencyCode: true, color: { select: { name: true } }, size: { select: { name: true } }, product: { select: { name: true } }, inventory: { select: { quantity: true, reservedQuantity: true } } } });
  }

  async list(query: SaleQueryDto) {
    const where: Prisma.SaleWhereInput = { ...(query.customerId ? { customerId: query.customerId } : {}), ...(query.search ? { OR: [{ idempotencyKey: { contains: query.search, mode: 'insensitive' } }, { customer: { is: { OR: [{ firstName: { contains: query.search, mode: 'insensitive' } }, { lastName: { contains: query.search, mode: 'insensitive' } }] } } }, { items: { some: { OR: [{ productName: { contains: query.search, mode: 'insensitive' } }, { sku: { contains: query.search, mode: 'insensitive' } }] } } }] } : {}) };
    const [total, rows] = await this.prisma.$transaction([this.prisma.sale.count({ where }), this.prisma.sale.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { confirmedAt: 'desc' }, include: saleInclude })]);
    return { data: rows.map((sale) => this.serialize(sale)), pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } };
  }

  async get(id: string) { const sale = await this.prisma.sale.findUnique({ where: { id }, include: saleInclude }); if (!sale) throw new NotFoundException('La venta no existe.'); return this.serialize(sale); }

  async create(input: CreateSaleDto, context: ActionContext) {
    const existing = await this.prisma.sale.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: saleInclude });
    if (existing) return this.serialize(existing);
    const quantities = new Map<string, number>();
    for (const item of input.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    try {
      const sale = await this.prisma.$transaction(async (tx) => {
        if (input.customerId && !await tx.customer.findFirst({ where: { id: input.customerId, archivedAt: null } })) throw new NotFoundException('El cliente no existe.');
        const variantIds = [...quantities.keys()].sort();
        const variants = await tx.productVariant.findMany({ where: { id: { in: variantIds }, archivedAt: null, status: 'ACTIVE', product: { archivedAt: null, status: 'ACTIVE' } }, include: { product: { select: { name: true } }, color: { select: { name: true } }, size: { select: { name: true } } } });
        if (variants.length !== variantIds.length) throw new NotFoundException('Uno de los productos ya no está disponible.');
        const byId = new Map(variants.map((variant) => [variant.id, variant]));
        const balances = new Map<string, number>();
        for (const variantId of variantIds) { const rows = await tx.$queryRaw<Array<{ quantity: number }>>`SELECT quantity FROM inventory_balances WHERE variant_id = ${variantId}::uuid FOR UPDATE`; if (!rows[0]) throw new NotFoundException('Una variante no tiene saldo de inventario.'); const requested = quantities.get(variantId)!; if (rows[0].quantity < requested) throw new ConflictException(`Stock insuficiente para ${byId.get(variantId)!.sku}.`); balances.set(variantId, rows[0].quantity); }
        const initialRows = input.items.map((item) => { const variant = byId.get(item.variantId)!; const gross = variant.salePriceAmount.mul(item.quantity); const discount = money(item.discountAmount ?? '0', 'descuento del producto'); if (discount.greaterThan(gross)) throw new BadRequestException(`El descuento de ${variant.sku} supera su importe.`); return { input: item, variant, gross, discount, total: gross.minus(discount) }; });
        const subtotal = sumMoney(initialRows.map((row) => row.gross)); const itemDiscounts = sumMoney(initialRows.map((row) => row.discount)); const orderDiscount = money(input.discountAmount ?? '0', 'descuento general'); const netBeforeOrder = subtotal.minus(itemDiscounts); if (orderDiscount.greaterThan(netBeforeOrder)) throw new BadRequestException('El descuento supera el subtotal.'); const totalDiscount = itemDiscounts.plus(orderDiscount); const total = subtotal.minus(totalDiscount);
        let allocated = new Prisma.Decimal(0); const itemRows = initialRows.map((row, index) => { const share = index === initialRows.length - 1 ? orderDiscount.minus(allocated) : (netBeforeOrder.isZero() ? new Prisma.Decimal(0) : orderDiscount.mul(row.total).div(netBeforeOrder).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)); allocated = allocated.plus(share); return { ...row, discount: row.discount.plus(share), total: row.total.minus(share) }; });
        const paymentTotal = sumMoney(input.payments.map((payment) => money(payment.amount, 'pago'))); if (!paymentTotal.equals(total)) throw new BadRequestException(`Los pagos deben sumar exactamente ${moneyText(total)}.`);
        const methodIds = [...new Set(input.payments.map((payment) => payment.paymentMethodId))]; const methodCount = await tx.paymentMethod.count({ where: { id: { in: methodIds }, isActive: true } }); if (methodCount !== methodIds.length) throw new BadRequestException('Uno de los métodos de pago no está disponible.');
        const cost = sumMoney(itemRows.map((row) => row.variant.costAmount.mul(row.input.quantity)));
        const created = await tx.sale.create({ data: { idempotencyKey: input.idempotencyKey.trim(), customerId: input.customerId, userId: context.actor.id, subtotalAmount: subtotal, discountAmount: totalDiscount, totalAmount: total, costAmount: cost, profitAmount: total.minus(cost), notes: input.notes?.trim(), items: { create: itemRows.map((row) => ({ variantId: row.variant.id, productName: row.variant.product.name, sku: row.variant.sku, variantDescription: [row.variant.color?.name, row.variant.size?.name].filter(Boolean).join(' · ') || null, quantity: row.input.quantity, unitPriceAmount: row.variant.salePriceAmount, unitCostAmount: row.variant.costAmount, discountAmount: row.discount, lineTotalAmount: row.total })) }, payments: { create: input.payments.map((payment) => ({ paymentMethodId: payment.paymentMethodId, amount: money(payment.amount, 'pago'), reference: payment.reference?.trim() })) } }, include: saleInclude });
        for (const [variantId, quantity] of quantities) { const before = balances.get(variantId)!; const after = before - quantity; await tx.inventoryBalance.update({ where: { variantId }, data: { quantity: after, version: { increment: 1 } } }); await tx.inventoryMovement.create({ data: { variantId, type: 'SALE', quantityDelta: -quantity, quantityBefore: before, quantityAfter: after, reasonCode: 'sale', referenceType: 'sale', referenceId: created.id, userId: context.actor.id } }); }
        await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'sale.confirmed', entityType: 'sale', entityId: created.id, afterData: { number: created.number.toString(), total: moneyText(total), itemCount: itemRows.length }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
      this.realtime.publish('sale.confirmed', { saleId: sale.id, number: sale.number.toString() });
      return this.serialize(sale);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { const duplicate = await this.prisma.sale.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: saleInclude }); if (duplicate) return this.serialize(duplicate); }
      throw error;
    }
  }

  async void(id: string, reason: string, context: ActionContext) {
    const sale = await this.prisma.$transaction(async (tx) => {
      const current = await tx.sale.findUnique({ where: { id }, include: { items: true } }); if (!current) throw new NotFoundException('La venta no existe.'); if (current.status === 'VOIDED') return tx.sale.findUniqueOrThrow({ where: { id }, include: saleInclude }); if (current.status !== 'CONFIRMED') throw new BadRequestException('Una venta con devoluciones no puede anularse; registre una devolución compensatoria.');
      for (const item of [...current.items].sort((a, b) => a.variantId.localeCompare(b.variantId))) { const rows = await tx.$queryRaw<Array<{ quantity: number }>>`SELECT quantity FROM inventory_balances WHERE variant_id = ${item.variantId}::uuid FOR UPDATE`; const before = rows[0]?.quantity; if (before === undefined) throw new NotFoundException('No existe el saldo de una variante.'); const after = before + item.quantity; await tx.inventoryBalance.update({ where: { variantId: item.variantId }, data: { quantity: after, version: { increment: 1 } } }); await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: 'SALE_VOID', quantityDelta: item.quantity, quantityBefore: before, quantityAfter: after, reasonCode: 'sale_void', notes: reason.trim(), referenceType: 'sale', referenceId: id, userId: context.actor.id } }); }
      const updated = await tx.sale.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date(), voidedBy: context.actor.id, voidReason: reason.trim() }, include: saleInclude }); await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'sale.voided', entityType: 'sale', entityId: id, beforeData: { status: current.status }, afterData: { status: 'VOIDED', reason }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } }); return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    this.realtime.publish('sale.voided', { saleId: id }); return this.serialize(sale);
  }

  private serialize<T extends { number: bigint; subtotalAmount: Prisma.Decimal; discountAmount: Prisma.Decimal; totalAmount: Prisma.Decimal; costAmount: Prisma.Decimal; profitAmount: Prisma.Decimal }>(sale: T) { return jsonSafe({ ...sale, number: sale.number.toString(), subtotalAmount: moneyText(sale.subtotalAmount), discountAmount: moneyText(sale.discountAmount), totalAmount: moneyText(sale.totalAmount), costAmount: moneyText(sale.costAmount), profitAmount: moneyText(sale.profitAmount) }); }
}
