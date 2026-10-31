// Mock de GET /dashboard/runner-kpis, derivado del mismo seed de filas que usa
// el dashboard (`services/__mocks__/dashboard-mock.js`).
//
// El endpoint real lo implementa el change hermano `kpis-home-corredor` del
// backend: identifica al corredor por el token y agrega sus series del período.
// Acá `callerUserId` reemplaza al token porque el mock no tiene sesión.
//
// No se agregan datos nuevos ni se toca el seed: este módulo es una vista más
// del conjunto que ya existe. Si el usuario no tiene filas en el período,
// `has_data: false` es un estado válido y visible.
import { __getMockDashboardSeed } from './dashboard-mock.js';

const DAY_MS = 86_400_000;

const UNITS = { distance: 'm', speed: 'km/h', time: 'ms' };

const VALID_PERIODS = new Set(['month', 'week', 'day']);
const TAB_KIND = {
  general: null,
  ritmo_continuo: 'ritmo_continuo',
  velocidad_tiempo: 'velocidad_tiempo',
  velocidad_distancia: 'velocidad_distancia',
};

function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatISODate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function invalidParam(code, message) {
  const error = new Error(message);
  error.status = 400;
  error.data = { status_code: 400, code, message };
  return error;
}

// Mismas reglas de calendario que el backend: mes calendario, semana ISO
// (lunes a domingo) y día. `days_considered` sale del rango, no de un cálculo
// del front.
function periodBounds(period, referenceDate) {
  const seed = __getMockDashboardSeed();
  const anchor = parseISODate(referenceDate) ?? parseISODate(seed.today) ?? Date.UTC(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );
  const date = new Date(anchor);
  let fromMs;
  let toMs;

  if (period === 'month') {
    fromMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    toMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
  } else if (period === 'week') {
    // getUTCDay: domingo = 0. La semana del contrato empieza el lunes.
    const offset = (date.getUTCDay() + 6) % 7;
    fromMs = anchor - offset * DAY_MS;
    toMs = fromMs + 6 * DAY_MS;
  } else {
    fromMs = anchor;
    toMs = anchor;
  }

  return {
    reference: formatISODate(anchor),
    from: formatISODate(fromMs),
    to: formatISODate(toMs),
    daysConsidered: Math.round((toMs - fromMs) / DAY_MS) + 1,
  };
}

function achievedTimeMs(row) {
  if (row.active_duration_ms > 0) return row.active_duration_ms;
  return row.duration_ms > 0 ? row.duration_ms : 0;
}

function positiveDistance(row) {
  return typeof row.distance_meters === 'number' && Number.isFinite(row.distance_meters) && row.distance_meters > 0
    ? row.distance_meters
    : null;
}

function speedOf(row) {
  const distanceM = positiveDistance(row);
  const timeMs = achievedTimeMs(row);
  if (distanceM === null || !(timeMs > 0)) return null;
  return distanceM / 1000 / (timeMs / 3_600_000);
}

// Copia de las reglas de validez del backend (validity.go#isValidSeries), las
// mismas que usa el mock del dashboard para que los dos mocks coincidan.
function isValidSeries(row) {
  switch (row.kind) {
    case 'liviano':
      return achievedTimeMs(row) > 0 || positiveDistance(row) !== null;
    case 'elongacion':
    case 'velocidad_tiempo':
      return achievedTimeMs(row) > 0;
    case 'ritmo_continuo':
      return achievedTimeMs(row) > 0 && positiveDistance(row) !== null;
    case 'velocidad_distancia':
      return positiveDistance(row) !== null;
    default:
      return false;
  }
}

// Media ponderada por distancia, como el backend: una serie de 21 km a 5 km/h
// pesa más que una de 4 km a 15 km/h. Una media simple daría 10 km/h en vez de
// los 6,6 km/h del contrato.
function weightedAverageSpeed(entries) {
  let weight = 0;
  let weighted = 0;
  entries.forEach(({ row, speedKph }) => {
    const distance = positiveDistance(row);
    if (distance === null) return;
    weight += distance;
    weighted += distance * speedKph;
  });
  if (!(weight > 0)) return null;
  return weighted / weight;
}

