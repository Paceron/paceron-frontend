import { formatARS, formatARSCompact } from '../utils/currency.js';

// Intl es-AR separa el signo con un espacio duro; se normaliza para comparar.
const plain = (s) => s.replace(/ /g, ' ');

describe('formatARS', () => {
  it('formatea sin decimales por default', () => {
    expect(plain(formatARS(15000))).toBe('$ 15.000');
  });

  it('redondea al entero', () => {
    expect(plain(formatARS(9999.6))).toBe('$ 10.000');
  });

  it('acepta decimales', () => {
    expect(plain(formatARS(14101.5, { decimals: 2 }))).toBe('$ 14.101,50');
  });

  it('acepta strings numéricos', () => {
    expect(plain(formatARS('1500'))).toBe('$ 1.500');
  });

  it('devuelve vacío sin monto', () => {
    expect(formatARS(null)).toBe('');
    expect(formatARS(undefined)).toBe('');
    expect(formatARS('abc')).toBe('');
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
