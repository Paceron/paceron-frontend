import { buildMonthlyBars } from '../utils/payments-chart.js';

const monthly = [
  { month: '2026-07', grossAmount: 50 },
  { month: '2026-08', grossAmount: 0 },
  { month: '2026-09', grossAmount: 100 },
];

describe('buildMonthlyBars', () => {
  test('reparte el ancho entre las barras con su separación', () => {
    const bars = buildMonthlyBars(monthly, { width: 320, height: 160, gap: 10 });
    expect(bars).toHaveLength(3);
    expect(bars[0].width).toBe(100);
    expect(bars[1].x).toBe(110);
    expect(bars[2].x).toBe(220);
  });

  test('la barra más alta ocupa todo el alto útil y el resto es proporcional', () => {
    const bars = buildMonthlyBars(monthly, { width: 320, height: 160, labelHeight: 18, valueHeight: 16 });
    const plot = 160 - 18 - 16;
    expect(bars[2].height).toBe(plot);
    expect(bars[2].y).toBe(16);
    expect(bars[0].height).toBe(plot / 2);
    expect(bars[0].y + bars[0].height).toBe(16 + plot);
  });

  test('un mes sin cobros queda en 0 y un mes chico se ve igual', () => {
    const bars = buildMonthlyBars(
      [{ month: 'a', grossAmount: 1 }, { month: 'b', grossAmount: 0 }, { month: 'c', grossAmount: 100000 }],
      { width: 300, height: 160 }
    );
    expect(bars[1].height).toBe(0);
    expect(bars[0].height).toBeGreaterThanOrEqual(3);
  });

  test('marca solo el último mes como actual', () => {
    const bars = buildMonthlyBars(monthly, { width: 320, height: 160 });
    expect(bars.map((b) => b.isCurrent)).toEqual([false, false, true]);
  });

  test('todo en cero no divide por cero', () => {
    const bars = buildMonthlyBars([{ month: 'a', grossAmount: 0 }, { month: 'b', grossAmount: 0 }], { width: 200, height: 100 });
    bars.forEach((b) => expect(b.height).toBe(0));
  });

  test('sin datos o sin medida todavía no dibuja nada', () => {
    expect(buildMonthlyBars([], { width: 300, height: 160 })).toEqual([]);
    expect(buildMonthlyBars(monthly, { width: 0, height: 160 })).toEqual([]);
    expect(buildMonthlyBars(null, { width: 300, height: 160 })).toEqual([]);
  });
});
