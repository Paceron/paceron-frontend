import { __countFinishedRunnerSessionsByCompetition } from './runner-session-mock.js';

// Fixture CRUD mutable para EXPO_PUBLIC_USE_MOCKS=true (Gap 33) -- mismo
// patrón que services/__mocks__/team-subscriptions-mock.js: estado en
// memoria + __resetMockCompetitions() para tests. 3 competencias seed con
// 3 estados distintos (active/pending_approval/finished) para poder ver
// toda la matriz de acciones sin tener que crear nada a mano primero.
// Sin `name` a propósito -- confirmado 2026-10-14 que el backend real no
// tiene esa columna (decisión D8); el mock ejercita el mismo fallback de
// título (utils/competition-title.js) que usará la UI contra datos
// reales, en vez de inventar un campo que no existe.
// Seeds 4 y 5 -- team_id 5 ("Atletas del Río"), el único equipo donde
// user_id 1 (demo@paceron.com) es corredor de verdad y no dueño (ver
// services/__mocks__/teams-mock.js) -- necesarias para poder probar Spec
// 4b (wiring de competition_id en Play/ingreso manual) contra la cuenta
// demo como corredor, pedido real 2026-10-15. Las 3 de arriba (team 1,
// donde demo es entrenador/dueño con roster vacío) alcanzaban para
// aprobar/rechazar/cerrar (Spec 4a) pero no para loguear un entrenamiento
// como participante. Ventanas de fecha a propósito solapadas y cubriendo
// "hoy" (2026-10-15) con endAt distinto (10-17 vs 10-20) para poder
// probar el desempate de findActiveMetricCompetitionId (gana la que
// termina antes). metric='sessions_count' a propósito -- es la ÚNICA
// métrica que el mock agrega de verdad contra runner-session reales (ver
// computeProgressValue más abajo); el resto queda en 0 sin aggregation,
// documentado ahí mismo.
const SEED = [
  { id: 1, team_id: 1, group_id: null, type: 'metric', metric: 'distance', start_at: '2026-10-01', end_at: '2026-10-07', route: null, acceptance_radius_meters: null, participant_user_ids: [2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 2, team_id: 1, group_id: null, type: 'metric', metric: 'sessions_count', start_at: '2026-10-15', end_at: '2026-10-22', route: null, acceptance_radius_meters: null, participant_user_ids: [2, 4], created_by_user_id: 2, created_by_role: 'runner', status: 'pending_approval', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 3, team_id: 1, group_id: null, type: 'metric', metric: 'duration', start_at: '2026-09-01', end_at: '2026-09-30', route: null, acceptance_radius_meters: null, participant_user_ids: [1, 2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'finished', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [2], finished_at: '2026-10-01' },
  { id: 4, team_id: 5, group_id: null, type: 'metric', metric: 'sessions_count', start_at: '2026-10-10', end_at: '2026-10-20', route: null, acceptance_radius_meters: null, participant_user_ids: [1, 101, 102], created_by_user_id: 99, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 5, team_id: 5, group_id: null, type: 'metric', metric: 'sessions_count', start_at: '2026-10-12', end_at: '2026-10-17', route: null, acceptance_radius_meters: null, participant_user_ids: [1, 101, 103], created_by_user_id: 99, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
];

let mockCompetitions = [];
let nextId = 4;
let nextSyntheticInstanceId = 9000;
// (competition_id, athlete_user_id) ya intentados -- Gap 33 punto 28, sin
// reintentos en v1.
const mockAttempts = new Set();

function resetSeed() {
  mockCompetitions = SEED.map((c) => ({ ...c }));
  nextId = SEED.length + 1;
  nextSyntheticInstanceId = 9000;
  mockAttempts.clear();
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
    // Instancia sintética (Gap 33 punto 26) -- una sola por competencia,
    // compartida por todos los participantes, generada al crear.
    synthetic_session_instance_id: payload.type === 'route' ? nextSyntheticInstanceId++ : null,
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

// POST /competitions/{id}/attempts (Gap 33 punto 26) -- valida active +
// participante + sin intento previo, devuelve la instancia sintética.
export async function mockCreateCompetitionAttempt(competitionId, athleteUserId) {
  const competition = mockCompetitions.find((c) => c.id === Number(competitionId));
  if (!competition) throw new Error('Competencia no encontrada');
  if (competition.status !== 'active') throw new Error('La competencia no está activa');
  if (!competition.participant_user_ids.includes(Number(athleteUserId))) throw new Error('No participás de esta competencia');
  const key = `${competitionId}:${athleteUserId}`;
  if (mockAttempts.has(key)) throw new Error('Ya tenés un intento registrado para esta competencia');
  mockAttempts.add(key);
  return {
    session_instance_id: competition.synthetic_session_instance_id,
    session_instance: {
      id: competition.synthetic_session_instance_id,
      name: 'Corrida',
      exercises: [{ id: competition.synthetic_session_instance_id * 10, name: 'Corrida', role: 'main', repeat_count: 1, rest_minutes: 0 }],
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

// GET /competitions/{id} (detalle, Gap 33 punto 23) -- `progress` siempre
// `[{user_id, value}]`, `value` null para type='route' en v1.
export async function mockGetCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  const progress = competition.participant_user_ids.map((userId) => ({
    user_id: userId,
    value: computeProgressValue(competition, userId),
  }));
  return { data: { ...competition, progress } };
}
