import { describe, expect, it } from 'vitest';
import { ProductsService } from './products.service';

describe('ProductsService pricing', () => {
  const service = new ProductsService({} as never);

  it('calcula ganancia, margen y markup sin punto flotante', () => {
    expect(service.calculatePricing({ cost: '10000', price: '15000' })).toEqual({
      cost: '10000.00', price: '15000.00', profit: '5000.00', marginPercent: '33.33', markupPercent: '50.00',
    });
  });

  it('calcula precio sugerido desde el markup y redondea a centavos', () => {
    expect(service.calculatePricing({ cost: '9999.99', markupPercent: '40' }).price).toBe('13999.99');
  });
});
