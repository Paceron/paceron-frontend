import { mockGetRunnerKpis } from '../services/__mocks__/runner-kpis-mock.js';
import { __getMockDashboardSeed, __resetMockDashboard, __setMockDashboardToday } from '../services/__mocks__/dashboard-mock.js';

// El mock del Home es una vista del mismo seed del dashboard. Este test lo
// verifica desde afuera: recalcula los valores esperados con las filas crudas y
// compara contra la respuesta, para que una agregación rota no quede invisible.
const TODAY = '2026-10-28';
const RUNNER_CON_RITMO = 101; // equipo General: ritmo_continuo + liviano + elongación
const RUNNER_CON_VELOCIDAD = 104; // equipo Avanzado: velocidad_distancia + velocidad_tiempo

const EMPTY_METRICS = {
  total_distance_m: null,
  best_day_distance_m: null,
  best_day_date: null,
  average_speed_kph: null,
  best_speed_kph: null,
  best_time_ms: null,
  best_distance_m: null,
};

beforeEach(() => __setMockDashboardToday(TODAY));
afterEach(() => __resetMockDashboard());

function achievedTime(row) {
  if (row.active_duration_ms > 0) return row.active_duration_ms;
  return row.duration_ms > 0 ? row.duration_ms : 0;
}

function distanceOf(row) {
  return typeof row.distance_meters === 'number' && row.distance_meters > 0 ? row.distance_meters : null;
}

function isValid(row) {
  switch (row.kind) {
    case 'liviano':
      return achievedTime(row) > 0 || distanceOf(row) !== null;
    case 'elongacion':
    case 'velocidad_tiempo':
      return achievedTime(row) > 0;
    case 'ritmo_continuo':
      return achievedTime(row) > 0 && distanceOf(row) !== null;
    case 'velocidad_distancia':
      return distanceOf(row) !== null;
    default:
      return false;
  }
}

function speedOf(row) {
  const distance = distanceOf(row);
  const time = achievedTime(row);
  if (distance === null || !(time > 0)) return null;
  return distance / 1000 / (time / 3_600_000);
}

function rowsOf(athleteId, from, to, kind = null) {
  return __getMockDashboardSeed().series.filter((row) => (
    row.athlete_user_id === athleteId
    && row.session_date >= from
    && row.session_date <= to
    && (kind === null || row.kind === kind)
  ));
}

function validOf(rows) {
  return rows.filter(isValid);
}

function speedsOf(rows) {
  return rows.map(speedOf).filter((speed) => speed !== null);
}

// Misma media ponderada por distancia que el backend y el mock.
function weightedSpeed(rows) {
  let weight = 0;
  let weighted = 0;
  rows.forEach((row) => {
    const distance = distanceOf(row);
    const speed = speedOf(row);
    if (distance === null || speed === null) return;
    weight += distance;
    weighted += distance * speed;
  });
  return weight > 0 ? weighted / weight : null;
}

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };

describe('runner-kpis mock — período y contrato', () => {
  test('el mes usa el calendario del backend y devuelve los días considerados', async () => {
    const result = await mockGetRunnerKpis({
      period: 'month',
      referenceDate: TODAY,
      tab: 'general',
      callerUserId: RUNNER_CON_RITMO,
    });

    expect(result).toMatchObject({
      period: 'month',
      reference_date: TODAY,
      from: '2026-10-01',
      to: '2026-10-31',
      days_considered: 31,
      tab: 'general',
      has_data: true,
    });
    expect(result.units).toEqual({ distance: 'm', speed: 'km/h', time: 'ms' });
  });

  test('la semana va de lunes a domingo, aunque cruce de mes', async () => {
    const result = await mockGetRunnerKpis({
      period: 'week',
      referenceDate: TODAY,
      tab: 'general',
      callerUserId: RUNNER_CON_RITMO,
    });

    expect(result.from).toBe('2026-10-26');
    expect(result.to).toBe('2026-11-01');
    expect(result.days_considered).toBe(7);
  });

  test('el día es la fecha de referencia y un solo día considerado', async () => {
    const result = await mockGetRunnerKpis({
      period: 'day',
      referenceDate: TODAY,
      tab: 'general',
      callerUserId: RUNNER_CON_RITMO,
    });

    expect(result.from).toBe(TODAY);
    expect(result.to).toBe(TODAY);
    expect(result.days_considered).toBe(1);
  });
});

