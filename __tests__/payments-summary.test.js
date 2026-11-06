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
  monthOverMonthTileContent,
  statusTileContent,
  monthTooltipContent,
  formatInstallmentCount,
  pendingFor,
  formatDueDate,
  formatFeeLabel,
  overdueLabel,
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
      { month: '2026-09', value: 11000, partial: false, missing: false, pending: 0 },
      { month: '2026-10', value: null, partial: false, missing: true, pending: 0 },
    ]);
    expect(toChartPoints(null, 'gross')).toEqual([]);
  });

  test('monthTileContent: monto del mes y, abajo, las cuotas', () => {
    const g = monthTileContent(month({ netKnownCount: 1 }), 'gross');
    expect(plain(g.value)).toBe('$ 12.000');
    expect(plain(g.hint)).toBe('2 cuotas · Neto parcial $ 11.000 (1 de 2)');
    const n = monthTileContent(month({ netKnownCount: 1 }), 'net');
    expect(plain(n.value)).toBe('$ 11.000');
    expect(n.hint).toBe('2 cuotas · Neto parcial (1 de 2)');
    expect(plain(monthTileContent(month(), 'net').hint)).toBe('2 cuotas · Bruto $ 12.000');
    expect(monthTileContent(month({ netAmount: null, netKnownCount: 0 }), 'net')).toEqual({ value: '—', hint: '2 cuotas · Sin datos de neto' });
    expect(plain(monthTileContent(null, 'net').value)).toBe('$ 0');
    expect(monthTileContent(null, 'gross').hint).toBe('0 cuotas');
  });

  test('formatInstallmentCount', () => {
    expect(formatInstallmentCount(1)).toBe('1 cuota');
    expect(formatInstallmentCount(3)).toBe('3 cuotas');
    expect(formatInstallmentCount(undefined)).toBe('0 cuotas');
  });

  test('monthOverMonthTileContent: diferencia en pesos, porcentaje y cuotas', () => {
    const up = monthOverMonthTileContent(month({ grossAmount: 15000, approvedCount: 3 }), month({ grossAmount: 12000 }));
    expect(plain(up.value)).toBe('+$ 3.000');
    expect(up.hint).toBe('+25% · 3 cuotas vs 2');
    expect(up.direction).toBe('up');
    const down = monthOverMonthTileContent(month({ grossAmount: 9000, approvedCount: 1 }), month());
    expect(plain(down.value)).toBe('-$ 3.000');
    expect(down.hint).toBe('-25% · 1 cuota vs 2');
    const flat = monthOverMonthTileContent(month(), month());
    expect(flat).toEqual({ value: 'Igual', hint: '2 cuotas vs 2', direction: 'flat' });
    // Sin cobros el mes anterior: hay diferencia pero no porcentaje.
    const fromZero = monthOverMonthTileContent(month(), month({ grossAmount: 0, approvedCount: 0 }));
    expect(plain(fromZero.value)).toBe('+$ 12.000');
    expect(fromZero.hint).toBe('2 cuotas vs 0');
    expect(monthOverMonthTileContent(null, null)).toEqual({ value: '—', hint: 'Sin cobros para comparar', direction: 'none' });
    expect(monthOverMonthTileContent(month({ netAmount: null, netKnownCount: 0 }), month(), 'net').hint).toBe('Sin datos de neto');
  });

  test('statusTileContent: monto de las cuotas pendientes o rechazadas', () => {
    const summary = { pendingCount: 1, pendingAmount: 15000, pendingNetAmount: 14250, rejectedCount: 2, rejectedAmount: 30000, rejectedNetAmount: 28500 };
    expect(plain(statusTileContent(summary, 'pending', 'gross').value)).toBe('$ 15.000');
    expect(statusTileContent(summary, 'pending', 'gross').hint).toBe('1 cuota');
    expect(plain(statusTileContent(summary, 'rejected', 'net').value)).toBe('$ 28.500');
    expect(statusTileContent(summary, 'rejected', 'net').hint).toBe('2 cuotas');
    expect(plain(statusTileContent({}, 'pending', 'gross').value)).toBe('$ 0');
  });

  test('monthTooltipContent: lo cobrado, la comisión, el neto y lo pendiente', () => {
    const t = monthTooltipContent(month({ month: '2026-10', pendingAmount: 24000, pendingNetAmount: 22800, pendingCount: 2 }), 'gross');
    expect(t.title).toBe('Octubre 2026');
    expect(t.rows.map((r) => [r.label, plain(r.value), r.detail])).toEqual([
      ['Cobrado', '$ 12.000', '2 cuotas'],
      ['Comisión', '$ 1.000', ''],
      ['Neto', '$ 11.000', ''],
      ['Pendiente', '$ 24.000', '2 cuotas'],
    ]);
    expect(plain(monthTooltipContent(month({ pendingAmount: 24000, pendingNetAmount: 22800, pendingCount: 2 }), 'net').rows[3].value)).toBe('$ 22.800');
    // Sin cobros: solo el cobrado en 0, sin comisión ni neto.
    expect(monthTooltipContent(month({ grossAmount: 0, netAmount: null, approvedCount: 0, netKnownCount: 0 }), 'gross').rows.map((r) => r.key)).toEqual(['gross']);
    expect(monthTooltipContent(month({ netAmount: null, netKnownCount: 0 }), 'gross').rows[1]).toEqual({ key: 'net', label: 'Neto', value: 's/d' });
    expect(monthTooltipContent(month({ netKnownCount: 1 }), 'gross').rows[2].detail).toBe('1 de 2');
  });
});

describe('pendiente por mes', () => {
  const month = { month: '2026-10', pendingAmount: 20000, pendingNetAmount: 19000, pendingCount: 2 };

  test('pendingFor elige bruto o neto según el modo', () => {
    expect(pendingFor(month, 'gross')).toBe(20000);
    expect(pendingFor(month, 'net')).toBe(19000);
    expect(pendingFor({}, 'net')).toBe(0);
    expect(pendingFor(null, 'gross')).toBe(0);
  });

  test('toChartPoints suma el pendiente a cada punto', () => {
    expect(toChartPoints([{ month: '2026-10', grossAmount: 5000, netAmount: 4750, approvedCount: 1, netKnownCount: 1, ...month }], 'net')[0])
      .toEqual(expect.objectContaining({ value: 4750, pending: 19000 }));
  });
});

describe('vencimientos y comisión', () => {
  test('formatDueDate corta el día en hora argentina', () => {
    expect(formatDueDate('2026-11-07T02:37:47Z')).toBe('06/11/2026');
    expect(formatDueDate('2026-11-06T15:00:00Z')).toBe('06/11/2026');
    expect(formatDueDate(null)).toBe('');
    expect(formatDueDate('no-es-fecha')).toBe('');
  });

  test('formatFeeLabel', () => {
    expect(formatFeeLabel(5)).toBe('comisión 5%');
    expect(formatFeeLabel(2.5)).toBe('comisión 2,5%');
    expect(formatFeeLabel(null)).toBe('');
  });

  test('overdueLabel', () => {
    expect(overdueLabel({ overdue: false, overdueCount: 0 })).toBe('');
    expect(overdueLabel({ overdue: true, overdueCount: 1 })).toBe('vencida');
    expect(overdueLabel({ overdue: true, overdueCount: 3 })).toBe('3 cuotas vencidas');
  });
});
