import { formatArs, formatMonthlyFee } from '../utils/currency.js';

describe('formatArs', () => {
  test('formatea en pesos sin decimales', () => {
    const out = formatArs(25000);
    expect(out).toContain('25.000');
    expect(out).not.toContain(',00');
  });

  test('formatea 0 como monto, no como "Gratis" (eso es de formatMonthlyFee)', () => {
    expect(formatArs(0)).toContain('0');
  });

  test('acepta strings numéricos', () => {
    expect(formatArs('25000')).toBe(formatArs(25000));
  });

  test('devuelve null para valores no numéricos', () => {
    expect(formatArs('abc')).toBeNull();
    expect(formatArs(null)).toBeNull();
    expect(formatArs(undefined)).toBeNull();
  });
});

describe('formatMonthlyFee', () => {
  // Un equipo sin cuota no cobra: "$ 0" se lee como un error de carga, no como
  // "es gratis".
  test('0 y valores no positivos son "Gratis"', () => {
    expect(formatMonthlyFee(0)).toBe('Gratis');
    expect(formatMonthlyFee(null)).toBe('Gratis');
    expect(formatMonthlyFee(undefined)).toBe('Gratis');
    expect(formatMonthlyFee(-5)).toBe('Gratis');
  });

  test('un monto positivo se formatea como moneda', () => {
    expect(formatMonthlyFee(25000)).toContain('25.000');
  });
});
