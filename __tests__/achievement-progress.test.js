import { computeLevelProgress } from '../utils/achievement-progress.js';

const LEVELED_CATALOG_ITEM = {
  family: 'leveled',
  levels: [
    { level: 1, name: 'Chispa', threshold: 5 },
    { level: 2, name: 'Fuego', threshold: 10 },
    { level: 3, name: 'Imparable', threshold: 20 },
    { level: 4, name: 'Máquina', threshold: 40 },
    { level: 5, name: 'Leyenda', threshold: 100 },
  ],
};

describe('computeLevelProgress', () => {
  test('familia `once` -> null (no aplica progreso de nivel)', () => {
    expect(computeLevelProgress({ family: 'once' }, { currentLevel: 0, count: 1 })).toBeNull();
  });

  test('familia `counter` -> null', () => {
    expect(computeLevelProgress({ family: 'counter' }, { currentLevel: 0, count: 7 })).toBeNull();
  });

  test('`leveled` sin `count` (backend sin el fix de Gap 31) -> null, degradación segura', () => {
    expect(computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 2, count: null })).toBeNull();
  });

  test('`leveled`, nivel 2, a mitad de camino a nivel 3 -> 50%', () => {
    const result = computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 2, count: 15 });
    expect(result).toEqual({ levelName: 'Fuego', nextLevelName: 'Imparable', percent: 50 });
  });

  test('`leveled`, todavía sin desbloquear nivel 1, con progreso parcial -> levelName null', () => {
    const result = computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 0, count: 3 });
    expect(result).toEqual({ levelName: null, nextLevelName: 'Chispa', percent: 60 });
  });

  test('`leveled`, ya en nivel 5 (Leyenda, el máximo) -> null, no hay "siguiente" para una barra', () => {
    expect(computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 5, count: 130 })).toBeNull();
  });
});
