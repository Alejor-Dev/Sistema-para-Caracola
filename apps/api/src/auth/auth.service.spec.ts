import * as argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('crea una sesión con token hasheado y nunca persiste el token crudo', async () => {
    const passwordHash = await argon2.hash('ClaveSegura123', { memoryCost: 4096, timeCost: 1 });
    const created: { tokenHash?: string } = {};
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', username: 'admin', displayName: 'Admin', passwordHash, status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null }) },
      $transaction: vi.fn(async (callback) => callback({
        user: { update: vi.fn() },
        session: { create: vi.fn(async ({ data }) => { Object.assign(created, data); return { id: 's1', expiresAt: data.expiresAt }; }) },
      })),
    };
    const service = new AuthService(prisma as never);
    const result = await service.login('ADMIN', 'ClaveSegura123', {});

    expect(result.token).toBeTruthy();
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.tokenHash).not.toBe(result.token);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'admin' } });
  });

  it('incrementa fallos y bloquea temporalmente al quinto intento inválido', async () => {
    const passwordHash = await argon2.hash('ClaveSegura123', { memoryCost: 4096, timeCost: 1 });
    const update = vi.fn();
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', passwordHash, status: 'ACTIVE', failedLoginCount: 4, lockedUntil: null }), update },
    };
    const service = new AuthService(prisma as never);

    await expect(service.login('admin', 'Incorrecta123', { ip: '127.0.0.1' })).rejects.toThrow('Usuario o contraseña incorrectos.');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failedLoginCount: 5, lockedUntil: expect.any(Date) }),
    }));
  });

  it('cambia la contraseña y revoca las demás sesiones', async () => {
    const oldHash = await argon2.hash('ClaveAnterior123', { memoryCost: 4096, timeCost: 1 });
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ passwordHash: oldHash }), update },
      session: { updateMany },
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
    };
    const service = new AuthService(prisma as never);

    await service.changePassword('u1', 'current-session', 'ClaveAnterior123', 'ClaveNueva456');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { not: 'current-session' } }) }));
  });
});
