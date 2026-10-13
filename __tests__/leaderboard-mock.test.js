import { mockGetTeamLeaderboard } from '../services/__mocks__/leaderboard-mock.js';

describe('leaderboard-mock', () => {
  test('`rows` tiene exactamente 5 entradas (ya es el top 5)', async () => {
    const dto = await mockGetTeamLeaderboard();
    expect(dto.rows).toHaveLength(5);
  });

  test('`viewer_rank` está fuera del top 5, para poder probar la fila propia aparte', async () => {
    const dto = await mockGetTeamLeaderboard();
    expect(dto.viewer_rank.rank).toBeGreaterThan(5);
  });

  test('`record` está presente para el modo histórico', async () => {
    const dto = await mockGetTeamLeaderboard();
    expect(dto.record).toBeTruthy();
    expect(dto.record.value).toBeGreaterThan(0);
  });
});
