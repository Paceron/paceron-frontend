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

  test('el valor varía según la métrica, en la unidad que le corresponde (Gap 32) -- no siempre el mismo número con forma de metros', async () => {
    const distance = await mockGetTeamLeaderboard('distance');
    const pace = await mockGetTeamLeaderboard('pace');
    const peakSpeed = await mockGetTeamLeaderboard('peak_speed');
    expect(distance.rows[0].value).toBeGreaterThan(1000); // metros, plausible
    expect(pace.rows[0].value).toBeLessThan(15); // min/km, nunca miles
    expect(peakSpeed.rows[0].value).toBeLessThan(50); // km/h, nunca miles
    expect(distance.rows[0].value).not.toBe(pace.rows[0].value);
  });
});
