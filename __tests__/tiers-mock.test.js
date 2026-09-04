import { mockListTiers } from '../services/__mocks__/tiers-mock.js';

describe('mockListTiers', () => {
  test('devuelve tiers de ambos roles, sin filtrar', async () => {
    const tiers = await mockListTiers();
    expect(tiers.length).toBeGreaterThanOrEqual(4);
    expect(tiers.some((t) => t.role_name === 'corredor')).toBe(true);
    expect(tiers.some((t) => t.role_name === 'entrenador')).toBe(true);
  });

  test('incluye un tier base gratis y uno premium pago por rol', async () => {
    const tiers = await mockListTiers();
    const corredorTiers = tiers.filter((t) => t.role_name === 'corredor');
    expect(corredorTiers.find((t) => t.name === 'base').payment_required).toBe(false);
    expect(corredorTiers.find((t) => t.name === 'premium').payment_required).toBe(true);
  });

  test('filtra por role_id cuando se pasa roleId', async () => {
    const tiers = await mockListTiers({ roleId: 1 });
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers.every((t) => t.role_id === 1)).toBe(true);
  });
});
