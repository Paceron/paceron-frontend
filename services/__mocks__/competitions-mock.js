// Fixture CRUD mutable para EXPO_PUBLIC_USE_MOCKS=true (Gap 33) -- mismo
// patrón que services/__mocks__/team-subscriptions-mock.js: estado en
// memoria + __resetMockCompetitions() para tests. 3 competencias seed con
// 3 estados distintos (active/pending_approval/finished) para poder ver
// toda la matriz de acciones sin tener que crear nada a mano primero.
const SEED = [
  { id: 1, name: 'Desafío de octubre', team_id: 1, group_id: null, type: 'metric', metric: 'distance', start_at: '2026-10-01', end_at: '2026-10-07', route: null, acceptance_radius_meters: null, participant_user_ids: [2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 2, name: 'Propuesta de Martín', team_id: 1, group_id: null, type: 'metric', metric: 'sessions_count', start_at: '2026-10-15', end_at: '2026-10-22', route: null, acceptance_radius_meters: null, participant_user_ids: [2, 4], created_by_user_id: 2, created_by_role: 'runner', status: 'pending_approval', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 3, name: 'Reto de septiembre', team_id: 1, group_id: null, type: 'metric', metric: 'duration', start_at: '2026-09-01', end_at: '2026-09-30', route: null, acceptance_radius_meters: null, participant_user_ids: [1, 2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'finished', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [2], finished_at: '2026-10-01' },
];

let mockCompetitions = [];
let nextId = 4;

function resetSeed() {
  mockCompetitions = SEED.map((c) => ({ ...c }));
  nextId = SEED.length + 1;
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
    name: payload.name,
    team_id: Number(teamId),
    group_id: payload.group_id ?? null,
    type: payload.type,
    metric: payload.metric ?? null,
    start_at: payload.start_at,
    end_at: payload.end_at ?? null,
    route: null,
    acceptance_radius_meters: null,
    participant_user_ids: payload.participant_user_ids ?? [],
    created_by_user_id: 1,
    created_by_role: isTrainerCreator ? 'trainer' : 'runner',
    status: isTrainerCreator ? 'active' : 'pending_approval',
    approved_by_user_id: null,
    rejection_reason: null,
    winner_user_ids: [],
    finished_at: null,
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
