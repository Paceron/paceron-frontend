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

  test('los `current` días antes de hoy están completed, consistente con strict.current', async () => {
    const dto = await mockGetStreaks(30);
    const current = dto.strict.current;
    const beforeToday = dto.days.slice(dto.days.length - 1 - current, dto.days.length - 1);
    expect(beforeToday).toHaveLength(current);
    expect(beforeToday.every((d) => d.strict_status === 'completed')).toBe(true);
    const dayThatBrokeIt = dto.days[dto.days.length - 2 - current];
    expect(dayThatBrokeIt.strict_status).toBe('failed');
  });
});
