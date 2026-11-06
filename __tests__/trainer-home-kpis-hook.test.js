const captured = { options: null, state: null };

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options) => { captured.options = options; return captured.state; },
}));
jest.mock('../store/auth-store.js', () => ({
  useAuthStore: (selector) => selector({ userId: 72 }),
}));
jest.mock('../services/trainer-home-kpis.js', () => ({
  getTrainerHomeKpis: jest.fn(async () => ({ period: 'month' })),
}));

import { getTrainerHomeKpis } from '../services/trainer-home-kpis.js';
import { toTrainerHomeKpisModel } from '../services/normalizers.js';
import { trainerHomeKpisQueryKey, useTrainerHomeKpis } from '../hooks/use-trainer-home-kpis.js';

function callHook(state = {}) {
  captured.state = {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...state,
  };
  return { result: useTrainerHomeKpis({ period: 'week', referenceDate: '2026-11-05' }), query: captured.options };
}

beforeEach(() => getTrainerHomeKpis.mockClear());

test('la key queda scopeada por usuario, período y fecha', () => {
  expect(trainerHomeKpisQueryKey({ userId: 72, period: 'week', referenceDate: '2026-11-05' }))
    .toEqual(['trainer-home-kpis', 72, 'week', '2026-11-05']);
});

test('la query pasa los filtros y normaliza el DTO sin recalcularlo', async () => {
  const { query } = callHook();
  expect(query.queryKey).toEqual(['trainer-home-kpis', 72, 'week', '2026-11-05']);
  const model = await query.queryFn();
  expect(getTrainerHomeKpis).toHaveBeenCalledWith({ period: 'week', referenceDate: '2026-11-05' });
  expect(model).toEqual({
    period: 'month', referenceDate: '', from: '', to: '', daysConsidered: 0,
    sessions: { scheduled: 0, realized: 0, presencialScheduled: 0, presencialRealized: 0 },
    structure: { activeTeams: 0, activeRunners: 0 },
    collections: { currencyId: 'ARS', netCollected: 0, pendingAmount: 0, pendingCount: 0 },
  });
});

test('expone loading inicial y refreshing sin perder los datos previos', () => {
  expect(callHook({ isLoading: true, isFetching: true }).result.loading).toBe(true);
  const oldData = toTrainerHomeKpisModel({ sessions: { scheduled: 1 } });
  const { result } = callHook({ data: oldData, isFetching: true });
  expect(result.loading).toBe(false);
  expect(result.refreshing).toBe(true);
  expect(result.data.sessions.scheduled).toBe(1);
});
