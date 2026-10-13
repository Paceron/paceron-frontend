import { mockGetStreaks } from '../services/__mocks__/streaks-mock.js';

describe('streaks-mock', () => {
  test('devuelve exactamente `days` entradas', async () => {
    const dto = await mockGetStreaks(42);
    expect(dto.days).toHaveLength(42);
  });

  test('el último día (hoy) está pending en las dos rachas', async () => {
    const dto = await mockGetStreaks(42);
    const today = dto.days[dto.days.length - 1];
    expect(today.strict_status).toBe('pending');
    expect(today.flexible_status).toBe('pending');
  });

  test('el patrón de 7 días garantiza al menos un `failed` en una ventana de 42', async () => {
    const dto = await mockGetStreaks(42);
    expect(dto.days.some((d) => d.strict_status === 'failed')).toBe(true);
  });

  test('con menos días pedidos, devuelve menos días', async () => {
    const dto = await mockGetStreaks(7);
    expect(dto.days).toHaveLength(7);
  });
});
