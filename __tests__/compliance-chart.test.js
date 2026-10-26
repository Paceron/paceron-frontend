import { buildComplianceBars, shortDateLabel } from '../utils/compliance-chart.js';

const session = (id, date, compliancePct) => ({ sessionInstanceId: String(id), date, compliancePct });

describe('buildComplianceBars', () => {
  it('returns nothing without data or size', () => {
    expect(buildComplianceBars([], { width: 300, height: 170 })).toEqual([]);
    expect(buildComplianceBars([session(1, '2026-10-12', 50)], { width: 0, height: 170 })).toEqual([]);
    expect(buildComplianceBars(null, { width: 300, height: 170 })).toEqual([]);
  });

  it('scales against a fixed 0-100 ceiling', () => {
    const bars = buildComplianceBars([session(1, '2026-10-12', 100), session(2, '2026-10-13', 50)], { width: 206, height: 134, gap: 6, labelHeight: 18, valueHeight: 16 });
    // plotHeight = 134 - 18 - 16 = 100
    expect(bars[0].height).toBe(100);
    expect(bars[0].y).toBe(16);
    expect(bars[1].height).toBe(50);
    expect(bars[1].y).toBe(66);
    expect(bars[0].width).toBe(100);
    expect(bars[1].x).toBe(106);
    expect(bars[0].tone).toBe('good');
    expect(bars[1].tone).toBe('partial');
  });

  it('keeps a minimum stroke for 0 % and clamps out-of-range values', () => {
    const bars = buildComplianceBars([session(1, '2026-10-12', 0), session(2, '2026-10-13', 140), session(3, '2026-10-14', -5)], { width: 300, height: 134 });
    expect(bars[0].height).toBe(2);
    expect(bars[0].tone).toBe('low');
    expect(bars[1].compliancePct).toBe(100);
    expect(bars[2].compliancePct).toBe(0);
  });

  it('spaces labels when there are many sessions', () => {
    const many = Array.from({ length: 30 }, (_, i) => session(i, `2026-09-${String(i + 1).padStart(2, '0')}`, 60));
    const bars = buildComplianceBars(many, { width: 300, height: 170 });
    const labeled = bars.filter((b) => b.showLabel);
    expect(labeled.length).toBeLessThan(30);
    expect(bars[0].showLabel).toBe(true);
    expect(bars[29].showLabel).toBe(true);
    expect(bars.every((b) => b.showValue === b.showLabel)).toBe(true);
  });

  it('shows every value when bars are wide', () => {
    const bars = buildComplianceBars([session(1, '2026-10-12', 10), session(2, '2026-10-13', 20)], { width: 300, height: 170 });
    expect(bars.every((b) => b.showValue)).toBe(true);
  });

  it('formats the short date label', () => {
    expect(shortDateLabel('2026-10-12')).toBe('12/10');
    expect(shortDateLabel(null)).toBe('');
  });
});

describe('buildComplianceBars — sesión de hoy sin terminar', () => {
  it('pinta en gris la sesión que todavía no cuenta en el promedio', () => {
    const bars = buildComplianceBars(
      [session(1, '2026-10-12', 50), { ...session(2, '2026-10-13', 0), countsForAverage: false }],
      { width: 300, height: 170 },
    );
    expect(bars.map((b) => b.tone)).toEqual(['partial', 'pending']);
  });
});
