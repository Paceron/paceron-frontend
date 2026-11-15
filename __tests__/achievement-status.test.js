import { isAchievementUnlocked } from '../utils/achievement-status.js';

describe('isAchievementUnlocked', () => {
  test('usa unlockedAt cuando existe', () => {
    expect(isAchievementUnlocked({ unlockedAt: '2026-11-01T00:00:00Z' })).toBe(true);
  });

  test('un logro por niveles está desbloqueado con currentLevel mayor a cero', () => {
    expect(isAchievementUnlocked({ family: 'leveled', currentLevel: 2, count: 0 })).toBe(true);
  });

  test('un logro contador está desbloqueado con al menos una vez', () => {
    expect(isAchievementUnlocked({ family: 'counter', currentLevel: 0, count: 1 })).toBe(true);
  });

  test('un logro de una sola vez requiere alcanzar el umbral', () => {
    expect(isAchievementUnlocked({ family: 'once', currentLevel: 0, count: 2, threshold: 3 })).toBe(false);
    expect(isAchievementUnlocked({ family: 'once', currentLevel: 0, count: 3, threshold: 3 })).toBe(true);
  });

  test('sin datos de progreso queda bloqueado', () => {
    expect(isAchievementUnlocked({ family: 'leveled', currentLevel: 0, count: null })).toBe(false);
  });
});
