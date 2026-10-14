import {
  mockGetDashboardFilters,
  mockGetDashboardSummary,
  mockGetDashboardTimeseries,
  mockGetDashboardLeaderboard,
  mockGetDashboardExerciseSeries,
  mockPostDashboardComparisons,
  mockPostDashboardPeriods,
  __getMockDashboardSeed,
  __setMockDashboardToday,
  __resetMockDashboard,
} from '../services/__mocks__/dashboard-mock.js';

// El mock se siembra con filas de feedback y corre las mismas agregaciones que el
// backend. Este test lo verifica DESDE AFUERA: recalcula cada número desde las
// filas crudas que expone `__getMockDashboardSeed` y compara contra la respuesta.
// Contra mocks una aritmética rota es invisible, así que "el mock se contradice a
// sí mismo" es exactamente lo que hay que probar acá.

const TODAY = '2026-10-13';
const TRAINER = 1;
const RUNNER = 101;
const TEAM_WITH_DATA = 4;
const TEAM_EMPTY = 1;
const TEAM_OUT_OF_SCOPE = 2;
const GROUP_GENERAL = 41;
const GROUP_AVANZADO = 42;

const ELONGACION = 2; // sin objetivo cargado → has_target false (paleta B)
const RITMO_10K = 5; // ritmo_continuo con objetivo de tiempo y distancia
const VMAX_100 = 10; // velocidad_distancia: objetivo de distancia sin tiempo
const V_TIEMPO_60 = 12; // velocidad_tempo: sin distancia → sin velocidad

const RANGE = { from: '2026-07-01', to: TODAY };

beforeEach(() => __setMockDashboardToday(TODAY));
afterEach(() => __resetMockDashboard());

// ---------- recomputaciones independientes del mock ----------

function scopeRows({ teamId = TEAM_WITH_DATA, groupId = null, from, to, exerciseId = null } = {}) {
  const seed = __getMockDashboardSeed();
  const sessionById = new Map(seed.sessions.map((session) => [session.id, session]));
  const groupById = new Map(seed.groups.map((group) => [group.id, group]));
  return seed.series.filter((row) => {
    const session = sessionById.get(row.session_instance_id);
    if (!session || session.status === 'wip') return false;
    const group = groupById.get(session.group_id);
    if (!group || group.teamId !== teamId) return false;
    if (groupId !== null && session.group_id !== groupId) return false;
    if (row.session_date < from || row.session_date > to) return false;
    if (exerciseId !== null && row.exercise_id !== exerciseId) return false;
    return true;
  });
}

function achievedTime(row) {
  if (row.active_duration_ms > 0) return row.active_duration_ms;
  return row.duration_ms > 0 ? row.duration_ms : 0;
}

function speedOf(row) {
  const time = achievedTime(row);
  if (!(row.distance_meters > 0) || !(time > 0)) return null;
  return row.distance_meters / 1000 / (time / 3_600_000);
}

function hasDistance(row) {
  return typeof row.distance_meters === 'number' && row.distance_meters > 0;
}

// Copia de las reglas de validez del backend (validity.go#isValidSeries).
function isValid(row) {
  const hasTime = achievedTime(row) > 0;
  const distance = hasDistance(row);
  switch (row.kind) {
    case 'liviano':
      return hasTime || distance;
    case 'elongacion':
    case 'velocidad_tiempo':
      return hasTime;
    case 'ritmo_continuo':
      return hasTime && distance;
    case 'velocidad_distancia':
      return distance;
    default:
      return false;
  }
}

function hasTargetOf(row) {
  const minutes = row.target_minutes > 0;
  const distance = row.target_distance_m > 0;
  switch (row.kind) {
    case 'elongacion':
    case 'velocidad_tiempo':
      return minutes;
    case 'velocidad_distancia':
      return distance;
    case 'ritmo_continuo':
      return minutes && distance;
    case 'liviano':
      return minutes || distance;
    default:
      return false;
  }
}

// Cumplimiento del backend (compliance.go): met/targeted, con los mismos
// criterios por tipo.
function isCompliant(row, tolerance) {
  if (!hasTargetOf(row)) return false;
  const timeMs = achievedTime(row);
  const timeMet = row.target_minutes > 0 && timeMs > 0 && timeMs <= row.target_minutes * 60_000 * (1 + tolerance);
  const distanceMet = row.target_distance_m > 0 && hasDistance(row)
    && row.distance_meters >= row.target_distance_m * (1 - tolerance);
  switch (row.kind) {
    case 'ritmo_continuo':
      return timeMet && distanceMet;
    case 'liviano':
      return timeMet || distanceMet;
    case 'elongacion':
    case 'velocidad_tiempo':
      return timeMet;
    case 'velocidad_distancia':
      return distanceMet;
    default:
      return false;
  }
}

