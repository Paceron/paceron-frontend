jest.mock('../config/env.js', () => ({ USE_MOCKS: false, API_BASE_URL: 'http://localhost:9999/api/v1' }));
jest.mock('../services/api.js', () => ({ __esModule: true, default: { get: jest.fn(async () => ({})) } }));
jest.mock('../services/__mocks__/trainer-home-kpis-mock.js', () => ({
  mockGetTrainerHomeKpis: jest.fn(async () => ({ sessions: {} })),
}));

import api from '../services/api.js';
import { mockGetTrainerHomeKpis } from '../services/__mocks__/trainer-home-kpis-mock.js';
import { getTrainerHomeKpis } from '../services/trainer-home-kpis.js';

const env = require('../config/env.js');

beforeEach(() => {
  env.USE_MOCKS = false;
  api.get.mockClear();
  mockGetTrainerHomeKpis.mockClear();
});

describe('trainer-home-kpis service', () => {
  test('envía período y fecha, sin IDs que cambien el scope autenticado', async () => {
    await getTrainerHomeKpis({ period: 'week', referenceDate: '05/11/2026' });
    expect(api.get).toHaveBeenCalledWith('/dashboard/trainer-home-kpis?period=week&reference_date=2026-11-05');
    expect(api.get.mock.calls[0][0]).not.toContain('owner_id');
    expect(api.get.mock.calls[0][0]).not.toContain('team_id');
  });

  test('no manda reference_date si el caller no la entrega', async () => {
    await getTrainerHomeKpis();
    expect(api.get).toHaveBeenCalledWith('/dashboard/trainer-home-kpis?period=month');
  });

  test('usa el fixture cuando USE_MOCKS está activo', async () => {
    env.USE_MOCKS = true;
    mockGetTrainerHomeKpis.mockResolvedValueOnce({ sessions: { scheduled: 4 } });
    await expect(getTrainerHomeKpis({ period: 'day', referenceDate: '05/11/2026' }))
      .resolves.toEqual({ sessions: { scheduled: 4 } });
    expect(mockGetTrainerHomeKpis).toHaveBeenCalledWith({ period: 'day', referenceDate: '2026-11-05' });
    expect(api.get).not.toHaveBeenCalled();
  });
});
