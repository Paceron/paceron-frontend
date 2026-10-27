// Mock del dashboard analítico (`/dashboard/*`), derivado del backend YA
// IMPLEMENTADO en paceron-backend:
//
//   - formas de respuesta: cmd/api/domains/dashboard/dto.go
//   - rutas, query params y códigos de error: cmd/api/controllers/dashboard_controller.go
//   - validaciones, defaults y 403 de scope: cmd/api/services/dashboard_service.go
//   - fórmulas: cmd/api/domains/dashboard/{kpi,validity,band,compliance,trend,consistency,aggregate}.go
//
// A diferencia de los otros mocks del repo, este NO trae números escritos a mano:
// siembra filas de feedback y corre las MISMAS agregaciones que el backend. La
// razón es que hay siete respuestas y cinco tipos de ejercicio, y un mock con
// literales se contradice solo (un `valid_series` que no es `series −
// invalid_series`, un `compliance_rate` que no se puede reconstruir) sin que nada
// falle — contra mocks una aritmética rota es invisible. Con las fórmulas
//Calculadas, la coherencia es una consecuencia de construcción y el test la
// verifica de forma independiente contra las filas crudas (`__getMockDashboardSeed`).
//
// Decisiones de scope del mock (el backend real las saca del token):
//   - usuario 1 = entrenador dueño de los equipos 1 y 4.
//   - usuario 99 = entrenador dueño de los equipos 2 y 3 (fuera del scope del
//     demo → 403).
//   - usuarios 101-106 = corredores del equipo 4 (miembros). Un corredor NO es
//     dueño del equipo, así que /leaderboard y los dos /comparisons le devuelven
//     403, igual que el backend.
//   - el equipo 1 es del demo pero no tiene ninguna sesión sembrada: es el caso
//     vacío, con `date_range: null` y todos los contadores en cero.
//
// Los ids de grupo NO se siembran con groups-mock.js a propósito: `__seedGroup`
// muta el estado de ese mock, e importar el dashboard crearía grupos fantasma en
// la pantalla de grupos del resto de la app con USE_MOCKS.

const MS_PER_HOUR = 3_600_000;

// El bloque `units` del backend (domains/dashboard/units.go): siete claves fijas
// que viajan en las seis respuestas de métricas. Se replica literal para que el
// front lea la unidad de la respuesta y no la hardcodee (D4).
const UNITS = {
  speed: 'km/h',
  time: 'ms',
  distance: 'm',
  delta: '%',
  compliance: '%',
  best_time: 'ms',
  percentage_point: 'pp',
};

// Mismos cinco valores y en el mismo orden que constants.CurrentExerciseKinds().
const CURRENT_KINDS = ['liviano', 'elongacion', 'ritmo_continuo', 'velocidad_tiempo', 'velocidad_distancia'];

// Los únicos tres que se aceptan como filtro de tipo (spec dashboard-analytics:
// "Los tres tipos con métrica"). `liviano` y `elongacion` siguen siendo tipos
// válidos del modelo, pero como filtro devolverían siempre vacío: sus series son
// warmup/cooldown y el backend filtra por role = 'main'.
const METRIC_KINDS = ['ritmo_continuo', 'velocidad_distancia', 'velocidad_tiempo'];

const TREND_MIN_SERIES = 3;
const TREND_THRESHOLD_PCT = 3;
const PERIODS_THRESHOLD_PP = 2;
const MAX_RANGE_DAYS = 731;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_GRANULARITY = 'session';
const DEFAULT_SORT = 'best_time_ms';
const DEFAULT_ORDER = 'asc';
const DEFAULT_TOLERANCE = 0.05;
const MIN_TOLERANCE = 0.01;
const MAX_TOLERANCE = 0.2;
const GRANULARITIES = ['session', 'week', 'month', 'quarter'];
const SORT_COLUMNS = ['best_time_ms', 'mean_speed_kph', 'total_distance_m', 'compliance_rate'];
const ORDERS = ['asc', 'desc'];

// ---------- scope sembrado ----------

const TRAINER_USER_ID = 1;
const OTHER_TRAINER_USER_ID = 99;

const TEAMS = [
  // Del demo, sin ninguna sesión sembrada: el estado vacío de la pantalla.
  { id: 1, name: 'Corredores del Sur', ownerUserId: TRAINER_USER_ID },
  // Fuera del scope del demo: pedirlo es 403.
  { id: 2, name: 'Running Cordoba Norte', ownerUserId: OTHER_TRAINER_USER_ID },
  { id: 3, name: 'Maraton Runners', ownerUserId: OTHER_TRAINER_USER_ID },
  // El equipo con datos.
  { id: 4, name: 'Runners Mendoza', ownerUserId: TRAINER_USER_ID },
];

const GROUP_GENERAL = 41;
const GROUP_AVANZADO = 42;
const DATA_TEAM_ID = 4;

const GROUPS = [
  { id: GROUP_GENERAL, teamId: DATA_TEAM_ID, name: 'General' },
  { id: GROUP_AVANZADO, teamId: DATA_TEAM_ID, name: 'Avanzado' },
];

// Nombres y ids del SEARCH_CATALOG de user-mock.js, para que el corredor que se
// ve acá sea el mismo que en el resto de la app con USE_MOCKS.
const ATHLETES = [
  { id: 101, name: 'Lucía', surname: 'Fernández', groupId: GROUP_GENERAL, base: 1.02, rawKph: 16.2 },
  { id: 102, name: 'Martín', surname: 'Gómez', groupId: GROUP_GENERAL, base: 0.96, rawKph: 15.4 },
  { id: 103, name: 'Sofía', surname: 'Rodríguez', groupId: GROUP_GENERAL, base: 1.05, rawKph: 17.1 },
  { id: 104, name: 'Nicolás', surname: 'López', groupId: GROUP_AVANZADO, base: 0.99, rawKph: 16.8 },
  { id: 105, name: 'Valentina', surname: 'Díaz', groupId: GROUP_AVANZADO, base: 1.08, rawKph: 18.0 },
  { id: 106, name: 'Tomás', surname: 'Martínez', groupId: GROUP_AVANZADO, base: 0.93, rawKph: 15.0 },
];

// Los doce ejercicios del catálogo sembrado: los cinco tipos vigentes con el
// reparto que el spec describe (5 ritmo_continuo, 4 velocidad_distancia) más un
// liviano, uno de velocidad_tempo y uno de elongacion.
//
// `ELONGACION` NO tiene objetivo cargado en el catálogo: es el caso `has_target:
// false` (paleta B). Sin él, la paleta B no se puede ver en el preview y los tres
// escenarios que dependen de ella quedan sin verificar.
//
// `currentTargetMinutes`/`currentTargetDistanceM` son el objetivo VIGENTE del
// catálogo —lo que expone /dashboard/filters—. Lo que se judgea en cada serie es
// el objetivo CONGELADO de la instancia, y el mock congela los mismos valores.
const EXERCISES = [
  { id: 1, name: 'Calentamiento', kind: 'liviano', currentTargetMinutes: 10, currentTargetDistanceM: null },
  { id: 2, name: 'Elongación y movilidad', kind: 'elongacion', currentTargetMinutes: null, currentTargetDistanceM: null },
  { id: 3, name: 'Ritmo continuo 5 km', kind: 'ritmo_continuo', currentTargetMinutes: 26, currentTargetDistanceM: 5000 },
  { id: 4, name: 'Ritmo continuo 8 km', kind: 'ritmo_continuo', currentTargetMinutes: 40, currentTargetDistanceM: 8000 },
  { id: 5, name: 'Ritmo continuo 10 km', kind: 'ritmo_continuo', currentTargetMinutes: 51, currentTargetDistanceM: 10000 },
  { id: 6, name: 'Ritmo continuo 12 km', kind: 'ritmo_continuo', currentTargetMinutes: 58, currentTargetDistanceM: 12000 },
  { id: 7, name: 'Ritmo continuo 15 km', kind: 'ritmo_continuo', currentTargetMinutes: 75, currentTargetDistanceM: 15000 },
  { id: 8, name: 'Preferencias 1000 m', kind: 'velocidad_distancia', currentTargetMinutes: null, currentTargetDistanceM: 1000 },
  { id: 9, name: 'Preferencias 2000 m', kind: 'velocidad_distancia', currentTargetMinutes: null, currentTargetDistanceM: 2000 },
  { id: 10, name: 'Velocidad máxima 100 m', kind: 'velocidad_distancia', currentTargetMinutes: null, currentTargetDistanceM: 100 },
  { id: 11, name: 'Velocidad máxima 200 m', kind: 'velocidad_distancia', currentTargetMinutes: null, currentTargetDistanceM: 200 },
  { id: 12, name: 'Velocidad máxima 60 s', kind: 'velocidad_tiempo', currentTargetMinutes: 1, currentTargetDistanceM: null },
];

const EXERCISE_BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

