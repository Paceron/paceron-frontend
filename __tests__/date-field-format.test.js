import { toISODate } from '../utils/date-field-format.js';

describe('toISODate', () => {
  test('convierte DD/MM/YYYY (valor nativo de DateField) a YYYY-MM-DD', () => {
    expect(toISODate('15/03/2026')).toBe('2026-03-15');
  });

  test('deja YYYY-MM-DD (valor web de DateField) sin cambios', () => {
    expect(toISODate('2026-03-15')).toBe('2026-03-15');
  });

  test('devuelve string vacío si el valor es vacío o inválido', () => {
    expect(toISODate('')).toBe('');
    expect(toISODate(undefined)).toBe('');
    expect(toISODate('no es una fecha')).toBe('');
  });
});
