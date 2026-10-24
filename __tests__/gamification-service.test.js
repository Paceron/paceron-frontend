jest.mock('../config/env.js', () => ({
  USE_MOCKS: false,
  API_BASE_URL: 'https://api.test/api/v1',
  WEB_ORIGIN: 'https://web.test',
  FRONT_ENVIRONMENT: 'test',
}));

const mockPost = jest.fn().mockResolvedValue(null);
jest.mock('../services/api.js', () => ({ __esModule: true, default: { post: (...a) => mockPost(...a) } }));

const { ackGamificationSeen } = require('../services/gamification.js');

describe('ackGamificationSeen -- team_id numérico', () => {
  beforeEach(() => { mockPost.mockClear(); });

  // Bug real 2026-10-24, contra backend real: `team.id` sale normalizado
  // como string (toTeamModel, services/normalizers.js) y competitions-tab.jsx
  // lo pasa tal cual -- el backend rechaza "cannot unmarshal string into...
  // int64" si team_id no es numérico en el body.
  test('castea un team_id string a número en el body', async () => {
    await ackGamificationSeen(5, 'competitions', '12');
    expect(mockPost).toHaveBeenCalledWith('/users/5/gamification/seen', { section: 'competitions', team_id: 12 });
  });

  test('sin team_id, el body no lo incluye', async () => {
    await ackGamificationSeen(5, 'streaks', null);
    expect(mockPost).toHaveBeenCalledWith('/users/5/gamification/seen', { section: 'streaks' });
  });
});
