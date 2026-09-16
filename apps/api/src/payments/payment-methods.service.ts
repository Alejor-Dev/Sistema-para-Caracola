import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}
  list() { return this.prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }); }
  create(input: CreatePaymentMethodDto, context: ActionContext) { return this.prisma.$transaction(async (tx) => { const method = await tx.paymentMethod.create({ data: { code: input.code.trim().toLowerCase(), name: input.name.trim() } }); await this.audit(tx, context, 'payment_method.created', method.id, method as unknown as Prisma.InputJsonValue); return method; }); }
  update(id: string, input: UpdatePaymentMethodDto, context: ActionContext) { return this.prisma.$transaction(async (tx) => { const exists = await tx.paymentMethod.findUnique({ where: { id } }); if (!exists) throw new NotFoundException('El método de pago no existe.'); const method = await tx.paymentMethod.update({ where: { id }, data: { name: input.name?.trim(), isActive: input.isActive } }); await this.audit(tx, context, 'payment_method.updated', id, method as unknown as Prisma.InputJsonValue); return method; }); }
  private audit(tx: Prisma.TransactionClient, context: ActionContext, action: string, id: string, afterData: Prisma.InputJsonValue) { return tx.auditLog.create({ data: { actorUserId: context.actor.id, action, entityType: 'payment_method', entityId: id, afterData, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } }); }
}
