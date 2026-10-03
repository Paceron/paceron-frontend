import { colorForUserId } from '../utils/participant-color.js';

describe('colorForUserId', () => {
  test('es determinístico: mismo userId, mismo color siempre', () => {
    expect(colorForUserId('12')).toBe(colorForUserId('12'));
    expect(colorForUserId(12)).toBe(colorForUserId('12')); // número u string, mismo resultado
  });

  test('devuelve un hex válido de 7 caracteres', () => {
    expect(colorForUserId('42')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('distintos userId suelen dar distinto color', () => {
    const colors = new Set(['1', '2', '3', '4', '5', '6', '7', '8'].map(colorForUserId));
    expect(colors.size).toBeGreaterThan(1);
  });

  test('userId null/undefined no explota', () => {
    expect(() => colorForUserId(null)).not.toThrow();
    expect(() => colorForUserId(undefined)).not.toThrow();
  });
});
