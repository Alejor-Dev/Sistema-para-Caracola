import { Prisma } from '@prisma/client';

export function jsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as T;
  if (value instanceof Date || Prisma.Decimal.isDecimal(value)) return value;
  if (Array.isArray(value)) return value.map((item) => jsonSafe(item)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)])) as T;
  return value;
}
