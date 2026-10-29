jest.mock('../config/env.js', () => ({ USE_MOCKS: false, API_BASE_URL: 'http://localhost:9999/api/v1' }));
jest.mock('../services/api.js', () => ({
  __esModule: true,
  default: { get: jest.fn(async () => ({})) },
}));
jest.mock('../store/auth-store.js', () => ({
  useAuthStore: { getState: jest.fn(() => ({ userId: 101 })) },
}));
jest.mock('../services/__mocks__/runner-kpis-mock.js', () => ({
  mockGetRunnerKpis: jest.fn(async () => ({})),
}));

import api from '../services/api.js';
import { mockGetRunnerKpis } from '../services/__mocks__/runner-kpis-mock.js';
import { useAuthStore } from '../store/auth-store.js';
import { getRunnerKpis } from '../services/runner-kpis.js';

const env = require('../config/env.js');

function lastGet() {
  return api.get.mock.calls[api.get.mock.calls.length - 1][0];
}

function queryOf(url) {
  const [, search = ''] = url.split('?');
  return new URLSearchParams(search);
}

beforeEach(() => {
  env.USE_MOCKS = false;
  useAuthStore.getState.mockReturnValue({ userId: 101 });
  api.get.mockClear();
  mockGetRunnerKpis.mockClear();
});

describe('runner-kpis service — request real', () => {
  test('la URL es /dashboard/runner-kpis y lleva solo period, reference_date y tab', async () => {
    await getRunnerKpis({ period: 'month', referenceDate: '2026-10-28', tab: 'general' });
    expect(lastGet()).toBe('/dashboard/runner-kpis?period=month&reference_date=2026-10-28&tab=general');
  });

  test('no agrega ids de scope: el corredor sale del token', async () => {
    await getRunnerKpis({ period: 'week', referenceDate: '2026-10-28', tab: 'ritmo_continuo' });
    const query = queryOf(lastGet());
    expect(query.has('team_id')).toBe(false);
    expect(query.has('group_id')).toBe(false);
    expect(query.has('athlete_user_id')).toBe(false);
    expect([...query.keys()].sort()).toEqual(['period', 'reference_date', 'tab']);
  });

  test('normaliza referenceDate a ISO en el borde de la request', async () => {
    await getRunnerKpis({ period: 'day', referenceDate: '28/10/2026', tab: 'velocidad_tiempo' });
    expect(queryOf(lastGet()).get('reference_date')).toBe('2026-10-28');
  });

  test('cada combinación de período y pestaña viaja tal cual', async () => {
    await getRunnerKpis({ period: 'day', referenceDate: '2026-10-28', tab: 'velocidad_distancia' });
    const query = queryOf(lastGet());
    expect(query.get('period')).toBe('day');
    expect(query.get('tab')).toBe('velocidad_distancia');
  });
});

describe('runner-kpis service — rama de mocks', () => {
  test('con USE_MOCKS delega en mockGetRunnerKpis y no llama a la API', async () => {
    env.USE_MOCKS = true;
    mockGetRunnerKpis.mockResolvedValueOnce({ has_data: true });

    const result = await getRunnerKpis({ period: 'day', referenceDate: '28/10/2026', tab: 'ritmo_continuo' });

    expect(result).toEqual({ has_data: true });
    expect(mockGetRunnerKpis).toHaveBeenCalledWith({
      period: 'day',
      referenceDate: '2026-10-28',
      tab: 'ritmo_continuo',
      callerUserId: 101,
    });
    expect(api.get).not.toHaveBeenCalled();
  });
});
