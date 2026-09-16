import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsGuard } from './permissions.guard';

function contextFor(permissions: string[]) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as never;
}

describe('PermissionsGuard', () => {
  it('permite cuando el usuario posee todos los permisos', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['users.read']) };
    expect(new PermissionsGuard(reflector as never).canActivate(contextFor(['users.read']))).toBe(true);
  });

  it('rechaza cuando falta un permiso', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['users.manage']) };
    expect(() => new PermissionsGuard(reflector as never).canActivate(contextFor(['users.read']))).toThrow(ForbiddenException);
  });
});