function bestDayOf(rows) {
  const byDay = new Map();
  rows.forEach((row) => {
    const distance = positiveDistance(row);
    if (distance === null) return;
    byDay.set(row.session_date, (byDay.get(row.session_date) ?? 0) + distance);
  });

  let bestDate = null;
  let bestDistance = null;
  byDay.forEach((distance, date) => {
    // Empate: gana la fecha más antigua, igual que el backend.
    if (bestDistance === null || distance > bestDistance || (distance === bestDistance && date < bestDate)) {
      bestDate = date;
      bestDistance = distance;
    }
  });

  return { date: bestDate, distance: bestDistance };
}

function emptyMetrics() {
  return {
    total_distance_m: null,
    best_day_distance_m: null,
    best_day_date: null,
    average_speed_kph: null,
    best_speed_kph: null,
    best_time_ms: null,
    best_distance_m: null,
  };
}

export async function mockGetRunnerKpis({ period = 'month', referenceDate, tab = 'general', callerUserId } = {}) {
  if (!VALID_PERIODS.has(period)) {
    throw invalidParam('INVALID_PERIOD', 'period debe ser uno de: month, week, day');
  }
  if (!Object.prototype.hasOwnProperty.call(TAB_KIND, tab)) {
    throw invalidParam('INVALID_TAB', 'tab debe ser una de las cuatro pestañas del contrato');
  }

  const { reference, from, to, daysConsidered } = periodBounds(period, referenceDate);
  const seed = __getMockDashboardSeed();
  const periodRows = seed.series.filter((row) => (
    String(row.athlete_user_id) === String(callerUserId)
    && row.session_date >= from
    && row.session_date <= to
  ));

  const kind = TAB_KIND[tab];
  const scopedRows = kind === null ? periodRows : periodRows.filter((row) => row.kind === kind);
  const validRows = scopedRows.filter(isValidSeries);

  // El backend agrega sobre TODAS las filas de la pestaña, no solo las válidas:
  // las métricas de distancia/tiempo/velocidad y `series_count` usan esa base;
  // `valid_series` es un contador aparte. Mezclar las dos bases haría que el
  // mock dejara de coincidir con el endpoint.
  const distanceRows = scopedRows.filter((row) => positiveDistance(row) !== null);
  const metrics = emptyMetrics();

  metrics.total_distance_m = distanceRows.length
    ? distanceRows.reduce((sum, row) => sum + positiveDistance(row), 0)
    : null;

  const bestDay = bestDayOf(scopedRows);
  metrics.best_day_distance_m = bestDay.distance;
  metrics.best_day_date = bestDay.date;

  metrics.best_distance_m = distanceRows.length
    ? Math.max(...distanceRows.map((row) => positiveDistance(row)))
    : null;

  const times = scopedRows.map(achievedTimeMs).filter((time) => time > 0);
  metrics.best_time_ms = times.length ? Math.min(...times) : null;

  const speedRows = scopedRows
    .map((row) => ({ row, speedKph: speedOf(row) }))
    .filter((entry) => entry.speedKph !== null);
  const speeds = speedRows.map((entry) => entry.speedKph);
  metrics.best_speed_kph = speeds.length ? Math.max(...speeds) : null;

  // En `general` el promedio es SOLO de ritmo continuo, tal como lo define el
  // backend: mezclarlo con velocidad en distancia/tiempo sería otro número.
  // En las pestañas de velocidad el recorte ya lo hace `kind`.
  const averagePool = tab === 'general'
    ? speedRows.filter((entry) => entry.row.kind === 'ritmo_continuo')
    : speedRows;
  metrics.average_speed_kph = weightedAverageSpeed(averagePool);

  return {
    period,
    reference_date: reference,
    from,
    to,
    days_considered: daysConsidered,
    tab,
    units: UNITS,
    has_data: scopedRows.length > 0,
    series_count: scopedRows.length,
    valid_series: validRows.length,
    sessions: new Set(scopedRows.map((row) => row.session_instance_id)).size,
    metrics,
  };
}
