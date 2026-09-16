import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { moneyText } from '../common/money';
import { jsonSafe } from '../common/json-safe';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CustomerQueryDto) {
    const where: Prisma.CustomerWhereInput = { archivedAt: null, ...(query.search ? { OR: [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { documentId: { contains: query.search } }, { phone: { contains: query.search } },
      { whatsapp: { contains: query.search } }, { email: { contains: query.search, mode: 'insensitive' } },
    ] } : {}) };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ updatedAt: 'desc' }], include: { sales: { where: { status: { not: 'VOIDED' } }, select: { totalAmount: true, confirmedAt: true }, orderBy: { confirmedAt: 'desc' } } } }),
    ]);
    return { data: rows.map(({ sales, ...customer }) => { const spent = sales.reduce((sum, sale) => sum.plus(sale.totalAmount), new Prisma.Decimal(0)); return { ...customer, metrics: { purchaseCount: sales.length, totalSpent: moneyText(spent), averageTicket: moneyText(sales.length ? spent.div(sales.length) : spent), lastPurchaseAt: sales[0]?.confirmedAt ?? null } }; }), pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } };
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, archivedAt: null }, include: { sales: { where: { status: { not: 'VOIDED' } }, orderBy: { confirmedAt: 'desc' }, include: { items: true, payments: { include: { paymentMethod: true } } } } } });
    if (!customer) throw new NotFoundException('El cliente no existe.');
    return jsonSafe(customer);
  }

  create(input: CreateCustomerDto, context: ActionContext) { return this.prisma.$transaction(async (tx) => { const customer = await tx.customer.create({ data: { ...this.data(input), firstName: input.firstName.trim() } }); await this.audit(tx, context, 'customer.created', customer.id, customer as unknown as Prisma.InputJsonValue); return customer; }); }

  async update(id: string, input: UpdateCustomerDto, context: ActionContext) {
    return this.prisma.$transaction(async (tx) => { const before = await tx.customer.findFirst({ where: { id, archivedAt: null } }); if (!before) throw new NotFoundException('El cliente no existe.'); const customer = await tx.customer.update({ where: { id }, data: this.data(input) }); await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'customer.updated', entityType: 'customer', entityId: id, beforeData: before as unknown as Prisma.InputJsonValue, afterData: customer as unknown as Prisma.InputJsonValue, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } }); return customer; });
  }

  archive(id: string, context: ActionContext) { return this.prisma.$transaction(async (tx) => { const result = await tx.customer.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: new Date() } }); if (!result.count) throw new NotFoundException('El cliente no existe.'); await this.audit(tx, context, 'customer.archived', id, { archived: true }); }); }

  private data(input: CreateCustomerDto | UpdateCustomerDto) { return { firstName: input.firstName?.trim(), lastName: input.lastName?.trim() || undefined, documentId: input.documentId?.trim() || undefined, phone: input.phone?.trim() || undefined, whatsapp: input.whatsapp?.trim() || undefined, email: input.email?.trim().toLowerCase() || undefined, address: input.address?.trim() || undefined, birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : undefined, notes: input.notes?.trim() || undefined }; }
  private audit(tx: Prisma.TransactionClient, context: ActionContext, action: string, id: string, afterData: Prisma.InputJsonValue) { return tx.auditLog.create({ data: { actorUserId: context.actor.id, action, entityType: 'customer', entityId: id, afterData, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } }); }
}
