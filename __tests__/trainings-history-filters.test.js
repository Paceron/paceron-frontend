import { buildDateRangeFilters } from '../utils/trainings-history-filters.js';

describe('buildDateRangeFilters', () => {
  test('sin ninguna fecha cargada, no filtra y sin error', () => {
    expect(buildDateRangeFilters('', '')).toEqual({ dateFrom: null, dateTo: null, error: null });
  });

  test('con una sola fecha cargada, no manda ninguna (política de a par)', () => {
    expect(buildDateRangeFilters('2026-09-20', '')).toEqual({ dateFrom: null, dateTo: null, error: null });
    expect(buildDateRangeFilters('', '2026-09-20')).toEqual({ dateFrom: null, dateTo: null, error: null });
  });

  test('con ambas en formato ISO (web), rango válido', () => {
    expect(buildDateRangeFilters('2026-09-01', '2026-09-20')).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-20', error: null });
  });

  test('con ambas en formato DD/MM/YYYY (nativo), normaliza a ISO', () => {
    expect(buildDateRangeFilters('01/09/2026', '20/09/2026')).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-20', error: null });
  });

  test('mismo día en ambos extremos es válido', () => {
    expect(buildDateRangeFilters('2026-09-20', '2026-09-20')).toEqual({ dateFrom: '2026-09-20', dateTo: '2026-09-20', error: null });
  });

  test('dateFrom posterior a dateTo devuelve error y no filtra', () => {
    expect(buildDateRangeFilters('2026-09-20', '2026-09-01')).toEqual({
      dateFrom: null,
      dateTo: null,
      error: 'La fecha "desde" no puede ser posterior a la fecha "hasta".',
    });
  });
});
