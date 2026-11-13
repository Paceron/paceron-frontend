import { resolveAchievementIconName, ACHIEVEMENT_ICON_FALLBACK } from '../utils/achievement-icon.js';

describe('resolveAchievementIconName', () => {
  test('un glyph real de MaterialCommunityIcons se devuelve tal cual', () => {
    expect(resolveAchievementIconName('fire')).toBe('fire');
    expect(resolveAchievementIconName('map-marker-distance')).toBe('map-marker-distance');
  });

  test('un icon_name inválido (o un backend viejo con otra convención) cae al fallback', () => {
    expect(resolveAchievementIconName('bogus-icon-xyz')).toBe(ACHIEVEMENT_ICON_FALLBACK);
  });

  test('null/undefined/string vacío caen al fallback, sin tirar', () => {
    expect(resolveAchievementIconName(null)).toBe(ACHIEVEMENT_ICON_FALLBACK);
    expect(resolveAchievementIconName(undefined)).toBe(ACHIEVEMENT_ICON_FALLBACK);
    expect(resolveAchievementIconName('')).toBe(ACHIEVEMENT_ICON_FALLBACK);
  });

  test('el propio fallback es un glyph real (si no, no serviría de nada)', () => {
    expect(resolveAchievementIconName(ACHIEVEMENT_ICON_FALLBACK)).toBe(ACHIEVEMENT_ICON_FALLBACK);
  });
});
