import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}
  list(search?: string) { return this.prisma.supplier.findMany({ where: { archivedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { companyName: { contains: search, mode: 'insensitive' } }, { taxId: { contains: search } }] } : {}) }, orderBy: { name: 'asc' } }); }
  async create(input: CreateSupplierDto, context: ActionContext) {
    return this.prisma.$transaction(async (tx) => { const supplier = await tx.supplier.create({ data: { ...this.data(input), name: input.name.trim() } }); await this.audit(tx, context, 'supplier.created', supplier.id, supplier as unknown as Prisma.InputJsonValue); return supplier; });
  }
  async update(id: string, input: UpdateSupplierDto, context: ActionContext) {
    if (!(await this.prisma.supplier.findFirst({ where: { id, archivedAt: null } }))) throw new NotFoundException('El proveedor no existe.');
    return this.prisma.$transaction(async (tx) => { const supplier = await tx.supplier.update({ where: { id }, data: this.data(input) }); await this.audit(tx, context, 'supplier.updated', id, supplier as unknown as Prisma.InputJsonValue); return supplier; });
  }
  async archive(id: string, context: ActionContext) {
    await this.prisma.$transaction(async (tx) => { const result = await tx.supplier.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: new Date() } }); if (!result.count) throw new NotFoundException('El proveedor no existe.'); await this.audit(tx, context, 'supplier.archived', id, { archived: true }); });
  }
  private data(input: UpdateSupplierDto | CreateSupplierDto) { return { name: input.name?.trim(), companyName: input.companyName?.trim(), taxId: input.taxId?.trim(), phone: input.phone?.trim(), whatsapp: input.whatsapp?.trim(), email: input.email?.trim().toLowerCase(), address: input.address?.trim(), notes: input.notes?.trim() }; }
  private audit(tx: Prisma.TransactionClient, context: ActionContext, action: string, id: string, afterData: Prisma.InputJsonValue) { return tx.auditLog.create({ data: { actorUserId: context.actor.id, action, entityType: 'supplier', entityId: id, afterData, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } }); }
}
