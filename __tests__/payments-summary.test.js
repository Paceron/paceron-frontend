import {
  formatMonthLong,
  formatMonthShort,
  selectCurrentAndPrevious,
  computeMonthOverMonth,
  formatMonthOverMonth,
  formatNetLabel,
  isSummaryEmpty,
} from '../utils/payments-summary.js';

const plain = (s) => s.replace(/ /g, ' ');

describe('nombres de mes', () => {
  test('largo y corto', () => {
    expect(formatMonthLong('2026-09')).toBe('septiembre');
    expect(formatMonthShort('2026-09')).toBe('sep');
    expect(formatMonthLong('2026-01')).toBe('enero');
  });

  test('clave inválida', () => {
    expect(formatMonthLong('2026-13')).toBe('');
    expect(formatMonthShort(undefined)).toBe('');
  });
});

describe('selectCurrentAndPrevious', () => {
  test('toma los dos últimos', () => {
    const monthly = [{ month: '2026-07' }, { month: '2026-08' }, { month: '2026-09' }];
    expect(selectCurrentAndPrevious(monthly)).toEqual({ current: { month: '2026-09' }, previous: { month: '2026-08' } });
  });

  test('tolera listas cortas', () => {
    expect(selectCurrentAndPrevious([{ month: '2026-09' }])).toEqual({ current: { month: '2026-09' }, previous: null });
    expect(selectCurrentAndPrevious(null)).toEqual({ current: null, previous: null });
  });
});

describe('computeMonthOverMonth', () => {
  test('sube, baja o queda igual', () => {
    expect(computeMonthOverMonth({ grossAmount: 120 }, { grossAmount: 100 })).toEqual({ pct: 20, direction: 'up' });
    expect(computeMonthOverMonth({ grossAmount: 75 }, { grossAmount: 100 })).toEqual({ pct: -25, direction: 'down' });
    expect(computeMonthOverMonth({ grossAmount: 100 }, { grossAmount: 100 })).toEqual({ pct: 0, direction: 'flat' });
  });

  test('sin cobros el mes anterior no hay porcentaje', () => {
    expect(computeMonthOverMonth({ grossAmount: 500 }, { grossAmount: 0 })).toEqual({ pct: null, direction: 'none' });
    expect(computeMonthOverMonth({ grossAmount: 500 }, null)).toEqual({ pct: null, direction: 'none' });
  });

  test('formatea la etiqueta', () => {
    expect(formatMonthOverMonth({ pct: 20, direction: 'up' })).toBe('+20%');
    expect(formatMonthOverMonth({ pct: -25, direction: 'down' })).toBe('-25%');
    expect(formatMonthOverMonth({ pct: 0, direction: 'flat' })).toBe('Igual');
    expect(formatMonthOverMonth({ pct: null, direction: 'none' })).toBe('—');
  });
});

describe('formatNetLabel', () => {
  test('neto completo, parcial o no disponible', () => {
    expect(plain(formatNetLabel({ netAmount: 42000, netKnownCount: 3, approvedCount: 3 }))).toBe('Neto $ 42.000');
    expect(plain(formatNetLabel({ netAmount: 28000, netKnownCount: 2, approvedCount: 5 }))).toBe('Neto parcial $ 28.000 (2 de 5)');
    expect(formatNetLabel({ netAmount: null, netKnownCount: 0, approvedCount: 4 })).toBe('Neto no disponible');
  });

  test('sin cobros aprobados no dice nada', () => {
    expect(formatNetLabel({ netAmount: null, netKnownCount: 0, approvedCount: 0 })).toBe('');
  });
});

describe('isSummaryEmpty', () => {
  test('vacío sin cobros ni intentos', () => {
    expect(isSummaryEmpty({ monthly: [{ grossAmount: 0 }], byTeam: [], pendingCount: 0, rejectedCount: 0 })).toBe(true);
    expect(isSummaryEmpty(null)).toBe(true);
  });

  test('no vacío con cobros o con intentos pendientes', () => {
    expect(isSummaryEmpty({ monthly: [{ grossAmount: 100 }], byTeam: [{}], pendingCount: 0, rejectedCount: 0 })).toBe(false);
    expect(isSummaryEmpty({ monthly: [{ grossAmount: 0 }], byTeam: [{}], pendingCount: 1, rejectedCount: 0 })).toBe(false);
  });
});
