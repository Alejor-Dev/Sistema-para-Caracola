import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import { SalesService } from './sales.service';
import { PurchasesService } from '../purchases/purchases.service';
import { ReturnsService } from '../returns/returns.service';

const run = process.env.RUN_PHASE4_DB_TESTS === '1';
describe.skipIf(!run)('Fase 4 con PostgreSQL real', () => {
  const prisma = new PrismaClient(); const realtime = new RealtimeService();
  const sales = new SalesService(prisma as never, realtime); const purchases = new PurchasesService(prisma as never, realtime); const returns = new ReturnsService(prisma as never, realtime);
  let userId = ''; let variantId = ''; let supplierId = ''; let cashId = ''; let transferId = '';
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const context = () => ({ actor: { id: userId, username: 'phase4-test', displayName: 'Prueba Fase 4', permissions: [], sessionId: 'test' }, requestId: suffix });

  beforeAll(async () => {
    userId = (await prisma.user.findFirstOrThrow({ select: { id: true } })).id;
    const methods = await prisma.paymentMethod.findMany({ take: 2, orderBy: { sortOrder: 'asc' } }); cashId = methods[0].id; transferId = methods[1].id;
    const supplier = await prisma.supplier.create({ data: { name: `Proveedor ${suffix}` } }); supplierId = supplier.id;
    const product = await prisma.product.create({ data: { name: `Producto ${suffix}`, slug: `producto-${suffix}`, variants: { create: { sku: `PH4-${suffix}`, costAmount: '60', salePriceAmount: '100', inventory: { create: { quantity: 1 } } } } }, include: { variants: true } }); variantId = product.variants[0].id;
  });
  afterAll(async () => prisma.$disconnect());

  it('solo permite una venta concurrente de la última unidad y acepta pago combinado exacto', async () => {
    const make = (key: string) => sales.create({ idempotencyKey: key, items: [{ variantId, quantity: 1 }], payments: [{ paymentMethodId: cashId, amount: '40' }, { paymentMethodId: transferId, amount: '60' }] }, context());
    const attempts = await Promise.allSettled([make(`sale-a-${suffix}`), make(`sale-b-${suffix}`)]); expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1); expect((await prisma.inventoryBalance.findUniqueOrThrow({ where: { variantId } })).quantity).toBe(0);
  });

  it('no duplica una compra reintentada y actualiza stock/costo una sola vez', async () => {
    const input = { idempotencyKey: `purchase-${suffix}`, supplierId, items: [{ variantId, quantity: 5, unitCostAmount: '70' }], payments: [{ paymentMethodId: cashId, amount: '350' }] };
    const first = await purchases.create(input, context()); const repeated = await purchases.create(input, context()); expect(repeated.id).toBe(first.id); expect((await prisma.inventoryBalance.findUniqueOrThrow({ where: { variantId } })).quantity).toBe(5); expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).costAmount.toFixed(2)).toBe('70.00');
  });

  it('devuelve una venta con movimiento compensatorio y trazabilidad', async () => {
    const sale = await prisma.sale.findFirstOrThrow({ where: { idempotencyKey: { startsWith: 'sale-' }, items: { some: { variantId } } }, include: { items: true } });
    const result = await returns.create({ idempotencyKey: `return-${suffix}`, saleId: sale.id, type: 'RETURN', items: [{ saleItemId: sale.items[0].id, quantity: 1 }], settlements: [{ paymentMethodId: cashId, type: 'REFUND', amount: '100' }], reason: 'Prueba de devolución completa' }, context());
    expect(result.refundAmount).toBe('100.00'); expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).status).toBe('RETURNED'); expect((await prisma.inventoryBalance.findUniqueOrThrow({ where: { variantId } })).quantity).toBe(6);
  });
});
