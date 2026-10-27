const env = { USE_MOCKS: false, API_BASE_URL: 'http://localhost:9999/api/v1' };

jest.mock('../config/env.js', () => env);
jest.mock('../services/api.js', () => ({
  __esModule: true,
  default: { get: jest.fn(async () => ({})), post: jest.fn(async () => ({})) },
}));
jest.mock('../services/__mocks__/dashboard-mock.js', () => ({
  mockGetDashboardFilters: jest.fn(async () => ({})),
  mockGetDashboardSummary: jest.fn(async () => ({})),
  mockGetDashboardTimeseries: jest.fn(async () => ({})),
  mockGetDashboardLeaderboard: jest.fn(async () => ({})),
  mockGetDashboardExerciseSeries: jest.fn(async () => ({})),
  mockPostDashboardComparisons: jest.fn(async () => ({})),
  mockPostDashboardPeriods: jest.fn(async () => ({})),
  mockPostDashboardSessionComparison: jest.fn(async () => ({})),
  mockGetDashboardGroupAthletes: jest.fn(async () => []),
}));

// El store de sesión usa SecureStore y el theme provider, que no existen bajo
// Jest — mismo mock que __tests__/auth-store.test.js.
jest.mock('../services/storage.js', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));
jest.mock('../providers/theme-provider.jsx', () => ({ seedDefaultTheme: jest.fn() }));
jest.mock('../lib/query-client.js', () => ({
  queryClient: { clear: jest.fn(), setQueryData: jest.fn(), invalidateQueries: jest.fn() },
}));

import api from '../services/api.js';
import {
  getDashboardFilters,
  getDashboardSummary,
  getDashboardTimeseries,
  getDashboardLeaderboard,
  getDashboardExerciseSeries,
  postDashboardComparisons,
  postDashboardPeriods,
  postDashboardSessionComparison,
  getDashboardGroupAthletes,
} from '../services/dashboard.js';
import {
  mockGetDashboardSummary,
  mockPostDashboardPeriods,
} from '../services/__mocks__/dashboard-mock.js';
import { useAuthStore } from '../store/auth-store.js';

// La capa de datos tiene una sola responsabilidad observable: qué viaja en la
// request. Todo lo que el backend valida (whitelists, rangos, formato de fecha)
// NO se reimplementa acá — se manda y su 400 con code estable es lo que la
// pantalla necesita para pintar el estado de validación.

const RANGE = { from: '01/09/2026', to: '13/10/2026' };

function lastGet() {
  return api.get.mock.calls[api.get.mock.calls.length - 1][0];
}

function queryOf(url) {
  const [, search = ''] = url.split('?');
  return new URLSearchParams(search);
}

beforeEach(() => {
  env.USE_MOCKS = false;
  api.get.mockClear();
  api.post.mockClear();
  useAuthStore.setState({ userId: 1 });
});