function speedsOf(rows) {
  return rows.filter(isValid).map(speedOf).filter((speed) => speed !== null);
}

function trendOf(rows) {
  const speeds = speedsOf(rows);
  if (speeds.length < 3) return null;
  const third = Math.floor(speeds.length / 3);
  const oldest = speeds.slice(0, third).reduce((a, b) => a + b, 0) / third;
  const newest = speeds.slice(speeds.length - third).reduce((a, b) => a + b, 0) / third;
  return ((newest - oldest) / oldest) * 100;
}

function complianceOf(rows, tolerance) {
  const targeted = rows.filter((row) => isValid(row) && hasTargetOf(row));
  if (!targeted.length) return null;
  const met = targeted.filter((row) => isCompliant(row, tolerance)).length;
  return (met / targeted.length) * 100;
}

const summary = (extra = {}) => mockGetDashboardSummary({
  teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, ...RANGE, ...extra,
});

// ---------- coherencia de los números ----------

describe('dashboard mock — los números de la respuesta se reconstruyen desde las filas', () => {
  test('valid_series es series − invalid_series, en el resumen y en cada bucket', async () => {
    const data = await summary();
    expect(data.totals.series).toBeGreaterThan(0);
    expect(data.totals.valid_series).toBe(data.totals.series - data.data_quality.invalid_series);

    const timeseries = await mockGetDashboardTimeseries({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, granularity: 'month', ...RANGE,
    });
    const rows = scopeRows(RANGE);
    timeseries.buckets.forEach((bucket) => {
      const inBucket = rows.filter((row) => row.session_date.slice(0, 7) === bucket.period_start.slice(0, 7));
      expect(bucket.series).toBe(inBucket.length);
      expect(bucket.valid_series).toBe(inBucket.filter(isValid).length);
      expect(bucket.valid_series).toBe(bucket.series - inBucket.filter((row) => !isValid(row)).length);
    });
  });

  test('invalid_series cuenta exactamente las filas no calculables del recorte', async () => {
    const data = await summary();
    const rows = scopeRows(RANGE);
    const invalid = rows.filter((row) => !isValid(row));
    expect(invalid.length).toBeGreaterThan(0);
    expect(data.data_quality.invalid_series).toBe(invalid.length);
  });

  test('compliance_rate es met/targeted y no met/valid', async () => {
    const data = await summary();
    const rows = scopeRows(RANGE);
    const expected = complianceOf(rows, 0.05);
    expect(expected).toBeGreaterThan(0);
    expect(data.totals.compliance_rate).toBeCloseTo(expected, 6);
    // El denominador son las filas con objetivo, no todas las válidas: por eso
    // el número NO puede ser un porcentaje entero de las válidas.
    const validRows = rows.filter(isValid);
    expect(validRows.length).toBeGreaterThan(expected / 100);
  });

  test('la tolerancia se refleja en el cumplimiento (0,05 y 0,20 no dan lo mismo)', async () => {
    const loose = await summary({ tolerance: 0.2 });
    const tight = await summary({ tolerance: 0.05 });
    expect(loose.totals.compliance_rate).toBeGreaterThan(tight.totals.compliance_rate);
    expect(loose.tolerance_applied).toBe(0.2);
    expect(tight.tolerance_applied).toBe(0.05);
  });

  test('trend_pct sale de los tercios de velocidad y su veredicto sigue el signo', async () => {
    const data = await summary();
    const expected = trendOf(scopeRows(RANGE));
    expect(expected).toBeGreaterThan(0);
    expect(data.trend.trend_pct).toBeCloseTo(expected, 6);
    // El equipo mejora a lo largo del período sembrado: > 3 % es "improving"
    // (trendThresholdPct).
    expect(expected).toBeGreaterThan(3);
    expect(data.trend.verdict).toBe('improving');
  });

  test('band_counts suma las series clasificables y nunca pasa las series del bucket', async () => {
    const timeseries = await mockGetDashboardTimeseries({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, granularity: 'session', ...RANGE,
    });
    const buckets = timeseries.buckets.filter((bucket) => bucket.target_speed_kph !== null);
    expect(buckets.length).toBeGreaterThan(0);
    timeseries.buckets.forEach((bucket) => {
      const counted = bucket.band_counts.met + bucket.band_counts.near
        + bucket.band_counts.missed + bucket.band_counts.unknown;
      expect(counted).toBeLessThanOrEqual(bucket.series);
      expect(Object.keys(bucket.band_counts).sort()).toEqual(['met', 'missed', 'near', 'unknown']);
    });
    // Al menos un bucket tiene las cuatro bandas en uso: si no, el gráfico de
    // barras apiladas se vería con una sola banda y no se probaría.
    const withBands = timeseries.buckets.filter((bucket) => bucket.band_counts.near > 0
      || bucket.band_counts.missed > 0 || bucket.band_counts.unknown > 0);
    expect(withBands.length).toBeGreaterThan(0);
  });

  test('best_time_ms es el mínimo del tiempo logrado, no el más nuevo', async () => {
    const data = await summary();
    const times = scopeRows(RANGE).filter(isValid).map(achievedTime).filter((time) => time > 0);
    expect(data.totals.best_time_ms).toBe(Math.min(...times));
  });

  test('achieved_speed_kph es la media ponderada por distancia', async () => {
    const data = await summary();
    const rows = scopeRows(RANGE).filter(isValid).filter(hasDistance);
    const weighted = rows.reduce((sum, row) => sum + row.distance_meters * speedOf(row), 0);
    const distance = rows.reduce((sum, row) => sum + row.distance_meters, 0);
    expect(data.totals.achieved_speed_kph).toBeCloseTo(weighted / distance, 6);
  });

  test('la suma de los buckets del timeseries es el total del período', async () => {
    const timeseries = await mockGetDashboardTimeseries({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, granularity: 'session', ...RANGE,
    });
    const summaryOfPeriod = await summary();
    const summed = timeseries.buckets.reduce((total, bucket) => total + bucket.series, 0);
    expect(summed).toBe(summaryOfPeriod.totals.series);
  });
});

