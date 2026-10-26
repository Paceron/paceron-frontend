import { __countFinishedRunnerSessionsByCompetition, __listRunnerSessionsByCompetitionAndAthlete } from './runner-session-mock.js';
import { __getMockFeedbacks, __getMockPoints } from './workoutFeedback-mock.js';
import { computeRouteComplianceRatio, pickBestAttempt } from '../../utils/route-geometry.js';
import { addDaysISO } from '../../utils/build-stamp-draft.js';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

// Fixture CRUD mutable para EXPO_PUBLIC_USE_MOCKS=true (Gap 33) -- mismo
// patrón que services/__mocks__/team-subscriptions-mock.js: estado en
// memoria + __resetMockCompetitions() para tests. 3 competencias seed con
// 3 estados distintos (active/pending_approval/finished) para poder ver
// toda la matriz de acciones sin tener que crear nada a mano primero.
// Sin `name` a propósito -- confirmado 2026-10-14 que el backend real no
// tiene esa columna (decisión D8); el mock ejercita el mismo fallback de
// título (utils/competition-title.js) que usará la UI contra datos
// reales, en vez de inventar un campo que no existe.
// Seeds 4, 5 y 6 -- team_id 5 ("Atletas del Río"), el único equipo donde
// user_id 1 (demo@paceron.com) es corredor de verdad y no dueño (ver
// services/__mocks__/teams-mock.js) -- necesarias para poder probar Spec
// 4b (wiring de competition_id en Play/ingreso manual) contra la cuenta
// demo como corredor, pedido real 2026-10-15/16. Las 3 de arriba (team 1,
// donde demo es entrenador/dueño con roster vacío) alcanzaban para
// aprobar/rechazar/cerrar (Spec 4a) pero no para loguear un entrenamiento
// como participante. Ventanas relativas a HOY (addDaysISO), no fechas
// fijas -- pedido real 2026-10-16, para que el fixture no quede obsoleto
// según cuándo se corra. metric='sessions_count' a propósito -- es la
// ÚNICA métrica que el mock agrega de verdad contra runner-session reales
// (ver computeProgressValue más abajo); el resto queda en 0 sin
// aggregation, documentado ahí mismo. calendar-mock.js siembra días de
// calendario reales en team 5 calzados con estas 3 ventanas (hoy, hoy+7,
// hoy+15) -- ver seedTeam5CalendarDays() ahí para el detalle de qué
// prueba cada fecha.
const SEED = [
  { id: 1, team_id: 1, group_id: null, type: 'metric', metric: 'distance', start_at: '2026-10-01', end_at: '2026-10-07', route: null, acceptance_radius_meters: null, max_attempts: null, participant_user_ids: [2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 2, team_id: 1, group_id: null, type: 'metric', metric: 'sessions_count', start_at: '2026-10-15', end_at: '2026-10-22', route: null, acceptance_radius_meters: null, max_attempts: null, participant_user_ids: [2, 4], created_by_user_id: 2, created_by_role: 'runner', status: 'pending_approval', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 3, team_id: 1, group_id: null, type: 'metric', metric: 'duration', start_at: '2026-09-01', end_at: '2026-09-30', route: null, acceptance_radius_meters: null, max_attempts: null, participant_user_ids: [1, 2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'finished', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [2], finished_at: '2026-10-01' },
  // Cubre "hoy" junto con la 5 (desempate: ésta termina más tarde, hoy+5).
  { id: 4, team_id: 5, group_id: null, type: 'metric', metric: 'sessions_count', start_at: addDaysISO(TODAY_ISO, -5), end_at: addDaysISO(TODAY_ISO, 5), route: null, acceptance_radius_meters: null, max_attempts: null, participant_user_ids: [1, 101, 102], created_by_user_id: 99, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  // Cubre "hoy" junto con la 4, pero termina ANTES (hoy+2) -- gana el
  // desempate de findActiveMetricCompetitionId.
  { id: 5, team_id: 5, group_id: null, type: 'metric', metric: 'sessions_count', start_at: addDaysISO(TODAY_ISO, -3), end_at: addDaysISO(TODAY_ISO, 2), route: null, acceptance_radius_meters: null, max_attempts: null, participant_user_ids: [1, 101, 103], created_by_user_id: 99, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  // Ventana enteramente futura -- NO cubre "hoy" a propósito (pedido real
  // 2026-10-16: "competencias... cuya ventana de fechas esten fuera del
  // rango de fechas actual"). Sirve para confirmar que loguear hoy no la
  // toca, y que un entrenamiento fechado hoy+15 (seedTeam5CalendarDays)
  // sí asocia acá.
  { id: 6, team_id: 5, group_id: null, type: 'metric', metric: 'sessions_count', start_at: addDaysISO(TODAY_ISO, 10), end_at: addDaysISO(TODAY_ISO, 20), route: null, acceptance_radius_meters: null, max_attempts: null, participant_user_ids: [1, 102, 103], created_by_user_id: 99, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  // Seed 7 -- type='route', team 5, para Spec 4c. Necesaria por el mismo
  // motivo que 4/5/6: cada dispositivo/proceso (web, Expo Go, dev client)
  // tiene su propia memoria de mock aislada -- una competencia creada en
  // web durante el script de creación (pasos 1-6) NO existe para un
  // dispositivo mobile aparte (pedido real, 2026-10-16: "no creo que
  // usando mocks pueda usar en mobile una competencia creada en web en
  // otro dispositivo"). Esta queda fija en el seed para que el script de
  // CORRER (pasos 7-13) tenga algo real sin depender de lo creado en los
  // pasos 1-6 -- esos siguen sirviendo para probar la UI de creación en
  // sí, por separado. Camino corto (~300m, caminable) cerca de Avellaneda
  // (ciudad real de team 5 en teams-mock.js) -- ABIERTO, no un loop: hasta
  // 2026-10-19 el último punto repetía el primero (cerraba el rectángulo),
  // así que inicio y llegada eran la MISMA coordenada -- bug real
  // reportado al probar la preview ("necesito que el punto de inicio y de
  // final sean distintos"), el marker de llegada quedaba invisible,
  // tapado exactamente por el de inicio. session_instance_id
  // fijo en 9000 -- nextSyntheticInstanceId arranca en 9001 para no
  // pisarlo con uno creado en runtime.
  {
    id: 7, team_id: 5, group_id: null, type: 'route', metric: null,
    start_at: addDaysISO(TODAY_ISO, -5), end_at: null,
    route: { type: 'LineString', coordinates: [[-58.365, -34.660], [-58.364, -34.660], [-58.364, -34.661], [-58.365, -34.661]] },
    acceptance_radius_meters: 50,
    // max_attempts 3, no 1 -- Gap 36: esta seed ya tiene 2 intentos
    // terminados hand-seeded (ver runner-session-mock.js/workoutFeedback-mock.js)
    // para la atleta 101, así que 3 deja exactamente 1 intento libre --
    // alcanza para demostrar "tiene historial" y "todavía puede correr" a
    // la vez, sin agotar el cupo de entrada.
    max_attempts: 3,
    participant_user_ids: [1, 101, 102], created_by_user_id: 99, created_by_role: 'trainer', status: 'active',
    approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null,
    session_instance_id: 9000,
  },
  // Seed 8 -- competencia de ruta "dinámica", pedido real 2026-10-19: no
  // hay forma de crear a mano una competencia de ruta cuyo punto de inicio
  // sirva para probar el gate de GPS como corredor -- crearla como
  // entrenador la deja pending_approval sin un usuario corredor propio
  // para aprobarla y correrla después (son roles separados en mocks,
  // catch-22), y crearla ya como entrenador-dueño (`active` directo) no
  // sirve porque el dueño no es nunca corredor propio tampoco. Arranca con
  // un placeholder lejano (mismo problema que seed 7 si se la deja así) --
  // `mockSeedDynamicRouteCompetitionStart(lat,lng)` la reubica contra el
  // GPS real del dispositivo la primera vez que resuelve (ver
  // hooks/use-competitions.js#useSeedDynamicRouteCompetition), trasladando
  // TODO el trazado en paralelo para no deformar la forma/largo. radio
  // más generoso (75m, no 50) a propósito -- da más margen contra el
  // jitter real de GPS al probar "Play habilitado".
  {
    id: 8, team_id: 5, group_id: null, type: 'route', metric: null,
    start_at: addDaysISO(TODAY_ISO, -1), end_at: null,
    route: { type: 'LineString', coordinates: [[-58.365, -34.660], [-58.3645, -34.6595], [-58.3638, -34.6598]] },
    acceptance_radius_meters: 75,
    max_attempts: 1,
    participant_user_ids: [1, 101, 103], created_by_user_id: 99, created_by_role: 'trainer', status: 'active',
    approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null,
    session_instance_id: 9100,
  },
];

let mockCompetitions = [];
let nextId = 8;
let nextSyntheticInstanceId = 9001;
// Cantidad de intentos ya hechos por (competition_id, athlete_user_id) --
// Gap 36, reemplaza el Set booleano de "ya intentó sí/no" de la v1
// sin-reintentos (Gap 33 punto 28). Clave igual que antes
// (`${competitionId}:${athleteUserId}`), valor = cantidad de intentos.
const attemptCounts = new Map();
// Seed 8 (la "dinámica") solo se reubica UNA vez por proceso -- sin este
// guard, cada llamada (ej. remontar CompetitionsTab) la trasladaría de
// nuevo relativo a su posición YA reubicada, alejándola cada vez más del
// GPS real en vez de clavarla ahí una sola vez.
let dynamicRouteSeeded = false;

function resetSeed() {
  mockCompetitions = SEED.map((c) => ({ ...c }));
  nextId = SEED.length + 1;
  nextSyntheticInstanceId = 9001;
  attemptCounts.clear();
  // user_id 101 (Lucía Fernández, participante de la seed 7, NO el user_id 1
  // de pruebas -- ese slot lo necesita libre el test existente "user_id 1
  // puede correr un intento contra la seed 7") ya corrió la seed 7 DOS veces
  // -- ver los 2 runner_session finished + feedback + puntos de
  // runner-session-mock.js/workoutFeedback-mock.js (Gap 36, Task 3 de este
  // plan). Sin esto, "Correr esta trayectoria" seguiría ofreciéndose como si
  // tuviera 3 intentos libres en vez de 1 (max_attempts: 3, ver SEED).
  attemptCounts.set('7:101', 2);
  dynamicRouteSeeded = false;
}
resetSeed();

export async function mockListCompetitions(teamId, { status, groupId } = {}) {
  let rows = mockCompetitions.filter((c) => c.team_id === Number(teamId));
  if (status) rows = rows.filter((c) => c.status === status);
  if (groupId) rows = rows.filter((c) => c.group_id === Number(groupId));
  return { data: rows, has_unseen: rows.some((c) => c.status === 'pending_approval') };
}

export async function mockCreateCompetition(teamId, payload, { isTrainerCreator = true } = {}) {
  const competition = {
    id: nextId++,
    team_id: Number(teamId),
    group_id: payload.group_id ?? null,
    type: payload.type,
    metric: payload.metric ?? null,
    start_at: payload.start_at,
    end_at: payload.end_at ?? null,
    route: payload.route ?? null,
    acceptance_radius_meters: payload.acceptance_radius_meters ?? null,
    participant_user_ids: payload.participant_user_ids ?? [],
    created_by_user_id: 1,
    created_by_role: isTrainerCreator ? 'trainer' : 'runner',
    status: isTrainerCreator ? 'active' : 'pending_approval',
    approved_by_user_id: null,
    rejection_reason: null,
    winner_user_ids: [],
    finished_at: null,
    // Instancia sintética (Gap 33 punto 26) -- una sola por competencia al
    // crearla; reusada por el PRIMER intento de cada atleta (Gap 36, ver
    // mockCreateCompetitionAttempt más abajo).
    session_instance_id: payload.type === 'route' ? nextSyntheticInstanceId++ : null,
    // max_attempts (Gap 36) -- solo type='route'. Ausente/null = SIN
    // LÍMITE -- confirmado por backend 2026-10-23 (no default 1, como se
    // había asumido antes de esa confirmación).
    max_attempts: payload.type === 'route' ? (payload.max_attempts ?? null) : null,
  };
  mockCompetitions.push(competition);
  return competition;
}

export async function mockApproveCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  competition.status = 'active';
  return competition;
}

export async function mockRejectCompetition(id, reason) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  competition.status = 'rejected';
  competition.rejection_reason = reason ?? null;
  return competition;
}

export async function mockCancelCompetition(id) {
  mockCompetitions = mockCompetitions.filter((c) => c.id !== Number(id));
  return { success: true };
}

export async function mockCloseCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  competition.status = 'finished';
  competition.finished_at = new Date().toISOString();
  competition.winner_user_ids = competition.participant_user_ids.length ? [competition.participant_user_ids[0]] : [];
  return competition;
}

export function __resetMockCompetitions() {
  resetSeed();
}

// Reubica el trazado de la seed 8 ("dinámica") contra una coordenada real
// -- pensado para llamarse UNA sola vez con el GPS real del dispositivo
// (ver hooks/use-competitions.js#useSeedDynamicRouteCompetition). Traslada
// TODOS los puntos por el mismo delta (no solo el primero) para no
// deformar la forma/largo del trazado ya definido en el seed. Sin
// `expo-location` importado en este archivo a propósito -- lo pide quien
// llama, mocks no debe depender de un módulo nativo (mismo motivo por el
// que use-route-draw-picker.test.js necesita su propio jest.mock local:
// expo-location no entra en transformIgnorePatterns de jest.config.js).
// Devuelve false sin tocar nada si ya se reubicó antes en este proceso o
// si la competencia no existe -- el caller usa el resultado para decidir
// si hace falta invalidar la query de la lista.
export function mockSeedDynamicRouteCompetitionStart(lat, lng) {
  if (dynamicRouteSeeded) return false;
  const competition = mockCompetitions.find((c) => c.id === 8);
  if (!competition) return false;
  const [firstLng, firstLat] = competition.route.coordinates[0];
  const deltaLng = lng - firstLng;
  const deltaLat = lat - firstLat;
  competition.route = {
    ...competition.route,
    coordinates: competition.route.coordinates.map(([pointLng, pointLat]) => [pointLng + deltaLng, pointLat + deltaLat]),
  };
  dynamicRouteSeeded = true;
  return true;
}

// POST /competitions/{id}/attempts (Gap 33 punto 26, Gap 36) -- valida
// active + participante + cupo contra max_attempts, devuelve la instancia
// sintética. El PRIMER intento de un atleta (attemptsSoFar === 0) reusa la
// instancia de la competencia (comportamiento sin cambios desde Gap 33); el
// segundo en adelante mintea una instancia nueva -- esa misma instancia
// compartida ya está "ocupada" por este atleta, y el índice único real del
// backend es (session_instance_id, athlete_user_id), así que una segunda
// fila con el mismo par rompería esa unicidad.
export async function mockCreateCompetitionAttempt(competitionId, athleteUserId) {
  const competition = mockCompetitions.find((c) => c.id === Number(competitionId));
  if (!competition) throw new Error('Competencia no encontrada');
  if (competition.status !== 'active') throw new Error('La competencia no está activa');
  if (!competition.participant_user_ids.includes(Number(athleteUserId))) throw new Error('No participás de esta competencia');
  const key = `${competitionId}:${athleteUserId}`;
  const attemptsSoFar = attemptCounts.get(key) ?? 0;
  // null = sin límite (confirmado por backend 2026-10-23) -- sin cupo que
  // chequear en ese caso, a diferencia de antes (default 1).
  if (competition.max_attempts != null && attemptsSoFar >= competition.max_attempts) {
    throw new Error('Ya alcanzaste el máximo de intentos para esta competencia');
  }
  const sessionInstanceId = attemptsSoFar === 0 ? competition.session_instance_id : nextSyntheticInstanceId++;
  attemptCounts.set(key, attemptsSoFar + 1);
  return {
    session_instance_id: sessionInstanceId,
    session_instance: {
      id: sessionInstanceId,
      name: 'Corrida',
      exercises: [{ id: sessionInstanceId * 10, name: 'Corrida', role: 'main', repeat_count: 1, rest_minutes: 0 }],
    },
  };
}

// Único metric que el mock agrega de verdad contra runner_session reales
// (Spec 4b, Gap 33 punto 29) -- distance/duration/pace/peak_speed/
// attendance_count se calculan server-side contra datos de GPS/feedback
// que el mock no replica con fidelidad suficiente para ese cálculo;
// sessions_count sí (es un conteo simple de runner_session 'finished' con
// ese competition_id). Devuelve 0, no null -- el contrato real nunca manda
// null para type='metric' (Gap 33 punto 23), así que el mock no inventa
// esa rama.
function computeProgressValue(competition, userId) {
  if (competition.type === 'route') return null;
  if (competition.metric === 'sessions_count') {
    return __countFinishedRunnerSessionsByCompetition(competition.id, userId);
  }
  return 0;
}

// Intentos de UN atleta contra UNA competencia de ruta, con compliance_ratio
// calculado contra la ruta/radio de esa competencia -- base común de
// mockGetCompetitionAttempts (Gap 36, endpoint nuevo) y computeRouteProgress
// (progress de mockGetCompetition para type='route', más abajo).
function buildAttemptSummaries(competition, athleteUserId) {
  const rows = __listRunnerSessionsByCompetitionAndAthlete(competition.id, athleteUserId);
  return rows.map((row) => {
    const feedback = __getMockFeedbacks().find(
      (f) => f.assigned_session_id === row.session_instance_id && f.athlete_user_id === Number(athleteUserId),
    );
    const points = feedback ? __getMockPoints(feedback.id) : [];
    const traveledPoints = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    const complianceRatio = competition.route
      ? computeRouteComplianceRatio(traveledPoints, competition.route.coordinates, competition.acceptance_radius_meters)
      : null;
    return {
      runner_session_id: row.id,
      session_instance_id: row.session_instance_id,
      status: row.status,
      started_at: row.start_date,
      finished_at: row.end_date,
      distance_meters: feedback?.distance_meters ?? null,
      duration_ms: feedback?.duration_ms ?? null,
      compliance_ratio: complianceRatio,
    };
  });
}

// GET /competitions/{id}/attempts?athlete_user_id=X (Gap 36, endpoint nuevo).
export async function mockGetCompetitionAttempts(competitionId, athleteUserId) {
  const competition = mockCompetitions.find((c) => c.id === Number(competitionId));
  if (!competition) throw new Error('Competencia no encontrada');
  return { data: buildAttemptSummaries(competition, athleteUserId) };
}

// Mejor intento de UN atleta (Gap 36) -- mismo comparador que ordena entre
// corredores distintos, aplicado primero adentro de los intentos propios.
// Solo cuenta intentos 'finished' -- uno 'wip' todavía no tiene feedback real
// que comparar. null en los 3 campos si el atleta no tiene ningún intento
// terminado -- no un 0%/duración inventada.
function computeRouteProgress(competition, userId) {
  const finished = buildAttemptSummaries(competition, userId).filter((a) => a.status === 'finished');
  const attempts = finished.map((a) => ({ complianceRatio: a.compliance_ratio, durationMs: a.duration_ms, sessionInstanceId: a.session_instance_id }));
  const best = pickBestAttempt(attempts);
  return {
    // `has_attempt` -- bug real reportado 2026-10-25: un intento terminado
    // con menos de 2 puntos GPS (arrancó y terminó parado en el mismo
    // lugar) da compliance_ratio null (computeRouteComplianceRatio, "no
    // hay nada que comparar todavía") -- `pickBestAttempt` lo descarta
    // (mismo criterio, correcto para elegir "el mejor" entre varios), así
    // que `best` queda `null` aunque SÍ exista un intento real. Sin esta
    // bandera, independiente del filtro de pickBestAttempt, el ranking no
    // podía distinguir "nunca intentó" de "intentó pero sin datos
    // suficientes" -- las dos mostraban "Sin intentos".
    has_attempt: finished.length > 0,
    compliance_ratio: best?.complianceRatio ?? null,
    duration_ms: best?.durationMs ?? null,
    session_instance_id: best?.sessionInstanceId ?? null,
  };
}

// GET /competitions/{id} (detalle, Gap 33 punto 23, Gap 36) -- `progress`
// siempre `[{user_id, value}]` para type='metric'; para type='route' suma
// compliance_ratio/duration_ms/session_instance_id del MEJOR intento de ese
// atleta (Gap 36) en vez del `value` siempre-null de antes.
export async function mockGetCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  const progress = competition.participant_user_ids.map((userId) => {
    if (competition.type === 'route') {
      return { user_id: userId, value: null, ...computeRouteProgress(competition, userId) };
    }
    return { user_id: userId, value: computeProgressValue(competition, userId) };
  });
  return { data: { ...competition, progress } };
}
