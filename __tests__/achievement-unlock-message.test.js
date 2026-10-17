import { buildAchievementUnlockMessage } from '../utils/achievement-unlock-message.js';

const base = [
  { id: 'first_training', name: 'Primera vez', levelName: null, unlockedAt: null },
  { id: 'consecutive_trainings', name: 'Entrenamientos Consecutivos', levelName: 'Chispa', unlockedAt: '2026-09-15' },
  { id: 'total_trainings', name: 'Entrenamientos totales', levelName: null, unlockedAt: '2026-09-01' },
];

describe('buildAchievementUnlockMessage', () => {
  test('sin lista previa (primer render) -> no hay mensaje', () => {
    expect(buildAchievementUnlockMessage(null, base)).toBeNull();
  });

  test('nada cambió -> no hay mensaje', () => {
    expect(buildAchievementUnlockMessage(base, base)).toBeNull();
  });

  test('un logro `once` se desbloquea por primera vez -> mensaje genérico', () => {
    const next = base.map((a) => (a.id === 'first_training' ? { ...a, unlockedAt: '2026-10-14' } : a));
    const msg = buildAchievementUnlockMessage(base, next);
    expect(msg).toEqual({ text1: '¡Logro desbloqueado!', text2: 'Primera vez' });
  });

  test('un logro `leveled` sube de nivel -> mensaje con el nombre del nuevo nivel', () => {
    const next = base.map((a) => (a.id === 'consecutive_trainings' ? { ...a, levelName: 'Fuego' } : a));
    const msg = buildAchievementUnlockMessage(base, next);
    expect(msg).toEqual({ text1: '¡Fuego!', text2: 'Entrenamientos Consecutivos' });
  });

  test('un logro `counter` incrementa (sin levelName ni unlockedAt nuevo) -> no hay mensaje', () => {
    const next = base.map((a) => (a.id === 'total_trainings' ? { ...a, count: 8 } : a));
    expect(buildAchievementUnlockMessage(base, next)).toBeNull();
  });
});