// Plan de calendario del equipo 4. `status: 'wip'` son sesiones sin cerrar: el
// backend las saca del set de series (por eso no generan filas) y las cuenta
// aparte en `open_sessions`.
const SESSION_PLAN = [
  { daysAgo: 91, groupId: GROUP_GENERAL, exercises: [1, 3, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 84, groupId: GROUP_AVANZADO, exercises: [1, 8, 12, 2], athleteIds: [104, 105, 106], sets: 3 },
  { daysAgo: 77, groupId: GROUP_GENERAL, exercises: [4, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 70, groupId: GROUP_AVANZADO, exercises: [9, 10, 1, 2], athleteIds: [104, 105, 106] },
  { daysAgo: 63, groupId: GROUP_GENERAL, exercises: [3, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 56, groupId: GROUP_AVANZADO, exercises: [12, 11, 1, 2], athleteIds: [104, 105, 106], sets: 3 },
  { daysAgo: 49, groupId: GROUP_GENERAL, exercises: [5, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 42, groupId: GROUP_AVANZADO, exercises: [8, 9, 1, 2], athleteIds: [104, 105, 106] },
  { daysAgo: 35, groupId: GROUP_GENERAL, exercises: [4, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 28, groupId: GROUP_AVANZADO, exercises: [10, 11, 12, 2], athleteIds: [104, 105, 106] },
  { daysAgo: 21, groupId: GROUP_GENERAL, exercises: [6, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 14, groupId: GROUP_AVANZADO, exercises: [8, 12, 1, 2], athleteIds: [104, 105, 106], sets: 3 },
  { daysAgo: 7, groupId: GROUP_GENERAL, exercises: [3, 5, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 2, groupId: GROUP_AVANZADO, exercises: [9, 11, 1, 2], athleteIds: [104, 105, 106] },
  { daysAgo: 1, groupId: GROUP_GENERAL, exercises: [7, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 0, groupId: GROUP_GENERAL, status: 'wip', exercises: [5, 1, 2], athleteIds: [101, 102, 103] },
  { daysAgo: 0, groupId: GROUP_AVANZADO, status: 'wip', exercises: [8, 12], athleteIds: [104, 105, 106] },
];

const FIRST_SESSION_ID = 7100;

// Rangos del número pseudoaleatorio de cada fila que dejan un defecto. El mismo
// `jitter` que determina cuánto rindió la serie decide si vino degradada, sin
// fila en runner_session, etc. Reglas por índice global se descartaron: con un
// ejercicio de pocas filas podían no tocar ni una y su estado de pantalla
// quedaba sin poder verificarse en el preview.
const DEGRADED_TIME_BELOW = 0.18;
const SELF_REPORTED_FROM = 0.3;
const SELF_REPORTED_TO = 0.42;
// Series con objetivo que quedaron LEJOS del objetivo: sin esto la peor banda
// que aparece es `near` y el cumplimiento se ve con dos porciones, así que ni
// `missed` ni la caída de la curva por debajo de la zona de tolerancia se pueden
// verificar en el preview.
const OFF_TARGET_FROM = 0.42;
const OFF_TARGET_TO = 0.5;
const LEGACY_FROM = 0.5;
const LEGACY_TO = 0.62;
// Series con objetivo cargado pero SIN medición usable en el eje del objetivo
// (queda sin distancia, así que la velocidad no se puede derivar): el backend las
// clasifica `unknown`, no `missed` — "no se pudo evaluar" no es "no cumplió".
const NO_MEASURE_FROM = 0.62;
const NO_MEASURE_TO = 0.7;
const UNKNOWN_STATUS_FROM = 0.85;
const INVALID_SERIES_FROM = 0.93;

// ---------- fechas ----------

const DAY_MS = 86_400_000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatISODate(ms) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function daysBetween(fromMs, toMs) {
  return Math.round((toMs - fromMs) / DAY_MS);
}

// ---------- seed determinista ----------

// mulberry32: sin Math.random() porque el test afirma números exactos y con
// Math.random() fallaría sin que nada más cambiara.
function seededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function progressFactor(daysAgo) {
  // El equipo mejora a lo largo del período: 0,96 hace 91 días y 1,04 hoy. Es
  // lo que hace que `trend_pct` salga positivo y con veredicto "improving" en el
  // preview, en vez de un número plano sin sentido.
  return 1.04 - (0.08 * daysAgo) / 91;
}

function buildSeedSeries() {
  const rows = [];
  let sessionId = FIRST_SESSION_ID;

  SESSION_PLAN.forEach((session) => {
    const currentId = sessionId;
    sessionId += 1;
    if (session.status === 'wip') return; // sin cerrar: no entra al set de series
    const sets = session.sets ?? 1;
    const progress = progressFactor(session.daysAgo);

    session.exercises.forEach((exerciseId) => {
      const exercise = EXERCISE_BY_ID.get(exerciseId);
      session.athleteIds.forEach((athleteId) => {
        const athlete = ATHLETES.find((candidate) => candidate.id === athleteId);
        for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
          rows.push(buildSeriesRow({
            sessionInstanceId: currentId,
            daysAgo: session.daysAgo,
            exercise,
            athlete,
            setNumber,
            progress,
          }));
        }
      });
    });
  });

  return rows;
}

function buildSeriesRow({ sessionInstanceId, daysAgo, exercise, athlete, setNumber, progress }) {
  const jitter = seededRandom(sessionInstanceId * 1000 + athlete.id * 10 + setNumber)();
  const factor = athlete.base * progress * (0.97 + 0.06 * jitter);
  // El objetivo se CONGELA en la instancia: es el del catálogo al momento de la
  // sesión, no el vigente de hoy.
  const targetMinutes = exercise.currentTargetMinutes;
  const targetDistanceM = exercise.currentTargetDistanceM;
  const targets = { minutes: targetMinutes, distanceM: targetDistanceM };
  const axis = objectiveAxisForKind(exercise.kind, targets);

  let durationMs = 0;
  let distanceMeters = null;

  if (axis === 'distance') {
    // Objetivo solo de distancia (paleta A reducido): hay objetivo cargado pero
    // NO hay tiempo objetivo, así que la velocidad esperada no se puede derivar
    // y `target_speed_kph` llega null. Es el caso que la tupla
    // (has_target, axis, target_speed_kph != null) separa del resto.
    distanceMeters = Math.round(targetDistanceM * (0.94 + 0.1 * jitter));
    durationMs = Math.round((distanceMeters / 1000 / (athlete.rawKph * factor)) * MS_PER_HOUR);
  } else {
    // Eje temporal: no se registró distancia (pista indoor / elongación), así que
    // la serie es válida pero NO tiene velocidad — y por eso no entra en la
    // tendencia ni en la consistencia. Es el caso real detrás de
    // `insufficient_data` y de un `cv` null.
    durationMs = Math.round(((targetMinutes ?? 10) * 60_000) / factor);
    if (axis === 'distance_and_time') {
      distanceMeters = Math.round(((targetSpeedKph(targets) * factor * durationMs) / MS_PER_HOUR) * 1000);
    }
  }

  // Los dos defectos de cumplimiento se calculan DIRECTAMENTE contra el objetivo
  // (no contra el rendimiento ya derivado): así la banda que sale no depende del
  // atleta ni del progreso, y la ventana del jitter predice el resultado.
  const targeted = hasTarget(exercise.kind, targets);

  if (targeted && jitter >= OFF_TARGET_FROM && jitter < OFF_TARGET_TO) {
    if (axis === 'time') {
      durationMs = Math.round(targetMinutes * 60_000 * 1.3); // 30 % más lento
    } else if (axis === 'distance') {
      distanceMeters = Math.round(targetDistanceM * 0.72); // 28 % más corto
    } else {
      const expectedKph = targetSpeedKph(targets);
      if (expectedKph) {
        distanceMeters = Math.round(targetDistanceM * (0.94 + 0.1 * jitter));
        // 25 % por debajo de la velocidad objetivo: fuera del margen de `near`
        // (objetivo × 0,90 con la tolerancia por defecto).
        durationMs = Math.round((distanceMeters / 1000 / (expectedKph * 0.75)) * MS_PER_HOUR);
      }
    }
  }

  if (targeted && jitter >= NO_MEASURE_FROM && jitter < NO_MEASURE_TO && axis !== 'time') {
    // Sin medición en el eje del objetivo: la serie tiene objetivo pero no es
    // calculable, que es exactamente el caso que el backend marca `unknown`.
    // Solo aplica a los ejes que exigen distancia — un tiempo logrado en cero no
    // es "sin medición", es una serie que ni entra al set de tiempos (y con un
    // `timeFromMin` puesto el DAO la descarta antes), así que sembrarla
    // enmascararía ese comportamiento del filtro por tiempo.
    distanceMeters = null;
  }

  const needsDistance = axis === 'distance' || axis === 'distance_and_time';
  const degraded = jitter < DEGRADED_TIME_BELOW;
  const selfReported = jitter >= SELF_REPORTED_FROM && jitter < SELF_REPORTED_TO;
  const rpe = jitter < 0.12 ? null : 2 + Math.floor(jitter * 9);

  return {
    session_instance_id: sessionInstanceId,
    session_date: sessionDateOf(daysAgo),
    athlete_user_id: athlete.id,
    // El front necesita distinguir QUIÉN ejecutó de QUIÉN reportó: el CSV
    // exportado por el entrenador lleva las dos columnas.
    feedback_owner_user_id: selfReported ? athlete.id : TRAINER_USER_ID,
    set_number: setNumber,
    feedback_id: sessionInstanceId * 1_000_000 + athlete.id * 100 + exercise.id * 10 + setNumber,
    exercise_id: exercise.id,
    kind: exercise.kind,
    duration_ms: durationMs,
    // Sin tiempo activo el tiempo se evalúa igual con el fallback, y la
    // degradación queda visible en `time_quality`.
    active_duration_ms: degraded ? null : durationMs,
    // Sin distancia en un tipo que la exige, la serie no es calculable: queda
    // fuera de promedios, cumplimiento y rankings, y se cuenta en
    // `invalid_series`.
    distance_meters: needsDistance && jitter >= INVALID_SERIES_FROM ? null : distanceMeters,
    completion_status: jitter >= UNKNOWN_STATUS_FROM ? 'a medias' : 'completa',
    rpe,
    target_minutes: targetMinutes,
    target_distance_m: targetDistanceM,
    // Sin fila en runner_session la serie entra igual a los KPI y solo se cuenta
    // en `legacy_sessions`. OJO: el backend NO suma acá las instancias que
    // resolvió por nombre normalizado (`LegacyExerciseInstanceIDs` en
    // dashboard_service.go, decidido en resolveLegacyInstances): su contador es
    // solo "válida y sin runner_session" (quality.go:36).
    has_runner_session: !(jitter >= LEGACY_FROM && jitter < LEGACY_TO),
  };
}

let mockToday = null;
let mockSeries = [];
let mockSessions = [];

function sessionDateOf(daysAgo) {
  return formatISODate(Date.parse(`${formatISODate(mockToday)}T00:00:00Z`) - daysAgo * DAY_MS);
}

function rebuildSeed() {
  mockToday = formatISODate(Date.now());
  mockSessions = SESSION_PLAN.map((session, index) => ({
    id: FIRST_SESSION_ID + index,
    date: sessionDateOf(session.daysAgo),
    group_id: session.groupId,
    status: session.status ?? 'finished',
  }));
  mockSeries = buildSeedSeries();
}

rebuildSeed();

// ---------- errores ----------

// Misma forma que arma services/api.js: `status` para el código HTTP y `data`
// para el `code` con el que decide el estado (utils/dashboard-error-codes.js).
function dashboardError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.data = { status_code: status, code, message };
  return error;
}

function forbidden(message) {
  return dashboardError(403, 'FORBIDDEN', message);
}

function notFound(message) {
  return dashboardError(404, 'NOT_FOUND', message);
}

function paramError(code, message) {
  return dashboardError(400, code, message);
}

// ---------- scope ----------

function findTeam(teamId) {
  return TEAMS.find((team) => String(team.id) === String(teamId)) ?? null;
}

function ownsTeam(teamId, callerUserId) {
  const team = findTeam(teamId);
  return Boolean(team) && String(team.ownerUserId) === String(callerUserId);
}

function isMember(teamId, callerUserId) {
  if (String(teamId) !== String(DATA_TEAM_ID)) return false;
  return ATHLETES.some((athlete) => String(athlete.id) === String(callerUserId));
}

// El equipo del que se llega tiene que estar en el scope del solicitante. El
// backend responde 403 también cuando el equipo no existe (resolveTeamGroup solo
// mira el scope): un 404 acá revelaría existencia.
function requireScope(teamId, callerUserId) {
  const team = findTeam(teamId);
  if (team && (ownsTeam(teamId, callerUserId) || isMember(teamId, callerUserId))) return team;
  throw forbidden('El equipo no está entre los que podés ver');
}

// El grupo es un recorte del scope, no una ampliación: 404 si no existe, 403 si
// existe pero es de otro equipo.
function requireGroup(teamId, groupId, callerUserId) {
  requireScope(teamId, callerUserId);
  if (groupId === null || groupId === undefined) return;
  const group = GROUPS.find((candidate) => String(candidate.id) === String(groupId));
  if (!group) throw notFound('No encontramos ese grupo');
  if (group.teamId !== Number(teamId)) throw forbidden('El grupo no está entre los que podés ver');
}

// /leaderboard y los dos /comparisons son solo del dueño (services/dashboard_service.go,
// `prepare(..., ownerOnly)` y los chequeos explícitos de Comparisons/Periods).
function requireOwnership(teamId, callerUserId) {
  const team = requireScope(teamId, callerUserId);
  if (!ownsTeam(teamId, callerUserId)) {
    throw forbidden('Solo el dueño del equipo puede comparar corredores');
  }
  return team;
}

// ---------- validación de parámetros ----------

function resolveGranularity(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_GRANULARITY;
  if (!GRANULARITIES.includes(value)) {
    throw paramError('INVALID_GRANULARITY', 'granularity debe ser uno de: session, week, month, quarter');
  }
  return value;
}

function resolveSort(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_SORT;
  if (!SORT_COLUMNS.includes(value)) {
    throw paramError('INVALID_SORT', 'sort debe ser uno de: best_time_ms, mean_speed_kph, total_distance_m, compliance_rate');
  }
  return value;
}

// `order` comparte el código de `sort`: el conjunto de codes del backend es
// cerrado y no tiene uno para el sentido del orden (parseDashboardOrder).
function resolveOrder(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_ORDER;
  if (!ORDERS.includes(value)) throw paramError('INVALID_SORT', 'order debe ser asc o desc');
  return value;
}

function resolveToleranceParam(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_TOLERANCE;
  const tolerance = Number(value);
  if (!Number.isFinite(tolerance) || tolerance < MIN_TOLERANCE || tolerance > MAX_TOLERANCE) {
    throw paramError('INVALID_TOLERANCE', `tolerance debe estar entre ${MIN_TOLERANCE} y ${MAX_TOLERANCE}`);
  }
  return tolerance;
}

function resolvePaging(page, pageSize) {
  let resolvedPage = DEFAULT_PAGE;
  if (page !== null && page !== undefined && page !== '') {
    resolvedPage = Number(page);
    if (!Number.isInteger(resolvedPage) || resolvedPage < 1) {
      throw paramError('INVALID_PAGE_SIZE', 'page debe ser un entero mayor o igual a 1');
    }
  }
  let resolvedPageSize = DEFAULT_PAGE_SIZE;
  if (pageSize !== null && pageSize !== undefined && pageSize !== '') {
    resolvedPageSize = Number(pageSize);
    if (!Number.isInteger(resolvedPageSize) || resolvedPageSize < 1 || resolvedPageSize > MAX_PAGE_SIZE) {
      throw paramError('INVALID_PAGE_SIZE', `page_size debe estar entre 1 y ${MAX_PAGE_SIZE}`);
    }
  }
  return { page: resolvedPage, pageSize: resolvedPageSize };
}

function resolveRange(from, to) {
  if (!from) throw paramError('MISSING_FROM', 'from es obligatorio');
  const fromMs = parseISODate(from);
  if (fromMs === null) throw paramError('INVALID_RANGE', 'from debe tener formato YYYY-MM-DD');
  let toMs = fromMs;
  if (to) {
    const parsedTo = parseISODate(to);
    if (parsedTo === null) throw paramError('INVALID_RANGE', 'to debe tener formato YYYY-MM-DD');
    toMs = parsedTo;
  }
  if (toMs < fromMs) throw paramError('INVALID_RANGE', 'to no puede ser anterior a from');
  if (daysBetween(fromMs, toMs) > MAX_RANGE_DAYS) {
    throw paramError('INVALID_RANGE', 'el rango no puede superar los 2 años');
  }
  return { fromMs, toMs };
}

// `exercise_id`, `exercise_ids[]` y `kind` son excluyentes entre sí
// (resolveExerciseFilter). `kind` es ESCALAR: el filtro de tipo del front es de
// selección única y el "todos" viaja como ausencia del parámetro.
function resolveExerciseFilter(filters) {
  const kind = filters.kind ?? null;
  const exerciseIds = filters.exerciseIds ?? [];
  const selected = [filters.exerciseId, exerciseIds, kind].filter(
    (value) => value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
  ).length;
  if (selected > 1) {
    throw paramError('INVALID_RANGE', 'exercise_id, exercise_ids y kind son excluyentes: mandá solo uno');
  }
  if (kind) {
    if (!METRIC_KINDS.includes(kind)) {
      throw paramError('INVALID_RANGE', `kind "${kind}" no es uno de los tres tipos con métrica`);
    }
    return EXERCISES.filter((exercise) => exercise.kind === kind).map((exercise) => exercise.id);
  }
  const ids = filters.exerciseId !== null && filters.exerciseId !== undefined ? [filters.exerciseId] : exerciseIds;
  if (!ids.length) return null;
  const resolved = ids.map((id) => EXERCISE_BY_ID.get(Number(id))).filter(Boolean);
  // Pedir N ejercicios y devolver menos en silencio haría creer que el resto
  // existe: el backend responde 404.
  if (resolved.length !== ids.length) throw notFound('No encontramos ese ejercicio');
  return resolved.map((exercise) => exercise.id);
}

// Los cuatro filtros de rango, en la unidad del contrato: metros enteros y
// minutos enteros. Un decimal, un negativo o un rango invertido son 400 acá
// también — la pantalla los avisa antes de mandar, pero el mock es donde se
// verifica que el backend los rechazaría.
function resolveRangeBounds(filters) {
  const bound = (value, name) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw paramError('INVALID_RANGE', `${name} debe ser un entero igual o mayor a cero`);
    }
    return n;
  };
  const bounds = {
    distanceFromM: bound(filters.distanceFromM, 'distance_from_m'),
    distanceToM: bound(filters.distanceToM, 'distance_to_m'),
    timeFromMin: bound(filters.timeFromMin, 'time_from_min'),
    timeToMin: bound(filters.timeToMin, 'time_to_min'),
  };
  if (bounds.distanceFromM !== null && bounds.distanceToM !== null && bounds.distanceFromM > bounds.distanceToM) {
    throw paramError('INVALID_RANGE', 'distance_from_m no puede ser mayor que distance_to_m');
  }
  if (bounds.timeFromMin !== null && bounds.timeToMin !== null && bounds.timeFromMin > bounds.timeToMin) {
    throw paramError('INVALID_RANGE', 'time_from_min no puede ser mayor que time_to_min');
  }
  return bounds;
}

function inDistanceBounds(row, { distanceFromM, distanceToM }) {
  if (distanceFromM === null && distanceToM === null) return true;
  const meters = row.distance_meters;
  if (meters === null || meters === undefined) return false;
  if (distanceFromM !== null && meters < distanceFromM) return false;
  if (distanceToM !== null && meters > distanceToM) return false;
  return true;
}

// El tiempo se compara sobre el TIEMPO LOGRADO (`achievedTimeMs`, el COALESCE de
// active y duration), que es la misma magnitud que usan los KPIs: filtrar por
// `duration_ms` en crudo dejaría fuera series que sí cuentan.
function inTimeBounds(row, { timeFromMin, timeToMin }) {
  if (timeFromMin === null && timeToMin === null) return true;
  const ms = achievedTimeMs(row);
  if (!ms) return false;
  const minutes = ms / 60_000;
  if (timeFromMin !== null && minutes < timeFromMin) return false;
  if (timeToMin !== null && minutes > timeToMin) return false;
  return true;
}

// ---------- filtros de filas ----------

// Recorta el set de series al scope. Es el equivalente del WHERE del DAO: solo
// sesiones cerradas, del equipo/grupo pedido, dentro del rango y — si quien
// llama es un corredor — solo las suyas. El rango de distancia y tiempo se
// aplica AQUÍ, no después de traer la serie.
function selectSeries({ teamId, groupId, fromMs, toMs, athleteIds, exerciseIds, bounds }) {
  const sessionById = new Map(mockSessions.map((session) => [session.id, session]));
  const wanted = athleteIds ? new Set(athleteIds.map(Number)) : null;
  const wantedExercises = exerciseIds && exerciseIds.length ? new Set(exerciseIds.map(Number)) : null;
  const { distanceFromM = null, distanceToM = null, timeFromMin = null, timeToMin = null } = bounds ?? {};
  return mockSeries.filter((row) => {
    const session = sessionById.get(row.session_instance_id);
    if (!session || session.status === 'wip') return false;
    const group = GROUPS.find((candidate) => candidate.id === session.group_id);
    if (!group || group.teamId !== Number(teamId)) return false;
    if (groupId !== null && groupId !== undefined && session.group_id !== Number(groupId)) return false;
    const dateMs = parseISODate(session.date);
    if (dateMs < fromMs || dateMs > toMs) return false;
    if (wanted && !wanted.has(row.athlete_user_id)) return false;
    if (wantedExercises && !wantedExercises.has(row.exercise_id)) return false;
    if (!inDistanceBounds(row, { distanceFromM, distanceToM })) return false;
    if (!inTimeBounds(row, { timeFromMin, timeToMin })) return false;
    return true;
  });
}

function countOpenSessions({ teamId, groupId, fromMs, toMs }) {
  return mockSessions.filter((session) => {
    if (session.status !== 'wip') return false;
    const group = GROUPS.find((candidate) => candidate.id === session.group_id);
    if (!group || group.teamId !== Number(teamId)) return false;
    if (groupId !== null && groupId !== undefined && session.group_id !== Number(groupId)) return false;
    const dateMs = parseISODate(session.date);
    return dateMs >= fromMs && dateMs <= toMs;
  }).length;
}

// ---------- fórmulas (puerto del dominio del backend) ----------

function positiveInt(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function positiveFloat(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function speedFrom(distanceM, durationMs) {
  if (!(distanceM > 0) || !(durationMs > 0)) return null;
  const speed = distanceM / 1000 / (durationMs / MS_PER_HOUR);
  return Number.isFinite(speed) ? speed : null;
}

function achievedTimeMs(row) {
  if (row.active_duration_ms > 0) return row.active_duration_ms;
  return row.duration_ms > 0 ? row.duration_ms : 0;
}

function targetsOf(rowOrExercise) {
  return { minutes: rowOrExercise.target_minutes, distanceM: rowOrExercise.target_distance_m };
}

function achievedOf(row) {
  const timeMs = achievedTimeMs(row);
  const distanceM = positiveFloat(row.distance_meters);
  return { timeMs, distanceM, speedKph: distanceM === null ? null : speedFrom(distanceM, timeMs) };
}

function targetSpeedKph(targets) {
  const distanceM = positiveInt(targets.distanceM);
  const minutes = positiveInt(targets.minutes);
  if (distanceM === null || minutes === null) return null;
  return speedFrom(distanceM, minutes * 60_000);
}

function objectiveAxisForKind(kind, targets) {
  switch (kind) {
    case 'elongacion':
    case 'velocidad_tiempo':
      return 'time';
    case 'velocidad_distancia':
      return 'distance';
    case 'ritmo_continuo':
      return 'distance_and_time';
    case 'liviano': {
      const hasDistance = positiveInt(targets.distanceM) !== null;
      const hasMinutes = positiveInt(targets.minutes) !== null;
      if (hasDistance && hasMinutes) return 'distance_and_time';
      return hasDistance ? 'distance' : 'time';
    }
    default:
      return 'none';
  }
}

function hasTarget(kind, targets) {
  switch (objectiveAxisForKind(kind, targets)) {
    case 'time':
      return positiveInt(targets.minutes) !== null;
    case 'distance':
      return positiveInt(targets.distanceM) !== null;
    case 'distance_and_time':
      return positiveInt(targets.distanceM) !== null && positiveInt(targets.minutes) !== null;
    default:
      return false;
  }
}

function isValidSeries(row) {
  const hasTime = achievedTimeMs(row) > 0;
  const hasDistance = positiveFloat(row.distance_meters) !== null;
  switch (row.kind) {
    case 'liviano':
      return hasTime || hasDistance;
    case 'elongacion':
    case 'velocidad_tiempo':
      return hasTime;
    case 'ritmo_continuo':
      return hasTime && hasDistance;
    case 'velocidad_distancia':
      return hasDistance;
    default:
      return false;
  }
}

function timeQualityOf(row) {
  return row.active_duration_ms > 0 ? 'alta' : 'degraded';
}

function completionTaxonomyOf(row) {
  if (row.completion_status === 'completa') return 'completa';
  if (row.completion_status === 'partial') return 'partial';
  if (row.completion_status === 'skipped') return 'skipped';
  return 'unknown';
}

function timeCriterionMet(targets, achieved, tolerance) {
  const minutes = positiveInt(targets.minutes);
  if (minutes === null || achieved.timeMs <= 0) return false;
  return achieved.timeMs <= minutes * 60_000 * (1 + tolerance);
}

function distanceCriterionMet(targets, achieved, tolerance) {
  const targetM = positiveInt(targets.distanceM);
  const achievedM = positiveFloat(achieved.distanceM);
  if (targetM === null || achievedM === null) return false;
  return achievedM >= targetM * (1 - tolerance);
}

function isCompliant(row, tolerance) {
  const targets = targetsOf(row);
  const achieved = achievedOf(row);
  if (!hasTarget(row.kind, targets)) return false;
  const timeMet = timeCriterionMet(targets, achieved, tolerance);
  const distanceMet = distanceCriterionMet(targets, achieved, tolerance);
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

// El cumplimiento es met/targeted, no met/valid: una serie sin objetivo cargado
// no es "no cumplida", es "no comparable", así que no va en el denominador.
function metTargetOf(row, tolerance) {
  const targets = targetsOf(row);
  if (!hasTarget(row.kind, targets)) return null;
  return isCompliant(row, tolerance);
}

function magnitudesFor(axis, targets, achieved) {
  if (axis === 'time') {
    const minutes = positiveInt(targets.minutes);
    if (minutes === null || achieved.timeMs <= 0) return null;
    return { target: minutes * 60_000, actual: achieved.timeMs };
  }
  if (axis === 'distance') {
    const targetM = positiveInt(targets.distanceM);
    const achievedM = positiveFloat(achieved.distanceM);
    if (targetM === null || achievedM === null) return null;
    return { target: targetM, actual: achievedM };
  }
  if (axis === 'distance_and_time') {
    const targetKph = targetSpeedKph(targets);
    const achievedKph = achieved.speedKph;
    if (targetKph === null || achievedKph === null) return null;
    return { target: targetKph, actual: achievedKph };
  }
  return null;
}

// `null` (y no "unknown") cuando no hay objetivo cargado: es lo que viaja como
// `band: null` en el detalle por serie.
function bandOf(row, tolerance) {
  const targets = targetsOf(row);
  if (!hasTarget(row.kind, targets)) return null;
  const axis = objectiveAxisForKind(row.kind, targets);
  const magnitudes = magnitudesFor(axis, targets, achievedOf(row));
  if (!magnitudes) return 'unknown';
  const { target, actual } = magnitudes;
  if (axis === 'time') {
    if (actual <= target * (1 + tolerance)) return 'met';
    if (actual <= target * (1 + 2 * tolerance)) return 'near';
    return 'missed';
  }
  if (actual >= target * (1 - tolerance)) return 'met';
  if (actual >= target * (1 - 2 * tolerance)) return 'near';
  return 'missed';
}

// Positivo hacia la mejora, con el signo invertido en el eje temporal: 240 s de
// objetivo con 230 s logrados es +4,2 %.
function deltaPctOf(row) {
  const targets = targetsOf(row);
  if (!hasTarget(row.kind, targets)) return null;
  const magnitudes = magnitudesFor(objectiveAxisForKind(row.kind, targets), targets, achievedOf(row));
  if (!magnitudes) return null;
  const axis = objectiveAxisForKind(row.kind, targets);
  const pct = axis === 'time'
    ? ((magnitudes.target - magnitudes.actual) / magnitudes.target) * 100
    : ((magnitudes.actual - magnitudes.target) / magnitudes.target) * 100;
  return Number.isFinite(pct) ? pct : null;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedMean(numerator, denominator) {
  if (!(denominator > 0)) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

// Tercio más reciente contra el más antiguo, sobre la velocidad (siempre "más
// alto es mejor"). `null` con menos de 3 valores: sobre dos puntos es ruido con
// formato de dato.
function trendPctOf(speeds) {
  if (speeds.length < TREND_MIN_SERIES) return null;
  const third = Math.floor(speeds.length / TREND_MIN_SERIES);
  const oldest = mean(speeds.slice(0, third));
  const newest = mean(speeds.slice(speeds.length - third));
  if (!(oldest > 0)) return null;
  const pct = ((newest - oldest) / oldest) * 100;
  return Number.isFinite(pct) ? pct : null;
}

function trendVerdict(pct) {
  if (pct === null || pct === undefined) return 'stable';
  if (pct > TREND_THRESHOLD_PCT) return 'improving';
  if (pct < -TREND_THRESHOLD_PCT) return 'regressing';
  return 'stable';
}

// σ poblacional / μ sobre la velocidad de las series válidas. `null` con menos de
// dos valores: con una sola serie la dispersión es cero por definición y
// reportarla sería decir "consistencia perfecta" sobre un punto.
function coefficientOfVariation(speeds) {
  const values = speeds.filter((speed) => speed > 0);
  if (values.length < 2) return null;
  const mu = mean(values);
  if (!(mu > 0)) return null;
  const variance = values.reduce((sum, speed) => sum + (speed - mu) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mu;
  return Number.isFinite(cv) ? cv : null;
}

// Los acumulados que comparten el resumen, el timeseries, el leaderboard, las
// comparaciones y el detalle por serie (setMetrics en aggregate.go).
function metricsOf(rows) {
  const metrics = {
    sessions: 0,
    totalSeries: rows.length,
    validSeries: 0,
    targetedCount: 0,
    totalDistanceM: 0,
    totalTimeMs: 0,
    sumTargetTimeMs: 0,
    sumTargetDistanceM: 0,
    weightedSpeedNum: 0,
    weightedSpeedDen: 0,
    weightedTargetNum: 0,
    weightedTargetDen: 0,
    bestTimeMs: null,
    speeds: [],
    validRows: [],
    kinds: new Set(),
    firstTargets: new Map(),
  };
  const sessionIds = new Set();

  rows.forEach((row) => {
    sessionIds.add(row.session_instance_id);
    if (CURRENT_KINDS.includes(row.kind)) {
      metrics.kinds.add(row.kind);
      if (!metrics.firstTargets.has(row.kind)) metrics.firstTargets.set(row.kind, targetsOf(row));
    }
    if (!isValidSeries(row)) return;
    const achieved = achievedOf(row);
    metrics.validSeries += 1;
    metrics.validRows.push(row);
    metrics.totalDistanceM += achieved.distanceM ?? 0;
    metrics.totalTimeMs += achieved.timeMs;
    if (achieved.speedKph !== null) {
      metrics.weightedSpeedNum += (achieved.distanceM ?? 0) * achieved.speedKph;
      metrics.weightedSpeedDen += achieved.distanceM ?? 0;
      metrics.speeds.push(achieved.speedKph);
    }
    if (achieved.timeMs > 0 && (metrics.bestTimeMs === null || achieved.timeMs < metrics.bestTimeMs)) {
      metrics.bestTimeMs = achieved.timeMs;
    }
  });

  metrics.sessions = sessionIds.size;
  metrics.targetedRows = () => metrics.validRows.filter((row) => hasTarget(row.kind, targetsOf(row)));
  metrics.targetedRows().forEach((row) => {
    const targets = targetsOf(row);
    metrics.targetedCount += 1;
    metrics.sumTargetTimeMs += (positiveInt(targets.minutes) ?? 0) * 60_000;
    metrics.sumTargetDistanceM += positiveInt(targets.distanceM) ?? 0;
    const targetKph = targetSpeedKph(targets);
    if (targetKph !== null) {
      const distanceM = positiveInt(targets.distanceM) ?? 0;
      metrics.weightedTargetNum += distanceM * targetKph;
      metrics.weightedTargetDen += distanceM;
    }
  });

  return metrics;
}

function achievedSpeedKph(metrics) {
  return weightedMean(metrics.weightedSpeedNum, metrics.weightedSpeedDen);
}

function targetSpeedOf(metrics) {
  return weightedMean(metrics.weightedTargetNum, metrics.weightedTargetDen);
}

function complianceRateOf(metrics, tolerance) {
  if (metrics.targetedCount === 0) return null;
  const met = metrics.validRows.filter((row) => isCompliant(row, tolerance)).length;
  return (met / metrics.targetedCount) * 100;
}

// El eje lo declara el tipo, y existe aunque no haya objetivo: un
// `velocidad_distancia` sin distancia sigue siendo eje "distance" con
// `has_target: false`. `none` solo aparece sin ningún tipo vigente en el set.
function axisAndHasTarget(metrics) {
  if (metrics.kinds.size === 0) return { axis: 'none', hasTarget: false };
  if (metrics.kinds.size === 1) {
    const kind = [...metrics.kinds][0];
    return {
      axis: objectiveAxisForKind(kind, metrics.firstTargets.get(kind)),
      hasTarget: metrics.targetedCount > 0,
    };
  }
  return { axis: 'distance_and_time', hasTarget: metrics.targetedCount > 0 };
}

function deltaOf(metrics, axis) {
  if (!axisAndHasTarget(metrics).hasTarget) return null;
  let target = 0;
  let actual = 0;
  if (axis === 'time') {
    target = metrics.sumTargetTimeMs;
    actual = metrics.targetedRows().reduce((sum, row) => sum + achievedTimeMs(row), 0);
  } else if (axis === 'distance') {
    target = metrics.sumTargetDistanceM;
    actual = metrics.targetedRows().reduce((sum, row) => sum + (positiveFloat(row.distance_meters) ?? 0), 0);
  } else if (axis === 'distance_and_time') {
    const targetKph = targetSpeedOf(metrics);
    const achievedKph = achievedSpeedKph(metrics);
    if (targetKph === null || achievedKph === null) return null;
    target = targetKph;
    actual = achievedKph;
  } else {
    return null;
  }
  if (!(target > 0)) return null;
  const pct = axis === 'time'
    ? -(((actual - target) / target) * 100)
    : ((actual - target) / target) * 100;
  return Number.isFinite(pct) ? pct : null;
}

function dataQualityOf(rows, openSessions) {
  const quality = {
    invalid_series: 0,
    degraded_time: 0,
    unknown_status: 0,
    open_sessions: openSessions,
    legacy_sessions: 0,
    insufficient_data: false,
  };
  rows.forEach((row) => {
    const valid = isValidSeries(row);
    if (!valid) quality.invalid_series += 1;
    if (timeQualityOf(row) === 'degraded') quality.degraded_time += 1;
    if (completionTaxonomyOf(row) === 'unknown') quality.unknown_status += 1;
    if (valid && !row.has_runner_session) quality.legacy_sessions += 1;
  });
  quality.insufficient_data = validSpeedsOf(rows).length < TREND_MIN_SERIES;
  return quality;
}

function validSpeedsOf(rows) {
  return rows.filter(isValidSeries).map((row) => achievedOf(row).speedKph).filter((speed) => speed !== null);
}

function bandCountsOf(rows, tolerance) {
  const counts = { met: 0, near: 0, missed: 0, unknown: 0 };
  rows.forEach((row) => {
    const band = bandOf(row, tolerance);
    if (band === null) return;
    counts[band] += 1;
  });
  return counts;
}

// ---------- armado de respuestas ----------

function buildSummary(rows, tolerance, openSessions) {
  const metrics = metricsOf(rows);
  const { axis, hasTarget } = axisAndHasTarget(metrics);
  const totals = {
    sessions: metrics.sessions,
    series: metrics.totalSeries,
    valid_series: metrics.validSeries,
    distance_m: null,
    time_ms: null,
    achieved_speed_kph: achievedSpeedKph(metrics),
    target_speed_kph: null,
    delta_pct: null,
    compliance_rate: complianceRateOf(metrics, tolerance),
    best_time_ms: metrics.bestTimeMs,
  };
  if (metrics.validSeries > 0) {
    totals.distance_m = metrics.totalDistanceM;
    totals.time_ms = metrics.totalTimeMs;
  }
  if (hasTarget) {
    totals.target_speed_kph = targetSpeedOf(metrics);
    totals.delta_pct = deltaOf(metrics, axis);
  }
  const trend = trendPctOf(metrics.speeds);
  return {
    axis,
    has_target: hasTarget,
    units: UNITS,
    totals,
    consistency: { cv: coefficientOfVariation(metrics.speeds) },
    trend: { trend_pct: trend, verdict: trendVerdict(trend) },
    tolerance_applied: tolerance,
    series_count: metrics.validSeries,
    data_quality: dataQualityOf(rows, openSessions),
  };
}

function bucketStartOf(dateMs, granularity) {
  const date = new Date(dateMs);
  if (granularity === 'week') {
    // Lunes ISO 8601 (getUTCDay da domingo = 0).
    return dateMs - (((date.getUTCDay() + 6) % 7) * DAY_MS);
  }
  if (granularity === 'month') return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (granularity === 'quarter') {
    return Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1);
  }
  return dateMs;
}

function buildTimeseries(rows, granularity, tolerance, openSessions) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = formatISODate(bucketStartOf(parseISODate(row.session_date), granularity));
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });
  const keys = [...grouped.keys()].sort();

  const buckets = keys.map((key) => {
    const bucketRows = grouped.get(key);
    const metrics = metricsOf(bucketRows);
    const { axis, hasTarget } = axisAndHasTarget(metrics);
    const bucket = {
      period_start: key,
      sessions: metrics.sessions,
      series: metrics.totalSeries,
      valid_series: metrics.validSeries,
      achieved_speed_kph: achievedSpeedKph(metrics),
      target_speed_kph: null,
      delta_pct: null,
      compliance_rate: complianceRateOf(metrics, tolerance),
      best_time_ms: metrics.bestTimeMs,
      // Con `has_target: false` las cuatro bandas quedan en cero, y vienen igual
      // presentes para que el gráfico de barras pueda pintar la estructura.
      band_counts: bandCountsOf(bucketRows, tolerance),
    };
    if (hasTarget) {
      bucket.target_speed_kph = targetSpeedOf(metrics);
      bucket.delta_pct = deltaOf(metrics, axis);
    }
    return bucket;
  });

  return { granularity, units: UNITS, buckets, data_quality: dataQualityOf(rows, openSessions) };
}

function leaderboardEntryOf(athleteUserId, rows, tolerance) {
  const metrics = metricsOf(rows);
  const athlete = ATHLETES.find((candidate) => candidate.id === athleteUserId);
  return {
    athleteUserId,
    name: athlete?.name ?? '',
    surname: athlete?.surname ?? '',
    sessions: metrics.sessions,
    bestTimeMs: metrics.bestTimeMs,
    meanSpeedKph: achievedSpeedKph(metrics),
    totalDistanceM: metrics.validSeries > 0 ? metrics.totalDistanceM : null,
    complianceRate: complianceRateOf(metrics, tolerance),
  };
}

function comparableValue(entry, sort) {
  switch (sort) {
    case 'best_time_ms':
      return entry.bestTimeMs === null ? null : entry.bestTimeMs;
    case 'mean_speed_kph':
      return entry.meanSpeedKph;
    case 'total_distance_m':
      return entry.totalDistanceM;
    case 'compliance_rate':
      return entry.complianceRate;
    default:
      return null;
  }
}

// Comparador único: lo usan el orden de la página y el cálculo de `position`,
// así que no pueden divergir. Sin dato va al final en cualquier sentido.
function lessLeaderboardEntry(a, b, sort, order) {
  const tie = () => {
    if (a.bestTimeMs !== null && b.bestTimeMs !== null && a.bestTimeMs !== b.bestTimeMs) {
      return a.bestTimeMs < b.bestTimeMs;
    }
    if (a.totalDistanceM !== null && b.totalDistanceM !== null && a.totalDistanceM !== b.totalDistanceM) {
      return a.totalDistanceM > b.totalDistanceM;
    }
    if (a.name !== b.name) return a.name < b.name;
    if (a.surname !== b.surname) return a.surname < b.surname;
    return a.athleteUserId < b.athleteUserId;
  };
  const av = comparableValue(a, sort);
  const bv = comparableValue(b, sort);
  if (av !== null && bv !== null) {
    if (av === bv) return tie();
    return order === 'desc' ? av > bv : av < bv;
  }
  if (av !== null) return true;
  if (bv !== null) return false;
  return tie();
}

function buildLeaderboard(rows, { sort, order, page, pageSize, callerUserId }, tolerance, openSessions) {
  const byAthlete = new Map();
  rows.forEach((row) => {
    byAthlete.set(row.athlete_user_id, [...(byAthlete.get(row.athlete_user_id) ?? []), row]);
  });
  const sorted = [...byAthlete.keys()]
    .sort((a, b) => a - b)
    .map((athleteUserId) => leaderboardEntryOf(athleteUserId, byAthlete.get(athleteUserId), tolerance))
    // -1/1 y no el booleano del comparador: Array.sort espera un número, y
    // `false` en vez de un número negativo significa "empate", con lo que el
    // orden original se preserva y el ranking no se ordena.
    .sort((a, b) => (lessLeaderboardEntry(a, b, sort, order) ? -1 : 1));

  // Semántica de RANK() sobre TODAS las entradas: los empates comparten posición
  // y la siguiente la salta. "Sin dato" es un estado aparte del valor, así que
  // dos filas consecutivas sin dato también comparten posición.
  const positions = new Map();
  let position = 0;
  let previousValue = null;
  let previousMissing = false;
  sorted.forEach((entry, index) => {
    const value = comparableValue(entry, sort);
    const missing = value === null;
    if (index === 0 || previousMissing !== missing || previousValue !== value) position = index + 1;
    positions.set(entry.athleteUserId, position);
    previousValue = value;
    previousMissing = missing;
  });

  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const items = [];
  for (let index = start; index < total && index < start + pageSize; index += 1) {
    const entry = sorted[index];
    items.push({
      rank: index - start + 1,
      position: positions.get(entry.athleteUserId),
      athlete_user_id: entry.athleteUserId,
      name: entry.name,
      surname: entry.surname,
      sessions: entry.sessions,
      best_time_ms: entry.bestTimeMs,
      mean_speed_kph: entry.meanSpeedKph,
      total_distance_m: entry.totalDistanceM,
      compliance_rate: entry.complianceRate,
      is_self: String(entry.athleteUserId) === String(callerUserId),
    });
  }

  return {
    items,
    page,
    page_size: pageSize,
    total,
    sort,
    order,
    units: UNITS,
    data_quality: dataQualityOf(rows, openSessions),
  };
}

function buildSeriesDetail(rows, tolerance, page, pageSize, quality) {
  const metrics = metricsOf(rows);
  const { axis, hasTarget } = axisAndHasTarget(metrics);
  const total = rows.length;
  const items = [];
  const start = (page - 1) * pageSize;
  for (let index = start; index < total && index < start + pageSize; index += 1) {
    const row = rows[index];
    const achieved = achievedOf(row);
    items.push({
      session_instance_id: row.session_instance_id,
      session_date: row.session_date,
      athlete_user_id: row.athlete_user_id,
      feedback_owner_user_id: row.feedback_owner_user_id,
      set_number: row.set_number,
      duration_ms: row.duration_ms,
      active_duration_ms: row.active_duration_ms,
      time_quality: timeQualityOf(row),
      distance_meters: row.distance_meters,
      speed_kph: achieved.speedKph,
      target_minutes: row.target_minutes,
      target_distance_m: row.target_distance_m,
      met_target: metTargetOf(row, tolerance),
      delta_pct: deltaPctOf(row),
      completion_status: row.completion_status,
      band: bandOf(row, tolerance),
      tolerance_applied: tolerance,
    });
  }
  return {
    axis,
    has_target: hasTarget,
    items,
    page,
    page_size: pageSize,
    total,
    series_count: metrics.validSeries,
    units: UNITS,
    data_quality: quality,
  };
}

function buildComparisons(rows, tolerance, quality) {
  const byAthlete = new Map();
  rows.forEach((row) => {
    byAthlete.set(row.athlete_user_id, [...(byAthlete.get(row.athlete_user_id) ?? []), row]);
  });
  const series = [...byAthlete.keys()].sort((a, b) => a - b).map((athleteUserId) => {
    const athlete = ATHLETES.find((candidate) => candidate.id === athleteUserId);
    const metrics = metricsOf(byAthlete.get(athleteUserId));
    const trend = trendPctOf(metrics.speeds);
    return {
      athlete_user_id: athleteUserId,
      name: athlete?.name ?? '',
      surname: athlete?.surname ?? '',
      sessions: metrics.sessions,
      valid_series: metrics.validSeries,
      best_time_ms: metrics.bestTimeMs,
      mean_speed_kph: achievedSpeedKph(metrics),
      total_distance_m: metrics.validSeries > 0 ? metrics.totalDistanceM : null,
      compliance_rate: complianceRateOf(metrics, tolerance),
      trend: { trend_pct: trend, verdict: trendVerdict(trend) },
    };
  });
  return { series, units: UNITS, data_quality: quality };
}

function relativePct(current, previous) {
  if (current === null || previous === null || !(previous > 0)) return null;
  const pct = ((current - previous) / previous) * 100;
  return Number.isFinite(pct) ? pct : null;
}

// previous contra current: bajar el tiempo es mejorar, así que el signo ya viene
// invertido de antemano.
function relativePctMs(previous, current) {
  if (previous === null || current === null || !(previous > 0)) return null;
  const pct = ((previous - current) / previous) * 100;
  return Number.isFinite(pct) ? pct : null;
}

function subtractPercentages(current, previous) {
  if (current === null || previous === null) return null;
  return current - previous;
}

function periodMetricsOf(fromMs, toMs, metrics, tolerance) {
  return {
    from: formatISODate(fromMs),
    to: formatISODate(toMs),
    series: metrics.totalSeries,
    valid_series: metrics.validSeries,
    total_distance_m: metrics.validSeries > 0 ? metrics.totalDistanceM : null,
    mean_speed_kph: achievedSpeedKph(metrics),
    compliance_rate: complianceRateOf(metrics, tolerance),
    best_time_ms: metrics.bestTimeMs,
  };
}

function buildPeriods({ current, previous, currentRows, previousRows }, tolerance, quality) {
  const currentMetrics = metricsOf(currentRows);
  const previousMetrics = metricsOf(previousRows);
  const response = {
    current: periodMetricsOf(current.fromMs, current.toMs, currentMetrics, tolerance),
    previous: null,
    delta: null,
    verdict: 'stable',
    units: UNITS,
    data_quality: quality,
  };
  // Sin series válidas en alguno de los dos períodos no hay comparación que
  // hacer: presentar eso como "estable" sería mentir.
  if (currentMetrics.validSeries === 0 || previousMetrics.validSeries === 0) return response;

  response.previous = periodMetricsOf(previous.fromMs, previous.toMs, previousMetrics, tolerance);
  const compliancePP = subtractPercentages(
    complianceRateOf(currentMetrics, tolerance),
    complianceRateOf(previousMetrics, tolerance),
  );
  response.delta = {
    series: currentMetrics.validSeries - previousMetrics.validSeries,
    distance_pct: relativePct(currentMetrics.totalDistanceM, previousMetrics.totalDistanceM),
    speed_pct: relativePct(achievedSpeedKph(currentMetrics), achievedSpeedKph(previousMetrics)),
    compliance_pp: compliancePP,
    best_time_pct: relativePctMs(previousMetrics.bestTimeMs, currentMetrics.bestTimeMs),
  };
  response.verdict = compliancePP === null
    ? 'stable'
    : compliancePP > PERIODS_THRESHOLD_PP
      ? 'improving'
      : compliancePP < -PERIODS_THRESHOLD_PP
        ? 'regressing'
        : 'stable';
  return response;
}

// ---------- endpoints ----------

export async function mockGetDashboardFilters({ teamId, callerUserId } = {}) {
  const team = requireScope(teamId, callerUserId);
  const isOwner = ownsTeam(team.id, callerUserId);
  const groups = GROUPS.filter((group) => group.teamId === team.id);
  // El roster es el de los grupos DEL EQUIPO: un equipo sin grupos no tiene
  // corredores, aunque el catálogo mock los tenga todos.
  const groupIds = new Set(groups.map((group) => group.id));
  const athletes = ATHLETES.filter((athlete) => groupIds.has(athlete.groupId))
    .filter((athlete) => isOwner || String(athlete.id) === String(callerUserId));
  const scopedDates = rowsInTeam(team.id).map((row) => row.session_date).sort();

  return {
    teams: [{ id: team.id, name: team.name }],
    groups: groups.map((group) => ({ id: group.id, team_id: group.teamId, name: group.name, role: isOwner ? 'owner' : 'member' })),
    athletes: athletes.map((athlete) => ({ id: athlete.id, name: athlete.name, surname: athlete.surname })),
    exercise_types: [...CURRENT_KINDS],
    exercises: EXERCISES.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      kind: exercise.kind,
      current_target_minutes: exercise.currentTargetMinutes,
      current_target_distance_m: exercise.currentTargetDistanceM,
    })),
    // null —no {min: null, max: null}— cuando el scope no tiene ninguna sesión
    // registrada: el front usa ese null para distinguir "nunca hubo datos" de
    // "hay datos acotados".
    date_range: scopedDates.length ? { min: scopedDates[0], max: scopedDates[scopedDates.length - 1] } : null,
  };
}

// Roster del grupo para elegir atletas sin ofrecer combinaciones group/athlete
// que el backend luego rechazaría. El dashboard mock tiene sus propios IDs de
// grupos, independientes de los mocks del CRUD de grupos.
export async function mockGetDashboardGroupAthletes({ teamId, groupId, callerUserId } = {}) {
  requireGroup(teamId, groupId, callerUserId);
  const owner = ownsTeam(teamId, callerUserId);
  return ATHLETES
    .filter((athlete) => athlete.groupId === Number(groupId))
    .filter((athlete) => owner || String(athlete.id) === String(callerUserId))
    .map((athlete) => athlete.id);
}

function rowsInTeam(teamId) {
  const sessionById = new Map(mockSessions.map((session) => [session.id, session]));
  return mockSeries.filter((row) => {
    const session = sessionById.get(row.session_instance_id);
    if (!session || session.status === 'wip') return false;
    const group = GROUPS.find((candidate) => candidate.id === session.group_id);
    return Boolean(group) && group.teamId === Number(teamId);
  });
}

// Recorta el scope una vez y devuelve todo lo que los endpoints de métricas
// necesitan: la tolerancia validada, el rango, las filas del recorte y las
// sesiones sin cerrar del mismo recorte.
function metricsScope(filters) {
  requireGroup(filters.teamId, filters.groupId, filters.callerUserId);
  const tolerance = resolveToleranceParam(filters.tolerance);
  const range = resolveRange(filters.from, filters.to);
  const exerciseIds = resolveExerciseFilter(filters);
  const bounds = resolveRangeBounds(filters);
  const scope = {
    teamId: filters.teamId,
    groupId: filters.groupId,
    fromMs: range.fromMs,
    toMs: range.toMs,
  };
  return {
    tolerance,
    range,
    rows: selectSeries({ ...scope, athleteIds: athleteIdsFor(filters), exerciseIds, bounds }),
    openSessions: countOpenSessions(scope),
  };
}

export async function mockGetDashboardSummary(filters = {}) {
  const { tolerance, rows, openSessions } = metricsScope(filters);
  return buildSummary(rows, tolerance, openSessions);
}

export async function mockGetDashboardTimeseries(filters = {}) {
  const granularity = resolveGranularity(filters.granularity);
  const { tolerance, rows, openSessions } = metricsScope(filters);
  return buildTimeseries(rows, granularity, tolerance, openSessions);
}

export async function mockGetDashboardLeaderboard(filters = {}) {
  requireOwnership(filters.teamId, filters.callerUserId);
  const tolerance = resolveToleranceParam(filters.tolerance);
  const range = resolveRange(filters.from, filters.to);
  const sort = resolveSort(filters.sort);
  const order = resolveOrder(filters.order);
  const { page, pageSize } = resolvePaging(filters.page, filters.pageSize);
  const exerciseIds = resolveExerciseFilter(filters);
  const bounds = resolveRangeBounds(filters);
  const scope = { teamId: filters.teamId, groupId: filters.groupId, fromMs: range.fromMs, toMs: range.toMs };
  // El ranking es siempre de todo el equipo, nunca de un recorte por corredor:
  // el DAO no recibe athlete_user_ids en este endpoint.
  const rows = selectSeries({ ...scope, athleteIds: null, exerciseIds, bounds });
  return buildLeaderboard(
    rows,
    { sort, order, page, pageSize, callerUserId: filters.callerUserId },
    tolerance,
    countOpenSessions(scope),
  );
}

export async function mockGetDashboardExerciseSeries(filters = {}) {
  requireGroup(filters.teamId, filters.groupId, filters.callerUserId);
  const tolerance = resolveToleranceParam(filters.tolerance);
  const range = resolveRange(filters.from, filters.to);
  const { page, pageSize } = resolvePaging(filters.page, filters.pageSize);
  const exerciseId = Number(filters.exerciseId);
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
    throw paramError('INVALID_RANGE', 'el id del ejercicio debe ser un entero mayor a cero');
  }
  if (!EXERCISE_BY_ID.has(exerciseId)) throw notFound('No encontramos ese ejercicio');

  const rows = selectSeries({
    teamId: filters.teamId,
    groupId: filters.groupId,
    fromMs: range.fromMs,
    toMs: range.toMs,
    athleteIds: athleteIdsFor(filters),
    bounds: resolveRangeBounds(filters),
  }).filter((row) => row.exercise_id === exerciseId);
  const quality = dataQualityOf(rows, countOpenSessions({
    teamId: filters.teamId,
    groupId: filters.groupId,
    fromMs: range.fromMs,
    toMs: range.toMs,
  }));
  return buildSeriesDetail(rows, tolerance, page, pageSize, quality);
}

export async function mockPostDashboardComparisons(filters = {}) {
  requireOwnership(filters.teamId, filters.callerUserId);
  const tolerance = resolveToleranceParam(filters.tolerance);
  const range = resolveRange(filters.from, filters.to);
  const exerciseIds = resolveExerciseFilter(filters);
  const bounds = resolveRangeBounds(filters);

  // Cada athlete_user_id se valida por separado: uno fuera de scope responde 403
  // nombrándolo, sin devolver los datos de los válidos.
  const scopeAthletes = ATHLETES.map((athlete) => athlete.id);
  const requested = filters.athleteUserIds ?? [];
  requested.forEach((athleteUserId) => {
    if (!scopeAthletes.includes(Number(athleteUserId))) {
      throw dashboardError(403, 'ATHLETE_OUT_OF_SCOPE', `El corredor ${athleteUserId} no está entre los que podés ver`);
    }
  });

  const scope = { teamId: filters.teamId, groupId: filters.groupId, fromMs: range.fromMs, toMs: range.toMs };
  const rows = selectSeries({ ...scope, athleteIds: requested.length ? requested.map(Number) : null, exerciseIds, bounds });
  return buildComparisons(rows, tolerance, dataQualityOf(rows, countOpenSessions(scope)));
}

export async function mockPostDashboardPeriods(filters = {}) {
  requireOwnership(filters.teamId, filters.callerUserId);
  const tolerance = resolveToleranceParam(filters.tolerance);
  const exerciseIds = resolveExerciseFilter(filters);
  const bounds = resolveRangeBounds(filters);

  const current = resolveRange(filters.current?.from, filters.current?.to);
  // Sin `previous`, el backend lo deriva desplazando `current` hacia atrás
  // exactamente su misma cantidad de días.
  const previous = filters.previous
    ? resolveRange(filters.previous.from, filters.previous.to)
    : derivePreviousPeriod(current);

  const select = (range) => selectSeries({
    teamId: filters.teamId,
    groupId: filters.groupId,
    fromMs: range.fromMs,
    toMs: range.toMs,
    athleteIds: null,
    exerciseIds,
    bounds,
  });
  const currentRows = select(current);
  const previousRows = select(previous);
  return buildPeriods(
    { current, previous, currentRows, previousRows },
    tolerance,
    // El data_quality de la respuesta es el del período actual: es el que la
    // pantalla muestra junto a los KPIs que está mirando.
    dataQualityOf(currentRows, countOpenSessions({
      teamId: filters.teamId,
      groupId: filters.groupId,
      fromMs: current.fromMs,
      toMs: current.toMs,
    })),
  );
}

export async function mockPostDashboardSessionComparison(request = {}) {
  const teamId = request.team_id;
  const callerUserId = request.callerUserId;
  requireScope(teamId, callerUserId);
  const range = resolveRange(request.from, request.to);
  const a = mockSessionComparisonSide(request.a, teamId, callerUserId, range);
  const b = mockSessionComparisonSide(request.b, teamId, callerUserId, range);

  const speedDeltaKph = a.mean_speed_kph === null || b.mean_speed_kph === null
    ? null
    : b.mean_speed_kph - a.mean_speed_kph;
  const speedDeltaPct = speedDeltaKph === null || !(a.mean_speed_kph > 0)
    ? null
    : (speedDeltaKph / a.mean_speed_kph) * 100;
  const distanceDeltaM = a.total_distance_m === null || b.total_distance_m === null
    ? null
    : b.total_distance_m - a.total_distance_m;

  return {
    a,
    b,
    delta: {
      direction: 'b_minus_a',
      speed_delta_kph: speedDeltaKph,
      speed_delta_pct: speedDeltaPct,
      distance_delta_m: distanceDeltaM,
    },
    units: { duration: 'ms', distance: 'm', speed: 'km/h', rpe: '1-10' },
  };
}

function mockSessionComparisonSide(ref, teamId, callerUserId, range) {
  const ids = ['group_id', 'athlete_user_id', 'session_instance_id', 'exercise_id'];
  if (!ref || ids.some((key) => !Number.isInteger(Number(ref[key])) || Number(ref[key]) <= 0)) {
    throw paramError('INVALID_REQUEST', 'cada lado requiere IDs positivos');
  }
  requireGroup(teamId, ref.group_id, callerUserId);
  const owner = ownsTeam(teamId, callerUserId);
  if (!owner && String(ref.athlete_user_id) !== String(callerUserId)) {
    throw forbidden('Un corredor solo puede comparar sus propias sesiones');
  }

  const group = GROUPS.find((candidate) => candidate.id === Number(ref.group_id));
  const athlete = ATHLETES.find((candidate) => (
    candidate.id === Number(ref.athlete_user_id) && candidate.groupId === Number(ref.group_id)
  ));
  if (!athlete) throw forbidden('El corredor no pertenece al grupo seleccionado');
  const exercise = EXERCISE_BY_ID.get(Number(ref.exercise_id));
  if (!exercise) throw notFound('No encontramos ese ejercicio');
  if (!['ritmo_continuo', 'velocidad_distancia', 'velocidad_tiempo'].includes(exercise.kind)) {
    throw notFound('El ejercicio no es un bloque principal comparable');
  }
  const session = mockSessions.find((candidate) => candidate.id === Number(ref.session_instance_id));
  if (!session || session.group_id !== Number(ref.group_id) || session.status === 'wip') {
    throw notFound('No encontramos esa sesión ejecutada');
  }
  const dateMs = parseISODate(session.date);
  if (dateMs < range.fromMs || dateMs > range.toMs) throw notFound('La sesión está fuera del rango aplicado');

  const rows = mockSeries.filter((row) => (
    row.session_instance_id === session.id &&
    row.athlete_user_id === Number(ref.athlete_user_id) &&
    row.exercise_id === exercise.id
  ));
  if (!rows.length) throw notFound('La sesión no contiene series de ese ejercicio');

  const metrics = metricsOf(rows);
  const distanceRows = metrics.validRows.filter((row) => positiveFloat(row.distance_meters) !== null);
  const rpeRows = rows.filter((row) => Number.isInteger(row.rpe) && row.rpe >= 1 && row.rpe <= 10);
  const meanRpe = rpeRows.length
    ? rpeRows.reduce((sum, row) => sum + row.rpe, 0) / rpeRows.length
    : null;
  const extremes = mockSessionComparisonExtremes(rows, exercise.kind);

  return {
    team_id: Number(teamId),
    group_id: group.id,
    group_name: group.name,
    athlete_user_id: athlete.id,
    athlete_name: athlete.name,
    athlete_surname: athlete.surname,
    session_instance_id: session.id,
    session_date: session.date,
    exercise_id: exercise.id,
    exercise_name: exercise.name,
    kind: exercise.kind,
    series_count: rows.length,
    valid_series: metrics.validSeries,
    total_distance_m: distanceRows.length ? metrics.totalDistanceM : null,
    mean_speed_kph: achievedSpeedKph(metrics),
    mean_rpe: meanRpe,
    rpe_count: rpeRows.length,
    best: extremes.best,
    worst: extremes.worst,
    series: rows
      .slice()
      .sort((left, right) => left.set_number - right.set_number || left.feedback_id - right.feedback_id)
      .map(mockSessionComparisonPoint),
  };
}

function mockSessionComparisonPoint(row) {
  return {
    feedback_id: row.feedback_id,
    set_number: row.set_number,
    duration_ms: row.duration_ms,
    active_duration_ms: row.active_duration_ms,
    distance_meters: row.distance_meters,
    speed_kph: achievedOf(row).speedKph,
    target_minutes: row.target_minutes,
    target_distance_m: row.target_distance_m,
    rpe: row.rpe,
  };
}

function mockSessionComparisonExtremes(rows, kind) {
  const candidates = rows.filter((row) => {
    if (!isValidSeries(row)) return false;
    if (kind === 'ritmo_continuo') return achievedTimeMs(row) > 0;
    if (kind === 'velocidad_distancia') return achievedOf(row).speedKph !== null;
    return positiveFloat(row.distance_meters) !== null;
  });
  const valueOf = (row) => {
    if (kind === 'ritmo_continuo') return achievedTimeMs(row);
    if (kind === 'velocidad_distancia') return achievedOf(row).speedKph;
    return row.distance_meters;
  };
  const preferLower = kind === 'ritmo_continuo';
  const ordered = candidates.slice().sort((left, right) => {
    const difference = valueOf(left) - valueOf(right);
    if (difference !== 0) return preferLower ? difference : -difference;
    return left.session_date.localeCompare(right.session_date) || left.set_number - right.set_number || left.feedback_id - right.feedback_id;
  });
  return {
    best: ordered.length ? mockSessionComparisonPoint(ordered[0]) : null,
    worst: ordered.length ? mockSessionComparisonPoint(ordered[ordered.length - 1]) : null,
  };
}

function derivePreviousPeriod(current) {
  const length = daysBetween(current.fromMs, current.toMs) + 1;
  return { fromMs: current.fromMs - length * DAY_MS, toMs: current.toMs - length * DAY_MS };
}

// Un corredor solo ve las suyas: es el recorte que hace el DAO cuando quien
// llama no es dueño del equipo.
function athleteIdsFor(filters) {
  const owns = ownsTeam(filters.teamId, filters.callerUserId);
  // El dueño ve todo el equipo; un corredor solo su propia entrada. `null` es
  // "sin recorte por corredor" (el dueño sin filtro), no una lista vacía.
  const scoped = owns
    ? ATHLETES.map((athlete) => athlete.id)
    : ATHLETES.some((athlete) => String(athlete.id) === String(filters.callerUserId))
      ? [Number(filters.callerUserId)]
      : [];
  const requested = filters.athleteUserId;
  if (requested === null || requested === undefined || requested === '') {
    return owns ? null : scoped;
  }
  const athleteId = Number(requested);
  if (!scoped.includes(athleteId)) {
    throw dashboardError(403, 'ATHLETE_OUT_OF_SCOPE', `El corredor ${athleteId} no está entre los que podés ver`);
  }
  return [athleteId];
}

// ---------- helpers de test ----------

// Las filas crudas del seed, para que el test verifique la coherencia de cada
// respuesta contra los datos de ENTRADA y no contra los mismos números que el
// mock acaba de calcular.
export function __getMockDashboardSeed() {
  return {
    series: mockSeries.map((row) => ({ ...row })),
    sessions: mockSessions.map((session) => ({ ...session })),
    athletes: ATHLETES.map((athlete) => ({ ...athlete })),
    exercises: EXERCISES.map((exercise) => ({ ...exercise })),
    teams: TEAMS.map((team) => ({ ...team })),
    groups: GROUPS.map((group) => ({ ...group })),
    today: mockToday,
  };
}

export function __setMockDashboardToday(iso) {
  mockToday = iso;
  mockSessions = SESSION_PLAN.map((session, index) => ({
    id: FIRST_SESSION_ID + index,
    date: sessionDateOf(session.daysAgo),
    group_id: session.groupId,
    status: session.status ?? 'finished',
  }));
  mockSeries = buildSeedSeries();
}

export function __resetMockDashboard() {
  rebuildSeed();
}