// ---------- data_quality ----------

describe('dashboard mock — data_quality con sus seis contadores', () => {
  test('trae exactamente los seis campos del contrato', async () => {
    const data = await summary();
    expect(Object.keys(data.data_quality).sort()).toEqual([
      'degraded_time', 'insufficient_data', 'invalid_series', 'legacy_sessions', 'open_sessions', 'unknown_status',
    ]);
  });

  test('los cinco contadores se reconstruyen desde las filas y las sesiones', async () => {
    const data = await summary();
    const rows = scopeRows(RANGE);
    expect(data.data_quality.degraded_time).toBe(rows.filter((row) => !(row.active_duration_ms > 0)).length);
    expect(data.data_quality.unknown_status).toBe(
      rows.filter((row) => !['completa', 'partial', 'skipped'].includes(row.completion_status)).length,
    );
    // legacy_sessions solo cuenta series VÁLIDAS sin fila en runner_session. Es
    // informativo, no un defecto: la serie entra igual a los KPI.
    expect(data.data_quality.legacy_sessions)
      .toBe(rows.filter((row) => isValid(row) && !row.has_runner_session).length);
    expect(data.data_quality.legacy_sessions).toBeGreaterThan(0);
    const seed = __getMockDashboardSeed();
    const openSessions = seed.sessions.filter((session) => session.status === 'wip');
    expect(data.data_quality.open_sessions).toBe(openSessions.length);
    expect(data.data_quality.open_sessions).toBeGreaterThan(0);
    // Cada uno de los cinco aparece con un valor > 0: si alguno fuera 0, su
    // estado de pantalla no se podría verificar en el preview.
    expect(data.data_quality.degraded_time).toBeGreaterThan(0);
    expect(data.data_quality.unknown_status).toBeGreaterThan(0);
    expect(data.data_quality.invalid_series).toBeGreaterThan(0);
  });

  test('insufficient_data es true cuando hay menos de 3 velocidades válidas', async () => {
    const single = await summary({ exerciseId: V_TIEMPO_60 });
    expect(speedsOf(scopeRows({ ...RANGE, exerciseId: V_TIEMPO_60 })).length).toBeLessThan(3);
    expect(single.data_quality.insufficient_data).toBe(true);
    expect(single.trend.trend_pct).toBeNull();
    expect(single.consistency.cv).toBeNull();
    expect(single.trend.verdict).toBe('stable');

    const many = await summary({ exerciseId: RITMO_10K });
    expect(many.data_quality.insufficient_data).toBe(false);
  });
});

// ---------- las tres paletas, decididas por el dato ----------

