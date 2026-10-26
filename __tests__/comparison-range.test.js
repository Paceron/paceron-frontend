import { buildComparisonRange, defaultComparisonRange, isoToFieldDate, toLocalISODate } from '../utils/comparison-range.js';

const NOW = new Date(2026, 9, 13, 15, 0, 0);

describe('comparison range', () => {
  it('defaults to the last 30 days in field format', () => {
    expect(defaultComparisonRange(NOW)).toEqual({ fromInput: '13/09/2026', toInput: '13/10/2026' });
  });

  it('converts between ISO and field dates', () => {
    expect(isoToFieldDate('2026-10-12')).toBe('12/10/2026');
    expect(isoToFieldDate('')).toBe('');
    expect(toLocalISODate(NOW)).toBe('2026-10-13');
  });

  it('accepts a valid range in both formats', () => {
    expect(buildComparisonRange('01/10/2026', '13/10/2026', NOW)).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-13', error: null });
    expect(buildComparisonRange('2026-10-01', '2026-10-12', NOW)).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-12', error: null });
  });

  it('rejects missing, inverted, malformed, future and too long ranges', () => {
    expect(buildComparisonRange('', '13/10/2026', NOW).error).toMatch(/dos fechas/);
    expect(buildComparisonRange('13/10/2026', '01/10/2026', NOW).error).toMatch(/posterior a la fecha/);
    expect(buildComparisonRange('1/10/26', '13/10/2026', NOW).error).toMatch(/formato/);
    expect(buildComparisonRange('01/10/2026', '14/10/2026', NOW).error).toMatch(/posterior a hoy/);
    expect(buildComparisonRange('01/01/2025', '13/10/2026', NOW).error).toMatch(/366/);
    expect(buildComparisonRange('13/10/2025', '13/10/2026', NOW).error).toBeNull();
  });
});
