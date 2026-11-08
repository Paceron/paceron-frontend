import { summarizeMonthDays } from '../utils/calendar-month-summary.js';

describe('summarizeMonthDays', () => {
  test('cuenta cada kind por separado', () => {
    const days = [
      { date: '2026-11-02', kind: 'training' },
      { date: '2026-11-03', kind: 'training' },
      { date: '2026-11-04', kind: 'rest' },
      { date: '2026-11-05', kind: 'other' },
      { date: '2026-11-06', kind: 'cancelled' },
    ];
    expect(summarizeMonthDays(days)).toEqual({ training: 2, rest: 1, other: 1, cancelled: 1 });
  });

  test('sin días: todos los conteos en 0, no undefined', () => {
    expect(summarizeMonthDays([])).toEqual({ training: 0, rest: 0, other: 0, cancelled: 0 });
  });

  test('days ausente (undefined/null) se trata como vacío', () => {
    expect(summarizeMonthDays(undefined)).toEqual({ training: 0, rest: 0, other: 0, cancelled: 0 });
    expect(summarizeMonthDays(null)).toEqual({ training: 0, rest: 0, other: 0, cancelled: 0 });
  });

  test('ignora un kind desconocido sin romper', () => {
    expect(summarizeMonthDays([{ date: '2026-11-02', kind: 'unknown' }])).toEqual({ training: 0, rest: 0, other: 0, cancelled: 0 });
  });
});