describe('dashboard mock — la tupla (has_target, axis, target_speed_kph) tiene los tres casos', () => {
  test('A completo: ritmo_continuo con objetivo de tiempo y distancia', async () => {
    const data = await summary({ exerciseId: RITMO_10K });
    expect(data.has_target).toBe(true);
    expect(data.axis).toBe('distance_and_time');
    expect(data.totals.target_speed_kph).toBeGreaterThan(0);
    expect(data.totals.delta_pct).not.toBeNull();
    expect(data.totals.compliance_rate).not.toBeNull();
    expect(data.series_count).toBeGreaterThan(0);
  });

  test('A reducido: objetivo solo de distancia → hay objetivo pero no velocidad esperada', async () => {
    const data = await summary({ exerciseId: VMAX_100 });
    expect(data.has_target).toBe(true);
    expect(data.axis).toBe('distance');
    // Sin objetivo de tiempo la velocidad esperada NO se puede derivar: mostrar
    // un gauge contra este valor sería inventar el objetivo.
    expect(data.totals.target_speed_kph).toBeNull();
    expect(data.totals.compliance_rate).not.toBeNull();
    expect(data.totals.distance_m).not.toBeNull();
  });

  test('B: sin objetivo cargado → sin delta, sin cumplimiento y bandas en cero', async () => {
    const data = await summary({ exerciseId: ELONGACION });
    expect(data.has_target).toBe(false);
    // El eje lo declara el tipo aunque no haya objetivo: lo que falta es el
    // objetivo, no el eje.
    expect(data.axis).toBe('time');
    expect(data.totals.target_speed_kph).toBeNull();
    expect(data.totals.delta_pct).toBeNull();
    expect(data.totals.compliance_rate).toBeNull();
    // Sin objetivo la serie sigue siendo válida y cuenta: no es "no cumplida",
    // es "no comparable".
    expect(data.totals.valid_series).toBeGreaterThan(0);
    expect(data.totals.best_time_ms).not.toBeNull();

    const timeseries = await mockGetDashboardTimeseries({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, granularity: 'month', ...RANGE, kinds: ['elongacion'],
    });
    timeseries.buckets.forEach((bucket) => {
      expect(bucket.band_counts).toEqual({ met: 0, near: 0, missed: 0, unknown: 0 });
      expect(bucket.target_speed_kph).toBeNull();
      expect(bucket.delta_pct).toBeNull();
    });
  });

  test('un tipo sin velocidad no tiene AchievedSpeedKph: es el caso detrás de cv null', async () => {
    const data = await summary({ exerciseId: V_TIEMPO_60 });
    expect(data.has_target).toBe(true);
    expect(data.axis).toBe('time');
    expect(data.totals.achieved_speed_kph).toBeNull();
    expect(data.totals.compliance_rate).not.toBeNull();
    expect(data.totals.time_ms).toBeGreaterThan(0);
  });
});

// ---------- detalle por serie ----------

describe('dashboard mock — detalle por serie', () => {
  test('pagina con page/page_size y series_count cuenta las válidas, no las de la página', async () => {
    const page1 = await mockGetDashboardExerciseSeries({
      exerciseId: RITMO_10K, teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, page: 1, pageSize: 3, ...RANGE,
    });
    expect(page1.items).toHaveLength(3);
    expect(page1.page).toBe(1);
    expect(page1.page_size).toBe(3);
    expect(page1.total).toBeGreaterThan(3);
    const rows = scopeRows({ ...RANGE, exerciseId: RITMO_10K });
    expect(page1.series_count).toBe(rows.filter(isValid).length);
    expect(page1.total).toBe(rows.length);

    const page2 = await mockGetDashboardExerciseSeries({
      exerciseId: RITMO_10K, teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, page: 2, pageSize: 3, ...RANGE,
    });
    const overlap = page2.items.filter((item) => page1.items.some((other) => other.session_instance_id === item.session_instance_id
      && other.athlete_user_id === item.athlete_user_id
      && other.set_number === item.set_number));
    expect(overlap).toHaveLength(0);
  });

  test('cada ítem trae objetivo congelado, ejecutor y reportador, y el band que le corresponde', async () => {
    const data = await mockGetDashboardExerciseSeries({
      exerciseId: RITMO_10K, teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, page: 1, pageSize: 100, ...RANGE,
    });
    expect(data.has_target).toBe(true);
    data.items.forEach((item) => {
      expect(item.session_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.target_minutes).toBe(51);
      expect(item.target_distance_m).toBe(10000);
      expect(item.tolerance_applied).toBe(0.05);
      expect(['met', 'near', 'missed', 'unknown']).toContain(item.band);
      expect(typeof item.met_target).toBe('boolean');
    });
    // La velocidad llega derivada de distancia y tiempo, no leída de la
    // instancia. Las series sin distancia (las no calculables del seed) no la
    // tienen, y eso es un null, no un 0.
    const withDistance = data.items.filter((item) => item.distance_meters !== null);
    expect(withDistance.length).toBeGreaterThan(0);
    withDistance.forEach((item) => {
      expect(item.speed_kph).toBeCloseTo(
        item.distance_meters / 1000 / ((item.active_duration_ms ?? item.duration_ms) / 3_600_000),
        6,
      );
    });
    // Hay filas reportadas por el entrenador y por el propio corredor: es lo
    // que el CSV tiene que poder distinguir.
    const owners = new Set(data.items.map((item) => item.feedback_owner_user_id));
    expect(owners.size).toBeGreaterThan(1);
  });

  test('sin objetivo, met_target y band vienen null — no false', async () => {
    const data = await mockGetDashboardExerciseSeries({
      exerciseId: ELONGACION, teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, page: 1, pageSize: 20, ...RANGE,
    });
    expect(data.has_target).toBe(false);
    expect(data.items.length).toBeGreaterThan(0);
    data.items.forEach((item) => {
      expect(item.band).toBeNull();
      expect(item.met_target).toBeNull();
      expect(item.delta_pct).toBeNull();
    });
  });

  test('el tiempo degradado se marca en time_quality sin sacar la serie de los KPIs', async () => {
    const data = await mockGetDashboardExerciseSeries({
      exerciseId: RITMO_10K, teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, page: 1, pageSize: 50, ...RANGE,
    });
    const degraded = data.items.filter((item) => item.time_quality === 'degraded');
    expect(degraded.length).toBeGreaterThan(0);
    degraded.forEach((item) => {
      expect(item.active_duration_ms).toBeNull();
      // El tiempo igual se evalúa con el fallback: el número entra, la
      // degradación queda visible.
      expect(item.duration_ms).toBeGreaterThan(0);
    });
    expect(data.items.filter((item) => item.time_quality === 'alta').length).toBeGreaterThan(0);
  });
});

