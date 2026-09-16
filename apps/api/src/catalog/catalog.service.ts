import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ActionContext } from '../iam/users.service';
import type { CatalogType, CreateCatalogItemDto, UpdateCatalogItemDto } from './catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(type: CatalogType, includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    const orderBy = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];
    switch (type) {
      case 'categories': return this.prisma.category.findMany({ where, orderBy });
      case 'subcategories': return this.prisma.subcategory.findMany({ where, orderBy, include: { category: { select: { name: true } } } });
      case 'brands': return this.prisma.brand.findMany({ where, orderBy });
      case 'colors': return this.prisma.color.findMany({ where, orderBy });
      case 'sizes': return this.prisma.size.findMany({ where, orderBy });
      case 'materials': return this.prisma.material.findMany({ where, orderBy });
      case 'genders': return this.prisma.gender.findMany({ where, orderBy });
      case 'garment-types': return this.prisma.garmentType.findMany({ where, orderBy });
      case 'seasons': return this.prisma.season.findMany({ where, orderBy });
      case 'collections': return this.prisma.collection.findMany({ where, orderBy });
    }
  }

  async create(type: CatalogType, input: CreateCatalogItemDto, context: ActionContext) {
    if (type === 'subcategories' && !input.categoryId) throw new BadRequestException('La subcategoría requiere una categoría.');
    const data = { code: input.code.trim().toLowerCase(), name: input.name.trim(), sortOrder: input.sortOrder ?? 0 };
    return this.prisma.$transaction(async (tx) => {
      const item = await this.createWith(tx, type, data, input);
      await this.audit(tx, context, 'catalog.created', type, item.id, undefined, item as unknown as Prisma.InputJsonValue);
      return item;
    });
  }

  async update(type: CatalogType, id: string, input: UpdateCatalogItemDto, context: ActionContext) {
    const data = { name: input.name?.trim(), sortOrder: input.sortOrder, isActive: input.isActive };
    return this.prisma.$transaction(async (tx) => {
      const item = await this.updateWith(tx, type, id, data, input);
      await this.audit(tx, context, 'catalog.updated', type, id, undefined, item as unknown as Prisma.InputJsonValue);
      return item;
    });
  }

  private createWith(tx: Prisma.TransactionClient, type: CatalogType, data: { code: string; name: string; sortOrder: number }, input: CreateCatalogItemDto) {
    switch (type) {
      case 'categories': return tx.category.create({ data });
      case 'subcategories': return tx.subcategory.create({ data: { ...data, categoryId: input.categoryId! } });
      case 'brands': return tx.brand.create({ data });
      case 'colors': return tx.color.create({ data: { ...data, hexCode: input.hexCode } });
      case 'sizes': return tx.size.create({ data });
      case 'materials': return tx.material.create({ data });
      case 'genders': return tx.gender.create({ data });
      case 'garment-types': return tx.garmentType.create({ data });
      case 'seasons': return tx.season.create({ data });
      case 'collections': return tx.collection.create({ data });
    }
  }

  private updateWith(tx: Prisma.TransactionClient, type: CatalogType, id: string, data: { name?: string; sortOrder?: number; isActive?: boolean }, input: UpdateCatalogItemDto) {
    switch (type) {
      case 'categories': return tx.category.update({ where: { id }, data });
      case 'subcategories': return tx.subcategory.update({ where: { id }, data });
      case 'brands': return tx.brand.update({ where: { id }, data });
      case 'colors': return tx.color.update({ where: { id }, data: { ...data, hexCode: input.hexCode } });
      case 'sizes': return tx.size.update({ where: { id }, data });
      case 'materials': return tx.material.update({ where: { id }, data });
      case 'genders': return tx.gender.update({ where: { id }, data });
      case 'garment-types': return tx.garmentType.update({ where: { id }, data });
      case 'seasons': return tx.season.update({ where: { id }, data });
      case 'collections': return tx.collection.update({ where: { id }, data });
    }
  }

  private audit(tx: Prisma.TransactionClient, context: ActionContext, action: string, type: string, id: string, beforeData?: Prisma.InputJsonValue, afterData?: Prisma.InputJsonValue) {
    return tx.auditLog.create({ data: { actorUserId: context.actor.id, action, entityType: type, entityId: id, beforeData, afterData, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
  }
}
