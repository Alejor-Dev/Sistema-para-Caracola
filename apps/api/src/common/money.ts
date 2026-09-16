import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type MoneyInput = string | number | Prisma.Decimal;

export function money(value: MoneyInput, field = 'importe'): Prisma.Decimal {
  try {
    const result = new Prisma.Decimal(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    if (!result.isFinite() || result.isNegative()) throw new Error('invalid');
    return result;
  } catch {
    throw new BadRequestException(`El ${field} no es válido.`);
  }
}

export function moneyText(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

export function sumMoney(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
}