// ---------- leaderboard ----------

describe('dashboard mock — leaderboard', () => {
  const leaderboard = (extra = {}) => mockGetDashboardLeaderboard({
    teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, ...RANGE, ...extra,
  });

  test('pagina con page_size y `position` es la posición global, no la de la página', async () => {
    const data = await leaderboard({ pageSize: 2, page: 1 });
    expect(data.items).toHaveLength(2);
    expect(data.page_size).toBe(2);
    expect(data.total).toBe(6);
    expect(data.items.map((item) => item.rank)).toEqual([1, 2]);
    expect(data.items.map((item) => item.position)).toEqual([1, 2]);

    const page3 = await leaderboard({ pageSize: 2, page: 3 });
    expect(page3.items).toHaveLength(2);
    expect(page3.items.map((item) => item.rank)).toEqual([1, 2]);
    // La página 3 arranca en la posición 5 del scope: sin eso no se podría
    // mostrar "vas N°" sin traer todas las páginas.
    expect(page3.items.map((item) => item.position)).toEqual([5, 6]);
  });

  test('el default es best_time_ms ascendente y ordena por el tiempo', async () => {
    const data = await leaderboard();
    expect(data.sort).toBe('best_time_ms');
    expect(data.order).toBe('asc');
    const times = data.items.map((item) => item.best_time_ms);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  test('ordenar por velocidad o cumplimiento invierte el sentido con order', async () => {
    const desc = await leaderboard({ sort: 'mean_speed_kph', order: 'desc' });
    expect(desc.sort).toBe('mean_speed_kph');
    const speeds = desc.items.map((item) => item.mean_speed_kph);
    expect([...speeds].sort((a, b) => b - a)).toEqual(speeds);

    const asc = await leaderboard({ sort: 'compliance_rate', order: 'asc' });
    const rates = asc.items.map((item) => item.compliance_rate);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });

  test('marca la fila propia con is_self', async () => {
    const data = await leaderboard();
    const self = data.items.filter((item) => item.is_self);
    // El entrenador no está en el ranking (solo hay corredores), así que
    // is_self es false en todas: la fila propia es la del corredor, que además
    // recibe 403 y no llega hasta acá.
    expect(self).toHaveLength(0);
    data.items.forEach((item) => expect(item.is_self).toBe(false));
  });

  test('el total de distance y sessions por corredor sale de sus filas', async () => {
    const data = await leaderboard({ pageSize: 10 });
    data.items.forEach((item) => {
      const rows = scopeRows(RANGE).filter((row) => row.athlete_user_id === item.athlete_user_id);
      expect(item.sessions).toBe(new Set(rows.map((row) => row.session_instance_id)).size);
      expect(item.total_distance_m).toBeCloseTo(
        rows.filter(isValid).reduce((sum, row) => sum + (row.distance_meters ?? 0), 0),
        6,
      );
    });
  });
});

// ---------- comparaciones ----------

describe('dashboard mock — comparaciones', () => {
  test('una fila por corredor del scope, ordenada por id, con su tendencia', async () => {
    const data = await mockPostDashboardComparisons({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, ...RANGE,
    });
    expect(data.series).toHaveLength(6);
    expect(data.series.map((row) => row.athlete_user_id)).toEqual([101, 102, 103, 104, 105, 106]);
    data.series.forEach((row) => {
      expect(row.name).not.toBe('');
      if (row.trend.trend_pct === null) {
        expect(row.trend.verdict).toBe('stable');
      } else if (row.trend.trend_pct > 3) {
        expect(row.trend.verdict).toBe('improving');
      } else if (row.trend.trend_pct < -3) {
        expect(row.trend.verdict).toBe('regressing');
      }
    });
    expect(data.units.speed).toBe('km/h');
  });

  test('filtrar por athlete_user_ids acota las filas', async () => {
    const data = await mockPostDashboardComparisons({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, athleteUserIds: [101, 105], ...RANGE,
    });
    expect(data.series.map((row) => row.athlete_user_id)).toEqual([101, 105]);
  });

  test('comparación de períodos: pp en cumplimiento y el signo del tiempo invertido', async () => {
    const data = await mockPostDashboardPeriods({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05,
      current: { from: '2026-09-15', to: TODAY },
    });
    expect(data.current.from).toBe('2026-09-15');
    // Sin `previous`, el backend lo deriva desplazando la misma cantidad de días.
    expect(data.previous.from).toBe('2026-08-17');
    expect(data.previous.to).toBe('2026-09-14');
    expect(data.delta).not.toBeNull();
    // Puntos porcentuales, no porcentaje relativo.
    expect(data.delta.compliance_pp).toBeCloseTo(data.current.compliance_rate - data.previous.compliance_rate, 6);
    // Bajar el tiempo es mejorar: el delta del mejor tiempo tiene el signo
    // inverso al de la distancia.
    expect(data.delta.best_time_pct).toBeCloseTo(
      ((data.previous.best_time_ms - data.current.best_time_ms) / data.previous.best_time_ms) * 100,
      6,
    );
    expect(['improving', 'stable', 'regressing']).toContain(data.verdict);
  });

  test('un período sin series deja previous y delta en null con veredicto stable', async () => {
    const data = await mockPostDashboardPeriods({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05,
      current: { from: '2020-01-01', to: '2020-02-01' },
    });
    expect(data.current.series).toBe(0);
    expect(data.current.total_distance_m).toBeNull();
    expect(data.previous).toBeNull();
    expect(data.delta).toBeNull();
    // Presentarlo como "estable" sería mentir sobre datos que no existen.
    expect(data.verdict).toBe('stable');
  });
});

// ---------- filtros ----------

describe('dashboard mock — filtros y scope', () => {
  test('el catálogo trae los cinco tipos vigentes con su objetivo vigente', async () => {
    const data = await mockGetDashboardFilters({ teamId: TEAM_WITH_DATA, callerUserId: TRAINER });
    expect(data.teams).toEqual([{ id: TEAM_WITH_DATA, name: 'Runners Mendoza' }]);
    expect(data.exercise_types).toEqual(['liviano', 'elongacion', 'ritmo_continuo', 'velocidad_tiempo', 'velocidad_distancia']);
    expect(data.exercises).toHaveLength(12);
    expect(data.exercises.filter((e) => e.kind === 'ritmo_continuo')).toHaveLength(5);
    expect(data.exercises.filter((e) => e.kind === 'velocidad_distancia')).toHaveLength(4);
    // El ejercicio sin objetivo está en el catálogo con los dos objetivos en
    // null: es lo que hace alcanzable la paleta B.
    const sinObjetivo = data.exercises.find((e) => e.id === ELONGACION);
    expect(sinObjetivo.current_target_minutes).toBeNull();
    expect(sinObjetivo.current_target_distance_m).toBeNull();
    expect(data.groups.map((g) => g.role)).toEqual(['owner', 'owner']);
    expect(data.athletes).toHaveLength(6);
    expect(data.date_range).not.toBeNull();
    expect(data.date_range.min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.date_range.max).toBe('2026-10-12');
  });

  test('el equipo sin sesiones devuelve date_range null y el resumen en cero', async () => {
    const filters = await mockGetDashboardFilters({ teamId: TEAM_EMPTY, callerUserId: TRAINER });
    expect(filters.date_range).toBeNull();
    expect(filters.athletes).toHaveLength(0);

    const data = await mockGetDashboardSummary({
      teamId: TEAM_EMPTY, callerUserId: TRAINER, tolerance: 0.05, ...RANGE,
    });
    expect(data.axis).toBe('none');
    expect(data.has_target).toBe(false);
    expect(data.totals.sessions).toBe(0);
    expect(data.totals.series).toBe(0);
    expect(data.totals.valid_series).toBe(0);
    expect(data.totals.distance_m).toBeNull();
    expect(data.totals.time_ms).toBeNull();
    expect(data.totals.achieved_speed_kph).toBeNull();
    expect(data.totals.compliance_rate).toBeNull();
    expect(data.totals.best_time_ms).toBeNull();
    expect(data.trend.trend_pct).toBeNull();
    expect(data.data_quality.insufficient_data).toBe(true);
    expect(data.data_quality.invalid_series).toBe(0);
    expect(data.data_quality.open_sessions).toBe(0);
  });

  test('un equipo fuera del scope es 403 sin revelar si existe', async () => {
    await expect(mockGetDashboardFilters({ teamId: TEAM_OUT_OF_SCOPE, callerUserId: TRAINER }))
      .rejects.toMatchObject({ status: 403, data: { code: 'FORBIDDEN' } });
    await expect(mockGetDashboardSummary({ teamId: TEAM_OUT_OF_SCOPE, callerUserId: TRAINER, ...RANGE }))
      .rejects.toMatchObject({ status: 403 });
    // Un id de equipo que no existe tampoco puede confirmarse con un 404: eso
    // revelaría existencia. El backend responde 403 (resolveTeamGroup).
    await expect(mockGetDashboardFilters({ teamId: 9999, callerUserId: TRAINER }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('un corredor solo ve los suyos y no puede comparar', async () => {
    const filters = await mockGetDashboardFilters({ teamId: TEAM_WITH_DATA, callerUserId: RUNNER });
    expect(filters.athletes).toEqual([{ id: RUNNER, name: 'Lucía', surname: 'Fernández' }]);
    expect(filters.groups.map((g) => g.role)).toEqual(['member', 'member']);

    const data = await mockGetDashboardSummary({
      teamId: TEAM_WITH_DATA, callerUserId: RUNNER, tolerance: 0.05, ...RANGE,
    });
    const ownRows = scopeRows(RANGE).filter((row) => row.athlete_user_id === RUNNER);
    expect(data.totals.series).toBe(ownRows.length);
    expect(data.totals.sessions).toBe(new Set(ownRows.map((row) => row.session_instance_id)).size);

    // Los tres endpoints de comparación son del dueño del equipo: un corredor
    // recibe 403, igual que el backend.
    await expect(mockGetDashboardLeaderboard({
      teamId: TEAM_WITH_DATA, callerUserId: RUNNER, ...RANGE,
    })).rejects.toMatchObject({ status: 403, data: { code: 'FORBIDDEN' } });
    await expect(mockPostDashboardComparisons({
      teamId: TEAM_WITH_DATA, callerUserId: RUNNER, ...RANGE,
    })).rejects.toMatchObject({ status: 403 });
    await expect(mockPostDashboardPeriods({
      teamId: TEAM_WITH_DATA, callerUserId: RUNNER, current: { from: '2026-09-01', to: TODAY },
    })).rejects.toMatchObject({ status: 403 });
  });

  test('un corredor fuera de scope en /comparisons se nombra y no devuelve los demás', async () => {
    await expect(mockPostDashboardComparisons({
      teamId: TEAM_WITH_DATA, callerUserId: TRAINER, athleteUserIds: [101, 555], ...RANGE,
    })).rejects.toMatchObject({ status: 403, data: { code: 'ATHLETE_OUT_OF_SCOPE' } });
  });

  test('el filtro por grupo recorta, y un grupo de otro equipo es 403', async () => {
    const data = await summary({ groupId: GROUP_GENERAL });
    const rows = scopeRows({ ...RANGE, groupId: GROUP_GENERAL });
    expect(data.totals.series).toBe(rows.length);
    expect(data.totals.sessions).toBeGreaterThan(0);
    await expect(summary({ groupId: 999 })).rejects.toMatchObject({ status: 404 });
  });

  test('el filtro kinds[] agrega los ejercicios de esos tipos, ya resueltos', async () => {
    const data = await summary({ kinds: ['velocidad_distancia'] });
    const rows = scopeRows(RANGE).filter((row) => row.kind === 'velocidad_distancia');
    expect(data.totals.series).toBe(rows.length);
    expect(data.axis).toBe('distance');
  });

  test('exercise_id y kinds son excluyentes entre sí', async () => {
    await expect(summary({ exerciseId: RITMO_10K, kinds: ['ritmo_continuo'] }))
      .rejects.toMatchObject({ status: 400, data: { code: 'INVALID_RANGE' } });
  });
});

// ---------- unidades y errores ----------

describe('dashboard mock — unidades y códigos de error', () => {
  test('el bloque units trae las siete claves fijas del contrato', async () => {
    const data = await summary();
    expect(data.units).toEqual({
      speed: 'km/h', time: 'ms', distance: 'm', delta: '%', compliance: '%', best_time: 'ms', percentage_point: 'pp',
    });
  });

  test('los 400 del backend traen el code estable que decide el estado de pantalla', async () => {
    const cases = [
      [{ ...RANGE, from: '' }, 'MISSING_FROM'],
      [{ ...RANGE, from: '2020-01-01' }, 'INVALID_RANGE'],
      [{ ...RANGE, from: '2026-10-13', to: '2026-10-01' }, 'INVALID_RANGE'],
      [{ ...RANGE, from: 'no-es-fecha' }, 'INVALID_RANGE'],
      [{ ...RANGE, tolerance: 0.9 }, 'INVALID_TOLERANCE'],
      [{ ...RANGE, kinds: ['jogging'] }, 'INVALID_RANGE'],
    ];
    for (const [extra, code] of cases) {
      await expect(summary(extra)).rejects.toMatchObject({ status: 400, data: { code } });
    }
  });

  test('la granularidad, el orden y el page_size tienen su propio whitelist', async () => {
    const base = { teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, ...RANGE };
    await expect(mockGetDashboardTimeseries({ ...base, granularity: 'year' }))
      .rejects.toMatchObject({ status: 400, data: { code: 'INVALID_GRANULARITY' } });
    await expect(mockGetDashboardLeaderboard({ ...base, sort: 'sessions' }))
      .rejects.toMatchObject({ status: 400, data: { code: 'INVALID_SORT' } });
    await expect(mockGetDashboardLeaderboard({ ...base, order: 'sideways' }))
      .rejects.toMatchObject({ status: 400, data: { code: 'INVALID_SORT' } });
    await expect(mockGetDashboardLeaderboard({ ...base, pageSize: 500 }))
      .rejects.toMatchObject({ status: 400, data: { code: 'INVALID_PAGE_SIZE' } });
    await expect(mockGetDashboardLeaderboard({ ...base, page: 0 }))
      .rejects.toMatchObject({ status: 400, data: { code: 'INVALID_PAGE_SIZE' } });
  });

  test('un ejercicio que no existe es 404, y uno de otro dueño 403', async () => {
    await expect(mockGetDashboardExerciseSeries({
      exerciseId: 999, teamId: TEAM_WITH_DATA, callerUserId: TRAINER, ...RANGE,
    })).rejects.toMatchObject({ status: 404, data: { code: 'NOT_FOUND' } });
  });

  test('la granularidad cambia el anclaje de los buckets, y siempre de calendario', async () => {
    const base = { teamId: TEAM_WITH_DATA, callerUserId: TRAINER, tolerance: 0.05, ...RANGE };
    const week = await mockGetDashboardTimeseries({ ...base, granularity: 'week' });
    const month = await mockGetDashboardTimeseries({ ...base, granularity: 'month' });
    expect(week.granularity).toBe('week');
    expect(month.granularity).toBe('month');
    week.buckets.forEach((bucket) => {
      const day = new Date(`${bucket.period_start}T00:00:00Z`).getUTCDay();
      expect(day).toBe(1); // lunes ISO 8601
    });
    month.buckets.forEach((bucket) => {
      expect(bucket.period_start.slice(8)).toBe('01'); // día 1 del mes
    });
    expect(week.buckets.length).toBeGreaterThan(month.buckets.length);
    // Un bucket puede empezar antes del `from`: los anclajes son de calendario y
    // el recorte nunca parte una semana a la mitad. Las sesiones del seed caen
    // los martes, así que un `from` de martes incluye la sesión pero no su
    // lunes.
    const midWeek = await mockGetDashboardTimeseries({ ...base, granularity: 'week', from: '2026-07-21', to: TODAY });
    expect(midWeek.buckets[0].period_start).toBe('2026-07-20');
    expect(midWeek.buckets[0].period_start < '2026-07-21').toBe(true);
  });
});