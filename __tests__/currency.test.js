import { formatArs, formatARSCompact, formatMonthlyFee } from '../utils/currency.js';

// Intl es-AR separa el signo con un espacio duro; se normaliza para comparar.
const plain = (s) => s.replace(/ /g, ' ');

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

describe('formatArs con decimales', () => {
  test('redondea al entero por default', () => {
    expect(plain(formatArs(9999.6))).toBe('$ 10.000');
  });

  test('acepta decimales', () => {
    expect(plain(formatArs(14101.5, { decimals: 2 }))).toBe('$ 14.101,50');
  });
});

describe('formatARSCompact', () => {
  it('usa "mil" para miles', () => {
    expect(formatARSCompact(45000)).toBe('$45 mil');
    expect(formatARSCompact(45500)).toBe('$45,5 mil');
  });

  it('usa "M" para millones', () => {
    expect(formatARSCompact(1200000)).toBe('$1,2 M');
    expect(formatARSCompact(3000000)).toBe('$3 M');
  });

  it('muestra el número entero debajo de mil', () => {
    expect(formatARSCompact(900)).toBe('$900');
    expect(formatARSCompact(0)).toBe('$0');
  });

  it('conserva el signo y tolera basura', () => {
    expect(formatARSCompact(-2500)).toBe('-$2,5 mil');
    expect(formatARSCompact(undefined)).toBe('$0');
  });
});
