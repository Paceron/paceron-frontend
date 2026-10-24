const mockCaptured = { current: null, api: null };

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (opts) => {
    mockCaptured.current = opts;
    return mockCaptured.api;
  },
}));

jest.mock('../store/auth-store.js', () => ({
  useAuthStore: (selector) => selector({ activeRole: 'runner' }),
}));

jest.mock('../services/dashboard.js', () => ({
  getDashboardExerciseSeries: jest.fn(),
  DASHBOARD_DEFAULT_PAGE_SIZE: 50,
}));

import { useDashboardSeries } from '../hooks/use-dashboard-series.js';

// El repo no tiene tests de render de componentes (convención del proyecto), así
// que lo que se verifica acá es el CONTRATO de la query: si dispara, con qué
// key, y cuándo deja de pedir páginas. Mockear el useInfiniteQuery es la forma
// de hacerlo sin renderizar.
function callHook(props = {}) {
  const api = {
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    data: { pages: [] },
  };
  mockCaptured.api = api;
  const result = useDashboardSeries({ exerciseId: 7, groupId: 39, ...props });
  return { query: mockCaptured.current, result };
}

describe('useDashboardSeries', () => {
  it('dispara con exerciseId y groupId', () => {
    const { query } = callHook();
    expect(query.enabled).toBe(true);
  });

  it('no dispara sin exerciseId', () => {
    const { query } = callHook({ exerciseId: null });
    expect(query.enabled).toBe(false);
  });

  it('no exige grupo: el endpoint acepta el scope sin group_id', () => {
    const { query } = callHook({ groupId: null });
    expect(query.enabled).toBe(true);
  });

  it('no exige rol de entrenador: el detalle es del corredor que mira su progresión', () => {
    const { query } = callHook();
    expect(query.enabled).toBe(true);
  });

  it('el scope de la key incluye el equipo y el corredor elegido', () => {
    const { query } = callHook({ teamId: 4, athleteUserId: 24 });
    const scopeKey = query.queryKey[3].split('|');
    expect(scopeKey[0]).toBe('4');
    expect(scopeKey[2]).toBe('24');
  });

  it('manda la tolerancia por default en la query key', () => {
    const { query } = callHook();
    expect(query.queryKey.join('|')).toContain('0.05');
  });

  it('respeta una tolerancia explícita', () => {
    const { query } = callHook({ tolerance: 0.1 });
    expect(query.queryKey.join('|')).toContain('0.1');
  });

  it('arma la key por ejercicio, no por tipo', () => {
    const { query } = callHook({ exerciseId: 42 });
    expect(query.queryKey[0]).toBe('dashboard');
    expect(query.queryKey[1]).toBe('series');
    expect(query.queryKey[2]).toBe('42');
  });

  it('pide la siguiente página mientras page * page_size < total', () => {
    const { query } = callHook();
    expect(query.getNextPageParam({ page: 1, page_size: 50, total: 120 })).toBe(2);
  });

  it('termina cuando la última página cerró el total', () => {
    const { query } = callHook();
    expect(query.getNextPageParam({ page: 3, page_size: 50, total: 120 })).toBeUndefined();
  });

  it('no pide página siguiente sin datos', () => {
    const { query } = callHook();
    expect(query.getNextPageParam(undefined)).toBeUndefined();
  });

  it('aplana los items de las páginas y expone axis y has_target', () => {
    const api = {
      isLoading: false, isFetchingNextPage: false, isError: false, error: null,
      hasNextPage: false, fetchNextPage: jest.fn(), refetch: jest.fn(),
      data: {
        pages: [
          { items: [{ feedback_id: 1 }], total: 2, units: { speed: 'km/h' }, axis: 'distance_and_time', has_target: true },
          { items: [{ feedback_id: 2 }] },
        ],
      },
    };
    mockCaptured.api = api;
    const out = useDashboardSeries({ exerciseId: 7, groupId: 39 });
    expect(out.series).toHaveLength(2);
    expect(out.total).toBe(2);
    expect(out.axis).toBe('distance_and_time');
    expect(out.hasTarget).toBe(true);
    expect(out.units).toEqual({ speed: 'km/h' });
  });

  it('devuelve lista vacía y sin total sin datos', () => {
    const { result } = callHook();
    expect(result.series).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.axis).toBeNull();
    expect(result.hasTarget).toBeNull();
  });
});