describe('dashboard service — query string', () => {
  test('el resumen manda team_id, fechas normalizadas a ISO y la tolerancia explícita', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE });
    expect(lastGet()).toBe('/dashboard/metrics/summary?team_id=4&from=2026-09-01&to=2026-10-13&tolerance=0.05');
  });

  test('sin `from` NO se inventa uno: el 400 MISSING_FROM es un estado de la pantalla', async () => {
    await getDashboardSummary({ teamId: 4, to: RANGE.to });
    expect(queryOf(lastGet()).has('from')).toBe(false);
  });

  test('el tipo viaja como `kind` escalar, y con ejercicio elegido no viaja', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE, kind: 'ritmo_continuo' });
    expect(queryOf(lastGet()).get('kind')).toBe('ritmo_continuo');
    await getDashboardSummary({ teamId: 4, ...RANGE, kind: '', exerciseId: 5 });
    const query = queryOf(lastGet());
    expect(query.get('exercise_id')).toBe('5');
    expect(query.has('kind')).toBe(false);
  });

  test('los rangos viajan en la unidad del contrato: metros y minutos enteros', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE, distanceFromM: 3500, distanceToM: 21000, timeFromMin: 30, timeToMin: 90 });
    const query = queryOf(lastGet());
    expect(query.get('distance_from_m')).toBe('3500');
    expect(query.get('distance_to_m')).toBe('21000');
    expect(query.get('time_from_min')).toBe('30');
    expect(query.get('time_to_min')).toBe('90');
  });

  test('un rango que no es un entero no viaja: mejor sin filtro que con un 400', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE, distanceFromM: 3500.5, timeFromMin: -3 });
    const query = queryOf(lastGet());
    expect(query.has('distance_from_m')).toBe(false);
    expect(query.has('time_from_min')).toBe(false);
  });

  test('exercise_ids[] viaja como parámetro repetido, no como CSV', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE, exerciseIds: [3, 5] });
    const url = lastGet();
    // El backend lo lee con c.QueryArray, que no separa comas: "3,5" llegaría
    // como un único string y no matchearía nada.
    expect(url).toContain('exercise_ids=3&exercise_ids=5');
    expect(url).not.toContain('exercise_ids=3%2C');
    expect(queryOf(url).getAll('exercise_ids')).toEqual(['3', '5']);
  });

  test('el corredor del scope viaja como athlete_user_id en los cuatro GET', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE, athleteUserId: '24' });
    expect(queryOf(lastGet()).get('athlete_user_id')).toBe('24');

    await getDashboardTimeseries({ teamId: 4, ...RANGE, athleteUserId: 24 });
    expect(queryOf(lastGet()).get('athlete_user_id')).toBe('24');

    await getDashboardLeaderboard({ teamId: 4, ...RANGE, athleteUserId: 24 });
    expect(queryOf(lastGet()).get('athlete_user_id')).toBe('24');

    await getDashboardExerciseSeries({ exerciseId: 5, teamId: 4, ...RANGE, athleteUserId: 24 });
    expect(queryOf(lastGet()).get('athlete_user_id')).toBe('24');
  });

  test('los filtros vacíos no van: group_id, athlete_user_id, exercise_id vacío ni listas vacías', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE, groupId: '', athleteUserId: '', exerciseId: null, exerciseIds: [], kind: '' });
    const query = queryOf(lastGet());
    expect(query.has('group_id')).toBe(false);
    expect(query.has('athlete_user_id')).toBe(false);
    expect(query.has('exercise_id')).toBe(false);
    expect(query.has('exercise_ids')).toBe(false);
    expect(query.has('kind')).toBe(false);
    expect(query.has('distance_from_m')).toBe(false);
  });

  test('la tolerancia se manda siempre, y fuera de rango vuelve a la default', async () => {
    await getDashboardSummary({ teamId: 4, ...RANGE, tolerance: 0.12 });
    expect(queryOf(lastGet()).get('tolerance')).toBe('0.12');
    await getDashboardSummary({ teamId: 4, ...RANGE, tolerance: 0.9 });
    expect(queryOf(lastGet()).get('tolerance')).toBe('0.05');
  });

  test('la granularidad solo va en el timeseries', async () => {
    await getDashboardTimeseries({ teamId: 4, ...RANGE, granularity: 'week' });
    expect(queryOf(lastGet()).get('granularity')).toBe('week');
    expect(lastGet()).toContain('/dashboard/metrics/timeseries');
  });

  test('el leaderboard manda page, page_size, sort y order', async () => {
    await getDashboardLeaderboard({ teamId: 4, ...RANGE, page: 2, pageSize: 50, sort: 'mean_speed_kph', order: 'desc' });
    const query = queryOf(lastGet());
    expect(lastGet()).toContain('/dashboard/leaderboard');
    expect(query.get('page')).toBe('2');
    expect(query.get('page_size')).toBe('50');
    expect(query.get('sort')).toBe('mean_speed_kph');
    expect(query.get('order')).toBe('desc');
  });

  test('el detalle por serie lleva el id en el path, no en la query', async () => {
    await getDashboardExerciseSeries({ exerciseId: 5, teamId: 4, ...RANGE, page: 1, pageSize: 20 });
    const url = lastGet();
    expect(url).toContain('/dashboard/exercises/5/series');
    expect(url).not.toContain('exercise_id=5');
    const query = queryOf(url);
    expect(query.get('page')).toBe('1');
    expect(query.get('page_size')).toBe('20');
  });

  test('los filtros solo aceptan team_id', async () => {
    await getDashboardFilters({ teamId: 4 });
    expect(lastGet()).toBe('/dashboard/filters?team_id=4');
  });
});