describe('runner-kpis mock — métricas del corredor', () => {
  test('general agrega las series propias y no las de otro corredor', async () => {
    const rows = rowsOf(RUNNER_CON_RITMO, OCTOBER.from, OCTOBER.to);
    const valid = validOf(rows);
    const expectedDistance = rows.reduce((sum, row) => sum + (distanceOf(row) ?? 0), 0);
    const expectedBestSpeed = Math.max(...speedsOf(rows));

    const result = await mockGetRunnerKpis({
      period: 'month',
      referenceDate: TODAY,
      tab: 'general',
      callerUserId: RUNNER_CON_RITMO,
    });

    expect(result.has_data).toBe(true);
    expect(result.series_count).toBe(rows.length);
    expect(result.valid_series).toBe(valid.length);
    expect(result.metrics.total_distance_m).toBeCloseTo(expectedDistance, 6);
    expect(result.metrics.best_speed_kph).toBeCloseTo(expectedBestSpeed, 6);
    expect(result.metrics.best_day_date).not.toBeNull();
    expect(result.metrics.best_speed_kph).not.toBeNull();
  });

  test('el promedio de general sale SOLO de ritmo continuo y pondera por distancia', async () => {
    const ritmoRows = rowsOf(RUNNER_CON_RITMO, OCTOBER.from, OCTOBER.to, 'ritmo_continuo');
    const expected = weightedSpeed(ritmoRows);
    const simple = speedsOf(ritmoRows).reduce((sum, speed) => sum + speed, 0) / speedsOf(ritmoRows).length;

    const result = await mockGetRunnerKpis({
      period: 'month',
      referenceDate: TODAY,
      tab: 'general',
      callerUserId: RUNNER_CON_RITMO,
    });

    expect(result.metrics.average_speed_kph).toBeCloseTo(expected, 6);
    if (expected !== simple) {
      expect(result.metrics.average_speed_kph).not.toBeCloseTo(simple, 6);
    }
  });

  test('ritmo_continuo no devuelve las métricas de velocidad de otras pestañas', async () => {
    const result = await mockGetRunnerKpis({
      period: 'month',
      referenceDate: TODAY,
      tab: 'ritmo_continuo',
      callerUserId: RUNNER_CON_VELOCIDAD,
    });

    // 104 solo tiene sesiones de velocidad: en la pestaña de ritmo no hay filas.
    expect(result.has_data).toBe(false);
    expect(result.metrics).toEqual(EMPTY_METRICS);
    expect(result.series_count).toBe(0);
    expect(result.valid_series).toBe(0);
  });

  test('velocidad en tiempo trae mejor tiempo y no inventa distancia ni velocidad', async () => {
    const rows = rowsOf(RUNNER_CON_VELOCIDAD, OCTOBER.from, OCTOBER.to, 'velocidad_tiempo');
    const expectedBestTime = Math.min(...validOf(rows).map(achievedTime).filter((time) => time > 0));

    const result = await mockGetRunnerKpis({
      period: 'month',
      referenceDate: TODAY,
      tab: 'velocidad_tiempo',
      callerUserId: RUNNER_CON_VELOCIDAD,
    });

    expect(result.has_data).toBe(true);
    expect(result.metrics.best_time_ms).toBe(expectedBestTime);
    expect(result.metrics.total_distance_m).toBeNull();
    expect(result.metrics.average_speed_kph).toBeNull();
  });

  test('velocidad en distancia trae velocidad y distancia en km/h y m', async () => {
    const rows = rowsOf(RUNNER_CON_VELOCIDAD, OCTOBER.from, OCTOBER.to, 'velocidad_distancia');
    const expectedBestSpeed = Math.max(...speedsOf(rows));

    const result = await mockGetRunnerKpis({
      period: 'month',
      referenceDate: TODAY,
      tab: 'velocidad_distancia',
      callerUserId: RUNNER_CON_VELOCIDAD,
    });

    expect(result.has_data).toBe(true);
    expect(result.metrics.best_speed_kph).toBeCloseTo(expectedBestSpeed, 6);
    expect(result.metrics.total_distance_m).toBeGreaterThan(0);
  });
});

describe('runner-kpis mock — estados sin datos', () => {
  test('un usuario sin filas devuelve has_data=false y métricas null, sin inventar cero', async () => {
    const result = await mockGetRunnerKpis({
      period: 'month',
      referenceDate: TODAY,
      tab: 'general',
      callerUserId: 999,
    });

    expect(result.has_data).toBe(false);
    expect(result.series_count).toBe(0);
    expect(result.valid_series).toBe(0);
    expect(result.sessions).toBe(0);
    expect(result.metrics).toEqual(EMPTY_METRICS);
  });

  test('el día de hoy no tiene series cerradas para 101: es un vacío válido', async () => {
    const result = await mockGetRunnerKpis({
      period: 'day',
      referenceDate: TODAY,
      tab: 'general',
      callerUserId: RUNNER_CON_RITMO,
    });

    expect(result.has_data).toBe(false);
    expect(result.metrics).toEqual(EMPTY_METRICS);
  });
});
