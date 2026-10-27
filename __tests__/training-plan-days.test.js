import { buildEmptyPlanDays } from '../utils/training-plan-days.js';

describe('buildEmptyPlanDays', () => {
  test('arma dayCount días numerados 1..dayCount, todos rest, sin día de la semana', () => {
    const days = buildEmptyPlanDays(10);
    expect(days).toHaveLength(10);
    expect(days.map((d) => d.sequenceNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(days.every((d) => d.kind === 'rest')).toBe(true);
    expect(days.every((d) => !('dayOfWeek' in d))).toBe(true);
  });

  test('con dayCount 2, arma exactamente 2 días', () => {
    expect(buildEmptyPlanDays(2)).toHaveLength(2);
  });
});