describe('dashboard service — cuerpos de los POST', () => {
  test('los ids numéricos viajan como números: Go no bindea "4" en un int64', async () => {
    await postDashboardComparisons({ teamId: '4', groupId: '41', ...RANGE, athleteUserIds: ['101', 105] });
    const [, body] = api.post.mock.calls[0];
    expect(api.post.mock.calls[0][0]).toBe('/dashboard/comparisons');
    expect(body.team_id).toBe(4);
    expect(body.group_id).toBe(41);
    expect(body.athlete_user_ids).toEqual([101, 105]);
    expect(body.from).toBe('2026-09-01');
    expect(body.to).toBe('2026-10-13');
    expect(body.tolerance).toBe(0.05);
  });

  test('sin athlete_user_ids no se manda la lista: el backend compara a todo el scope', async () => {
    await postDashboardComparisons({ teamId: 4, ...RANGE, athleteUserIds: [] });
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('athlete_user_ids');
  });

  test('los POST llevan los cuatro de rango con el nombre del contrato', async () => {
    await postDashboardComparisons({ teamId: 4, ...RANGE, kind: 'ritmo_continuo', distanceFromM: 5000, timeToMin: 45 });
    const body = api.post.mock.calls[0][1];
    expect(body.kind).toBe('ritmo_continuo');
    expect(body.distance_from_m).toBe(5000);
    expect(body.time_to_min).toBe(45);
    expect(body).not.toHaveProperty('distance_to_m');
    expect(body).not.toHaveProperty('time_from_min');
  });

  test('los períodos van como current/previous en ISO, y previous es opcional', async () => {
    await postDashboardPeriods({
      teamId: 4,
      current: { from: '15/09/2026', to: '13/10/2026' },
      previous: { from: '16/08/2026', to: '14/09/2026' },
    });
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe('/dashboard/comparisons/periods');
    expect(body.current).toEqual({ from: '2026-09-15', to: '2026-10-13' });
    expect(body.previous).toEqual({ from: '2026-08-16', to: '2026-09-14' });

    api.post.mockClear();
    await postDashboardPeriods({ teamId: 4, current: { from: '15/09/2026', to: '13/10/2026' } });
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('previous');
  });

  test('/comparisons/periods no manda from/to sueltos: los períodos van en `current`', async () => {
    await postDashboardPeriods({ teamId: 4, current: { from: '15/09/2026', to: '13/10/2026' }, ...RANGE });
    const body = api.post.mock.calls[0][1];
    expect(body.current.from).toBe('2026-09-15');
    expect(body.from).toBeUndefined();
    expect(body.to).toBeUndefined();
  });

  test('la comparación de sesiones manda ambas referencias completas y fechas ISO', async () => {
    await postDashboardSessionComparison({
      teamId: '4',
      from: '15/09/2026',
      to: '13/10/2026',
      a: { groupId: '41', athleteUserId: '101', sessionInstanceId: '7100', exerciseId: '5' },
      b: { groupId: 42, athleteUserId: 105, sessionInstanceId: 7101, exerciseId: 8 },
    });

    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe('/dashboard/comparisons/sessions');
    expect(body).toEqual({
      team_id: 4,
      from: '2026-09-15',
      to: '2026-10-13',
      a: { group_id: 41, athlete_user_id: 101, session_instance_id: 7100, exercise_id: 5 },
      b: { group_id: 42, athlete_user_id: 105, session_instance_id: 7101, exercise_id: 8 },
    });
    expect(body).not.toHaveProperty('distance_from_m');
    expect(body).not.toHaveProperty('time_to_min');
  });

  test('el roster del grupo usa el endpoint existente y devuelve solo sus ids', async () => {
    api.get.mockResolvedValueOnce([{ user_id: 101 }, { user_id: 102 }]);
    await getDashboardGroupAthletes({ teamId: 4, groupId: 41 });
    expect(lastGet()).toBe('/groups/41/users');
  });
});

describe('dashboard service — rama de mocks', () => {
  test('el mock recibe los MISMOS valores normalizados que se mandarían por wire', async () => {
    env.USE_MOCKS = true;
    await getDashboardSummary({
      teamId: '4',
      groupId: '41',
      from: '01/09/2026',
      kind: 'ritmo_continuo',
      distanceFromM: 3500,
      tolerance: 0.4,
    });
    expect(api.get).not.toHaveBeenCalled();
    expect(mockGetDashboardSummary).toHaveBeenCalledWith({
      teamId: 4,
      groupId: 41,
      athleteUserId: null,
      exerciseId: null,
      exerciseIds: [],
      kind: 'ritmo_continuo',
      distanceFromM: 3500,
      distanceToM: null,
      timeFromMin: null,
      timeToMin: null,
      from: '2026-09-01',
      to: '',
      tolerance: 0.05,
      callerUserId: 1,
    });
  });

  test('el mock recibe los períodos ya normalizados a ISO', async () => {
    env.USE_MOCKS = true;
    await postDashboardPeriods({ teamId: 4, current: { from: '15/09/2026', to: '13/10/2026' } });
    expect(mockPostDashboardPeriods).toHaveBeenCalledWith(expect.objectContaining({
      current: { from: '2026-09-15', to: '2026-10-13' },
      previous: null,
      callerUserId: 1,
    }));
  });

  test('el id del llamador sale del store: es lo que reproduce el 403 de scope', async () => {
    env.USE_MOCKS = true;
    useAuthStore.setState({ userId: 101 });
    await getDashboardSummary({ teamId: 4, ...RANGE });
    expect(mockGetDashboardSummary).toHaveBeenLastCalledWith(expect.objectContaining({ callerUserId: 101 }));
    useAuthStore.setState({ userId: null });
    await getDashboardSummary({ teamId: 4, ...RANGE });
    expect(mockGetDashboardSummary).toHaveBeenLastCalledWith(expect.objectContaining({ callerUserId: null }));
  });
});
