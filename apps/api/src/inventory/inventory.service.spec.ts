import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service';

const context = { actor: { id: 'user-1', username: 'admin', displayName: 'Admin', permissions: [], sessionId: 'session-1' } };

describe('InventoryService', () => {
  it('rechaza un ajuste que dejaría stock negativo', async () => {
    const prisma = { $transaction: vi.fn(async (callback) => callback({ $queryRaw: vi.fn().mockResolvedValue([{ quantity: 2 }]) })) };
    const service = new InventoryService(prisma as never);
    await expect(service.adjust({ variantId: '00000000-0000-4000-8000-000000000001', quantityDelta: -3, type: 'ADJUSTMENT', reasonCode: 'conteo' }, context)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza saldo y crea un movimiento indivisible', async () => {
    const update = vi.fn().mockResolvedValue({}); const createMovement = vi.fn().mockResolvedValue({ id: 'movement-1' }); const createAudit = vi.fn().mockResolvedValue({});
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ quantity: 4 }]), inventoryBalance: { update }, inventoryMovement: { create: createMovement }, auditLog: { create: createAudit } };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const service = new InventoryService(prisma as never);
    await service.adjust({ variantId: '00000000-0000-4000-8000-000000000001', quantityDelta: 3, type: 'PURCHASE', reasonCode: 'ingreso' }, context);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: 7 }) }));
    expect(createMovement).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantityBefore: 4, quantityAfter: 7, quantityDelta: 3 }) }));
    expect(createAudit).toHaveBeenCalledOnce();
  });
});
