import { describe, expect, it } from 'vitest';
import { money, moneyText, sumMoney } from './money';

describe('money', () => {
  it('redondea a cuatro decimales y presenta ARS a centavos', () => {
    expect(money('10.12345').toFixed(4)).toBe('10.1235');
    expect(moneyText(money('10.125'))).toBe('10.13');
  });

  it('suma pagos combinados sin usar punto flotante', () => {
    expect(sumMoney([money('20000'), money('30000')]).toFixed(4)).toBe('50000.0000');
  });
});
