import {
  formatMonthLong,
  formatMonthShort,
  selectCurrentAndPrevious,
  computeMonthOverMonth,
  formatMonthOverMonth,
  formatNetLabel,
  isSummaryEmpty,
  shiftMonth,
  windowRange,
  canGoBack,
  amountFor,
  toChartPoints,
  monthTileContent,
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
    expect(computeMonthOverMonth({ grossAmount: 500 }, { grossAmount: 0 })).toEqual({ pct: null, direction: 'none', reason: 'no-previous' });
    expect(computeMonthOverMonth({ grossAmount: 500 }, null)).toEqual({ pct: null, direction: 'none', reason: 'no-previous' });
  });

  test('en neto compara netos, y sin neto en alguno de los dos no compara', () => {
    const full = (net, count = 1) => ({ grossAmount: 1000, netAmount: net, approvedCount: count, netKnownCount: count });
    expect(computeMonthOverMonth(full(900), full(600), 'net')).toEqual({ pct: 50, direction: 'up' });
    const noNet = { grossAmount: 1000, netAmount: null, approvedCount: 2, netKnownCount: 0 };
    expect(computeMonthOverMonth(full(900), noNet, 'net')).toEqual({ pct: null, direction: 'none', reason: 'no-net' });
    expect(computeMonthOverMonth(noNet, full(900), 'net')).toEqual({ pct: null, direction: 'none', reason: 'no-net' });
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

describe('ventana del gráfico', () => {
  test('shiftMonth corre meses y cruza de año', () => {
    expect(shiftMonth('2026-09', -6)).toBe('2026-03');
    expect(shiftMonth('2026-03', -6)).toBe('2025-09');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-09', 0)).toBe('2026-09');
  });

  test('windowRange nombra el rango, con el año de cada punta si difieren', () => {
    expect(windowRange([{ month: '2026-04' }, { month: '2026-09' }])).toBe('abr – sep 2026');
    expect(windowRange([{ month: '2025-12' }, { month: '2026-05' }])).toBe('dic 2025 – may 2026');
    expect(windowRange([])).toBe('');
  });

  test('canGoBack mira el primer mes de la ventana contra el primer cobro', () => {
    const w = [{ month: '2026-04' }, { month: '2026-09' }];
    expect(canGoBack(w, '2026-02')).toBe(true);
    expect(canGoBack(w, '2026-04')).toBe(false);
    expect(canGoBack(w, '2026-06')).toBe(false);
    expect(canGoBack(w, null)).toBe(false);
    expect(canGoBack([], '2026-02')).toBe(false);
  });
});

describe('bruto o neto', () => {
  const month = (over) => ({ month: '2026-09', grossAmount: 12000, netAmount: 11000, approvedCount: 2, netKnownCount: 2, ...over });

  test('amountFor en bruto devuelve el bruto', () => {
    expect(amountFor(month(), 'gross')).toEqual({ value: 12000, partial: false, missing: false });
  });

  test('amountFor en neto: completo, parcial, sin dato y mes sin cobros', () => {
    expect(amountFor(month(), 'net')).toEqual({ value: 11000, partial: false, missing: false });
    expect(amountFor(month({ netKnownCount: 1 }), 'net')).toEqual({ value: 11000, partial: true, missing: false });
    expect(amountFor(month({ netAmount: null, netKnownCount: 0 }), 'net')).toEqual({ value: null, partial: false, missing: true });
    // Sin cobros aprobados el neto es 0 de verdad, no un dato faltante.
    expect(amountFor(month({ grossAmount: 0, netAmount: null, approvedCount: 0, netKnownCount: 0 }), 'net')).toEqual({ value: 0, partial: false, missing: false });
    expect(amountFor(null, 'net')).toEqual({ value: 0, partial: false, missing: false });
  });

  test('toChartPoints arma los puntos del gráfico en el modo elegido', () => {
    const points = toChartPoints([month(), month({ month: '2026-10', netAmount: null, netKnownCount: 0 })], 'net');
    expect(points).toEqual([
      { month: '2026-09', value: 11000, partial: false, missing: false },
      { month: '2026-10', value: null, partial: false, missing: true },
    ]);
    expect(toChartPoints(null, 'gross')).toEqual([]);
  });

  test('monthTileContent: valor y aclaración del tile del mes', () => {
    const g = monthTileContent(month({ netKnownCount: 1 }), 'gross');
    expect(plain(g.value)).toBe('$ 12.000');
    expect(plain(g.hint)).toBe('Neto parcial $ 11.000 (1 de 2)');
    const n = monthTileContent(month({ netKnownCount: 1 }), 'net');
    expect(plain(n.value)).toBe('$ 11.000');
    expect(n.hint).toBe('Neto parcial (1 de 2)');
    expect(plain(monthTileContent(month(), 'net').hint)).toBe('Bruto $ 12.000');
    expect(monthTileContent(month({ netAmount: null, netKnownCount: 0 }), 'net')).toEqual({ value: '—', hint: 'Sin datos de neto' });
    expect(plain(monthTileContent(null, 'net').value)).toBe('$ 0');
  });
});
