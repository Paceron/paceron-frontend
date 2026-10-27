const mockCaptured = { query: null, api: null, role: 'trainer' };

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options) => {
    mockCaptured.query = options;
    return mockCaptured.api;
  },
}));

jest.mock('../store/auth-store.js', () => ({
  useAuthStore: (selector) => selector({ activeRole: mockCaptured.role }),
}));

jest.mock('../services/dashboard.js', () => ({
  getDashboardGroupAthletes: jest.fn(async () => [101, 102]),
  postDashboardSessionComparison: jest.fn(async () => ({ a: {}, b: {} })),
}));

import { getDashboardGroupAthletes, postDashboardSessionComparison } from '../services/dashboard.js';
import { useDashboardGroupAthletes, useDashboardSessionComparison } from '../hooks/use-dashboard-session-comparison.js';

function setQueryApi() {
  mockCaptured.api = {
    data: null,
    error: null,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  };
}

const REQUEST = {
  teamId: 4,
  from: '2026-09-01',
  to: '2026-10-01',
  a: { groupId: 41, athleteUserId: 101, sessionInstanceId: 7101, exerciseId: 5 },
  b: { groupId: 42, athleteUserId: 105, sessionInstanceId: 7102, exerciseId: 10 },
};

describe('useDashboardSessionComparison', () => {
  beforeEach(() => {
    mockCaptured.role = 'trainer';
    mockCaptured.query = null;
    setQueryApi();
    getDashboardGroupAthletes.mockClear();
    postDashboardSessionComparison.mockClear();
  });

  test('solo dispara con rango y las dos referencias completas', () => {
    useDashboardSessionComparison(REQUEST);
    expect(mockCaptured.query.enabled).toBe(true);
    expect(mockCaptured.query.queryKey).toEqual([
      'dashboard', 'session-comparison', '4', '2026-09-01', '2026-10-01',
      '41', '101', '7101', '5', '42', '105', '7102', '10',
    ]);
  });

  test('no compara una selección parcial', () => {
    useDashboardSessionComparison({ ...REQUEST, b: null });
    expect(mockCaptured.query.enabled).toBe(false);
  });

  test('espera la acción explícita del comparador aunque A y B estén completos', () => {
    useDashboardSessionComparison({ ...REQUEST, enabled: false });
    expect(mockCaptured.query.enabled).toBe(false);
  });

  test('runner puede consultar y la key distingue ambos atletas/sesiones', () => {
    mockCaptured.role = 'runner';
    useDashboardSessionComparison(REQUEST);
    expect(mockCaptured.query.enabled).toBe(true);
    expect(mockCaptured.query.queryKey[7]).toBe('7101');
    expect(mockCaptured.query.queryKey[11]).toBe('7102');
  });

  test('el queryFn manda ambas referencias al servicio server-side', async () => {
    useDashboardSessionComparison(REQUEST);
    await mockCaptured.query.queryFn();
    expect(postDashboardSessionComparison).toHaveBeenCalledWith(REQUEST);
  });
});

describe('useDashboardGroupAthletes', () => {
  beforeEach(() => {
    mockCaptured.role = 'trainer';
    mockCaptured.query = null;
    setQueryApi();
  });

  test('pide roster por grupo solo para entrenador y grupo válido', async () => {
    useDashboardGroupAthletes({ teamId: 4, groupId: 41 });
    expect(mockCaptured.query.enabled).toBe(true);
    await mockCaptured.query.queryFn();
    expect(getDashboardGroupAthletes).toHaveBeenCalledWith({ teamId: 4, groupId: 41 });
  });

  test('runner no consulta el roster ajeno', () => {
    mockCaptured.role = 'runner';
    useDashboardGroupAthletes({ teamId: 4, groupId: 41 });
    expect(mockCaptured.query.enabled).toBe(false);
  });
});
