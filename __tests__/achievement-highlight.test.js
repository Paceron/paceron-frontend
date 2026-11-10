import { pickAchievementHighlight } from '../utils/achievement-highlight.js';

describe('pickAchievementHighlight', () => {
  test('sin logros -> null (Rachas ocupa el ancho completo en el Home)', () => {
    expect(pickAchievementHighlight([])).toBeNull();
  });

  test('ninguno con progreso fraccional ni desbloqueado -> null', () => {
    const achievements = [
      { id: 'a', progressPercent: null, unlockedAt: null },
      { id: 'b', progressPercent: 100, unlockedAt: null },
    ];
    expect(pickAchievementHighlight(achievements)).toBeNull();
  });

  test('con progreso fraccional -> el de mayor porcentaje', () => {
    const achievements = [
      { id: 'a', progressPercent: 40, unlockedAt: null },
      { id: 'b', progressPercent: 80, unlockedAt: null },
      { id: 'c', progressPercent: 100, unlockedAt: '2026-09-01' },
    ];
    expect(pickAchievementHighlight(achievements).id).toBe('b');
  });

  test('sin progreso fraccional, con desbloqueados -> el más reciente', () => {
    const achievements = [
      { id: 'a', progressPercent: null, unlockedAt: '2026-09-01', lastUnlockedAt: '2026-09-01' },
      { id: 'b', progressPercent: null, unlockedAt: '2026-10-05', lastUnlockedAt: '2026-10-05' },
    ];
    expect(pickAchievementHighlight(achievements).id).toBe('b');
  });
});
