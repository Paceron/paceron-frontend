import { mockGetAchievementsCatalog, mockGetUserAchievements, mockGetStamps } from '../services/__mocks__/achievements-mock.js';

describe('achievements-mock', () => {
  test('el catálogo tiene al menos un ítem de cada familia', async () => {
    const catalog = await mockGetAchievementsCatalog();
    const families = catalog.map((item) => item.family);
    expect(families).toContain('once');
    expect(families).toContain('leveled');
    expect(families).toContain('counter');
  });

  test('el progreso referencia solo ids que existen en el catálogo', async () => {
    const catalog = await mockGetAchievementsCatalog();
    const progress = await mockGetUserAchievements();
    const catalogIds = catalog.map((item) => item.id);
    for (const entry of progress) {
      expect(catalogIds).toContain(entry.achievement_id);
    }
  });

  test('las estampas incluyen al menos un `achievement_counter` y un `competition`', async () => {
    const stamps = await mockGetStamps();
    const types = stamps.map((s) => s.type);
    expect(types).toContain('achievement_counter');
    expect(types).toContain('competition');
  });
});
