import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import type { RequestUser } from '../common/request-user';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, CreateVariantDto, PricingQueryDto, ProductQueryDto, UpdateProductDto, UpdateVariantDto } from './product.dto';

const productInclude = {
  category: { select: { id: true, name: true } }, subcategory: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } }, gender: { select: { id: true, name: true } }, garmentType: { select: { id: true, name: true } },
  defaultSupplier: { select: { id: true, name: true } }, materials: { include: { material: { select: { id: true, name: true } } } },
  images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }], select: { id: true, variantId: true, mimeType: true, width: true, height: true, byteSize: true, isPrimary: true, sortOrder: true } },
  variants: { where: { archivedAt: null }, include: { color: true, size: true, inventory: true }, orderBy: { sku: 'asc' as const } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductQueryDto, user: RequestUser) {
    const where: Prisma.ProductWhereInput = {
      archivedAt: null, status: { not: ProductStatus.ARCHIVED }, categoryId: query.categoryId, brandId: query.brandId,
      ...(query.colorId || query.sizeId ? { variants: { some: { archivedAt: null, colorId: query.colorId, sizeId: query.sizeId } } } : {}),
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: 'insensitive' } }, { brand: { name: { contains: query.search, mode: 'insensitive' } } },
        { variants: { some: { OR: [{ sku: { contains: query.search, mode: 'insensitive' } }, { barcode: { contains: query.search, mode: 'insensitive' } }] } } },
      ] } : {}),
    };
    if (query.lowStock || query.sort.startsWith('stock-') || query.sort.startsWith('price-')) {
      const filters: Prisma.Sql[] = [Prisma.sql`p.archived_at IS NULL`, Prisma.sql`p.status <> 'ARCHIVED'::"ProductStatus"`];
      if (query.categoryId) filters.push(Prisma.sql`p.category_id = ${query.categoryId}::uuid`);
      if (query.brandId) filters.push(Prisma.sql`p.brand_id = ${query.brandId}::uuid`);
      if (query.colorId) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM product_variants cv WHERE cv.product_id = p.id AND cv.color_id = ${query.colorId}::uuid AND cv.archived_at IS NULL)`);
      if (query.sizeId) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM product_variants sv WHERE sv.product_id = p.id AND sv.size_id = ${query.sizeId}::uuid AND sv.archived_at IS NULL)`);
      if (query.search) {
        const term = `%${query.search}%`;
        filters.push(Prisma.sql`(p.name ILIKE ${term} OR EXISTS (SELECT 1 FROM brands sb WHERE sb.id = p.brand_id AND sb.name ILIKE ${term}) OR EXISTS (SELECT 1 FROM product_variants qv WHERE qv.product_id = p.id AND qv.archived_at IS NULL AND (qv.sku ILIKE ${term} OR qv.barcode ILIKE ${term})))`);
      }
      const order = query.sort === 'stock-desc' ? Prisma.sql`total_stock DESC` : query.sort === 'price-asc' ? Prisma.sql`min_price ASC` : query.sort === 'price-desc' ? Prisma.sql`min_price DESC` : Prisma.sql`total_stock ASC`;
      const having = query.lowStock ? Prisma.sql`HAVING COALESCE(SUM(b.quantity), 0) <= p.min_stock` : Prisma.sql``;
      const metrics = await this.prisma.$queryRaw<Array<{ id: string; full_count: bigint }>>(Prisma.sql`
        SELECT p.id, COUNT(*) OVER()::bigint AS full_count,
          COALESCE(SUM(b.quantity), 0)::bigint AS total_stock,
          COALESCE(MIN(v.sale_price_amount), 0) AS min_price
        FROM products p
        LEFT JOIN product_variants v ON v.product_id = p.id AND v.archived_at IS NULL
        LEFT JOIN inventory_balances b ON b.variant_id = v.id
        WHERE ${Prisma.join(filters, ' AND ')}
        GROUP BY p.id, p.min_stock
        ${having}
        ORDER BY ${order}, p.id
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
      `);
      const pageIds = metrics.map(({ id }) => id);
      const unordered = await this.prisma.product.findMany({ where: { id: { in: pageIds } }, include: productInclude });
      const positions = new Map(pageIds.map((id, index) => [id, index]));
      const data = unordered.sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0)).map((row) => this.present(row, user));
      const total = Number(metrics[0]?.full_count ?? 0);
      return { data, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } };
    }
    const orderBy = this.orderBy(query.sort);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy, include: productInclude }),
    ]);
    const data = rows.map((row) => this.present(row, user));
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } };
  }

  async get(id: string, user: RequestUser) {
    const row = await this.prisma.product.findFirst({ where: { id, archivedAt: null }, include: productInclude });
    if (!row) throw new NotFoundException('El producto no existe.');
    return this.present(row, user);
  }

  async create(input: CreateProductDto, context: ActionContext) {
    if (input.variants.length === 0) throw new BadRequestException('Debe crear al menos una variante.');
    return this.prisma.$transaction(async (tx) => {
      const slug = await this.uniqueSlug(tx, input.name);
      const product = await tx.product.create({ data: {
        name: input.name.trim(), slug, description: input.description?.trim(), categoryId: input.categoryId, subcategoryId: input.subcategoryId,
        brandId: input.brandId, genderId: input.genderId, garmentTypeId: input.garmentTypeId, seasonId: input.seasonId, collectionId: input.collectionId,
        defaultSupplierId: input.defaultSupplierId, minStock: input.minStock ?? 0, notes: input.notes?.trim(),
        materials: input.materialIds ? { create: [...new Set(input.materialIds)].map((materialId) => ({ materialId })) } : undefined,
      } });
      for (const variantInput of input.variants) await this.createVariantInTransaction(tx, product.id, variantInput, context.actor.id);
      await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'product.created', entityType: 'product', entityId: product.id, afterData: { name: product.name, slug }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
      return tx.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async addVariant(productId: string, input: CreateVariantDto, context: ActionContext) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await tx.product.findFirst({ where: { id: productId, archivedAt: null }, select: { id: true } }))) throw new NotFoundException('El producto no existe.');
      const variant = await this.createVariantInTransaction(tx, productId, input, context.actor.id);
      await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'variant.created', entityType: 'product_variant', entityId: variant.id, afterData: { sku: variant.sku }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
      return variant;
    });
  }

  async update(id: string, input: UpdateProductDto, context: ActionContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.product.findFirst({ where: { id, archivedAt: null } });
      if (!current) throw new NotFoundException('El producto no existe.');
      const product = await tx.product.update({ where: { id }, data: {
        name: input.name?.trim(), description: input.description?.trim(), categoryId: input.categoryId, subcategoryId: input.subcategoryId,
        brandId: input.brandId, genderId: input.genderId, garmentTypeId: input.garmentTypeId, seasonId: input.seasonId, collectionId: input.collectionId,
        defaultSupplierId: input.defaultSupplierId, minStock: input.minStock, notes: input.notes?.trim(),
        ...(input.materialIds ? { materials: { deleteMany: {}, create: [...new Set(input.materialIds)].map((materialId) => ({ materialId })) } } : {}),
      }, include: productInclude });
      await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'product.updated', entityType: 'product', entityId: id, beforeData: { name: current.name }, afterData: { name: product.name }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
      return product;
    });
  }

  async updateVariant(id: string, input: UpdateVariantDto, context: ActionContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.productVariant.findFirst({ where: { id, archivedAt: null } });
      if (!current) throw new NotFoundException('La variante no existe.');
      const changes: Array<{ priceType: 'COST' | 'SALE' | 'WHOLESALE'; oldAmount: Prisma.Decimal; newAmount: Prisma.Decimal }> = [];
      this.priceChange(changes, 'COST', current.costAmount, input.costAmount);
      this.priceChange(changes, 'SALE', current.salePriceAmount, input.salePriceAmount);
      if (input.wholesalePriceAmount !== undefined) this.priceChange(changes, 'WHOLESALE', current.wholesalePriceAmount ?? new Prisma.Decimal(0), input.wholesalePriceAmount);
      const variant = await tx.productVariant.update({ where: { id }, data: {
        barcode: input.barcode?.trim(), colorId: input.colorId, sizeId: input.sizeId, costAmount: input.costAmount,
        salePriceAmount: input.salePriceAmount, wholesalePriceAmount: input.wholesalePriceAmount, minStockOverride: input.minStockOverride, status: input.status,
      }, include: { color: true, size: true, inventory: true } });
      if (changes.length) await tx.priceHistory.createMany({ data: changes.map((change) => ({ ...change, variantId: id, changedBy: context.actor.id, reason: input.priceChangeReason })) });
      await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'variant.updated', entityType: 'product_variant', entityId: id, beforeData: { sku: current.sku }, afterData: { sku: variant.sku, priceChanges: changes.length }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
      return variant;
    });
  }

  async archive(id: string, context: ActionContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.product.findFirst({ where: { id, archivedAt: null }, select: { id: true, name: true } });
      if (!current) throw new NotFoundException('El producto no existe.');
      const now = new Date();
      await tx.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED, archivedAt: now } });
      await tx.productVariant.updateMany({ where: { productId: id, archivedAt: null }, data: { status: ProductStatus.ARCHIVED, archivedAt: now } });
      await tx.auditLog.create({ data: { actorUserId: context.actor.id, action: 'product.archived', entityType: 'product', entityId: id, beforeData: { name: current.name }, afterData: { status: 'ARCHIVED' }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
    });
  }

  calculatePricing(input: PricingQueryDto) {
    const cost = new Prisma.Decimal(input.cost);
    const price = input.markupPercent !== undefined ? cost.mul(new Prisma.Decimal(1).plus(new Prisma.Decimal(input.markupPercent).div(100))) : new Prisma.Decimal(input.price ?? 0);
    const profit = price.minus(cost);
    return {
      cost: cost.toFixed(2), price: price.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2), profit: profit.toFixed(2),
      marginPercent: price.isZero() ? '0.00' : profit.div(price).mul(100).toFixed(2),
      markupPercent: cost.isZero() ? '0.00' : profit.div(cost).mul(100).toFixed(2),
    };
  }

  private async createVariantInTransaction(tx: Prisma.TransactionClient, productId: string, input: CreateVariantDto, userId: string) {
    const variant = await tx.productVariant.create({ data: {
      productId, sku: input.sku.trim().toUpperCase(), barcode: input.barcode?.trim() || null, colorId: input.colorId, sizeId: input.sizeId,
      costAmount: input.costAmount, salePriceAmount: input.salePriceAmount, wholesalePriceAmount: input.wholesalePriceAmount, minStockOverride: input.minStockOverride,
    } });
    const initialStock = input.initialStock ?? 0;
    await tx.inventoryBalance.create({ data: { variantId: variant.id, quantity: initialStock } });
    await tx.priceHistory.createMany({ data: [
      { variantId: variant.id, priceType: 'COST', oldAmount: 0, newAmount: input.costAmount, changedBy: userId, reason: 'Precio inicial' },
      { variantId: variant.id, priceType: 'SALE', oldAmount: 0, newAmount: input.salePriceAmount, changedBy: userId, reason: 'Precio inicial' },
    ] });
    if (initialStock > 0) await tx.inventoryMovement.create({ data: { variantId: variant.id, type: 'INITIAL', quantityDelta: initialStock, quantityBefore: 0, quantityAfter: initialStock, reasonCode: 'initial_stock', userId } });
    return variant;
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, name: string) {
    const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 170) || 'producto';
    let slug = base;
    for (let suffix = 2; await tx.product.findUnique({ where: { slug }, select: { id: true } }); suffix += 1) slug = `${base}-${suffix}`;
    return slug;
  }

  private orderBy(sort: string): Prisma.ProductOrderByWithRelationInput {
    if (sort === 'name-asc') return { name: 'asc' }; if (sort === 'name-desc') return { name: 'desc' };
    if (sort === 'oldest') return { createdAt: 'asc' };
    return { createdAt: 'desc' };
  }

  private priceChange(target: Array<{ priceType: 'COST' | 'SALE' | 'WHOLESALE'; oldAmount: Prisma.Decimal; newAmount: Prisma.Decimal }>, type: 'COST' | 'SALE' | 'WHOLESALE', oldAmount: Prisma.Decimal, next?: string) {
    if (next === undefined) return;
    const newAmount = new Prisma.Decimal(next);
    if (!oldAmount.equals(newAmount)) target.push({ priceType: type, oldAmount, newAmount });
  }

  private present<T extends { minStock: number; variants: Array<{ costAmount: Prisma.Decimal; salePriceAmount: Prisma.Decimal; wholesalePriceAmount: Prisma.Decimal | null; minStockOverride: number | null; inventory: { quantity: number } | null }> }>(row: T, user: RequestUser) {
    const canSeeCost = user.permissions.includes('costs.read'); const canSeeProfit = user.permissions.includes('profits.read');
    const variants = row.variants.map((variant) => {
      const { costAmount, ...visible } = variant;
      const profit = variant.salePriceAmount.minus(costAmount);
      return { ...visible, ...(canSeeCost ? { costAmount } : {}), ...(canSeeProfit ? { profitAmount: profit, marginPercent: variant.salePriceAmount.isZero() ? '0.00' : profit.div(variant.salePriceAmount).mul(100).toFixed(2), markupPercent: costAmount.isZero() ? '0.00' : profit.div(costAmount).mul(100).toFixed(2) } : {}) };
    });
    return { ...row, variants, totalStock: row.variants.reduce((sum, variant) => sum + (variant.inventory?.quantity ?? 0), 0) };
  }
}
