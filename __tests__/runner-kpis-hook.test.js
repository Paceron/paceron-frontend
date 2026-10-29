const mockCaptured = { current: null, api: null };

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options) => {
    mockCaptured.current = options;
    return mockCaptured.api;
  },
  keepPreviousData: (value) => value,
}));

jest.mock('../services/runner-kpis.js', () => ({
  getRunnerKpis: jest.fn(async () => ({ has_data: true })),
}));

import { getRunnerKpis } from '../services/runner-kpis.js';
import { useRunnerKpis } from '../hooks/use-runner-kpis.js';

// El repo no tiene tests de render (convención del proyecto): lo que se verifica
// es el CONTRATO de la query, capturando las opciones que recibe useQuery.
function callHook(props = {}, state = {}) {
  const api = {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...state,
  };
  mockCaptured.api = api;
  const result = useRunnerKpis({ period: 'month', referenceDate: '2026-10-28', tab: 'general', ...props });
  return { query: mockCaptured.current, result, api };
}

beforeEach(() => {
  getRunnerKpis.mockClear();
});

describe('useRunnerKpis — contrato de la consulta', () => {
  test('usa la key con prefijo runner-kpis y los tres parámetros', () => {
    const { query } = callHook();
    expect(query.queryKey).toEqual(['runner-kpis', 'month', '2026-10-28', 'general']);
  });

  test('cambiar período, fecha o pestaña produce otra key', () => {
    const { query } = callHook();
    const base = query.queryKey.join('|');
    expect(callHook({ period: 'week' }).query.queryKey.join('|')).not.toBe(base);
    expect(callHook({ referenceDate: '2026-10-27' }).query.queryKey.join('|')).not.toBe(base);
    expect(callHook({ tab: 'ritmo_continuo' }).query.queryKey.join('|')).not.toBe(base);
  });

  test('staleTime 0 para revalidar al volver a una pestaña cacheada', () => {
    const { query } = callHook();
    expect(query.staleTime).toBe(0);
  });

  test('reintenta red/5xx pero no un 400', () => {
    const { query } = callHook();
    expect(typeof query.retry).toBe('function');
    expect(query.retry(0, { status: 500 })).toBe(true);
    expect(query.retry(0, { status: 400 })).toBe(false);
  });

  test('NO usa keepPreviousData entre pestañas', () => {
    const { query } = callHook();
    expect(query.placeholderData).toBeUndefined();
  });

  test('no sondea ni prefetchea: sin refetchInterval y habilitada por default', () => {
    const { query } = callHook();
    expect(query.refetchInterval).toBeUndefined();
    expect(query.enabled).not.toBe(false);
  });

  test('la queryFn llama al servicio con los mismos parámetros de la key', async () => {
    const { query } = callHook({ period: 'day', referenceDate: '2026-10-28', tab: 'velocidad_tiempo' });
    await query.queryFn();
    expect(getRunnerKpis).toHaveBeenCalledWith({
      period: 'day',
      referenceDate: '2026-10-28',
      tab: 'velocidad_tiempo',
    });
  });
});

describe('useRunnerKpis — estados expuestos', () => {
  test('primera carga: loading true y refreshing false', () => {
    const { result } = callHook({}, { isLoading: true, isFetching: true });
    expect(result.loading).toBe(true);
    expect(result.refreshing).toBe(false);
  });

  test('revalidación con datos: loading false y refreshing true', () => {
    const { result } = callHook({}, { data: { has_data: true }, isFetching: true });
    expect(result.loading).toBe(false);
    expect(result.refreshing).toBe(true);
  });

  test('expone data, failed, error y refetch', () => {
    const error = new Error('sin red');
    const { result, api } = callHook({}, {
      data: { has_data: false },
      isError: true,
      error,
    });
    expect(result.data).toEqual({ has_data: false });
    expect(result.failed).toBe(true);
    expect(result.error).toBe(error);
    result.refetch();
    expect(api.refetch).toHaveBeenCalled();
  });

  test('sin data devuelve null, no undefined', () => {
    const { result } = callHook();
    expect(result.data).toBeNull();
  });
});
