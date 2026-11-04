import { formatTierName } from '../utils/tier-name.js';

describe('formatTierName', () => {
  test('saca el sufijo de rol y capitaliza', () => {
    expect(formatTierName('premium_corredor')).toBe('Premium');
    expect(formatTierName('base_entrenador')).toBe('Base');
    expect(formatTierName('Premium_Entrenador')).toBe('Premium');
  });

  test('los guiones bajos que quedan pasan a espacios', () => {
    expect(formatTierName('premium_plus_corredor')).toBe('Premium plus');
    expect(formatTierName('elite__pro')).toBe('Elite pro');
  });

  test('sin nombre devuelve el fallback', () => {
    expect(formatTierName(null)).toBe('');
    expect(formatTierName(undefined, 'Tier')).toBe('Tier');
    expect(formatTierName('_corredor', 'Suscripción')).toBe('Suscripción');
  });
});
