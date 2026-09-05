// Estado in-memory con la MISMA shape snake_case que el backend real
// (JoinRequestResponse, confirmado 2026-09-05 contra el swagger real) —
// mismo patrón stateful que invitations-mock.js. mockSearchTeams filtra
// sobre __getAllMockTeams() (teams-mock.js) en vez de tener su propio
// seed — un solo lugar de verdad para los equipos de prueba.
import { __getAllMockTeams, __getMockTeamOwnerId, __getMockTeamName } from './teams-mock.js';

const PAGE_SIZE = 20;

let mockJoinRequests = [];
let nextJoinRequestId = 1;

function findJoinRequestOrThrow(requestId) {
  const request = mockJoinRequests.find((r) => String(r.id) === String(requestId));
  if (!request) {
    const error = new Error('Solicitud no encontrada.');
    error.status = 404;
    throw error;
  }
  return request;
}

// GET /api/v1/teams/search — filtra por visible:true siempre (un equipo
// oculto nunca aparece, sin importar el resto de filtros), más los
// filtros opcionales recibidos. Paginación real: PAGE_SIZE fijo, page
// 1-indexado, has_more = todavía queda al menos 1 resultado después del
// corte actual.
export async function mockSearchTeams(filters, page) {
  const allTeams = __getAllMockTeams().filter((t) => t.visible !== false);
  const filtered = allTeams.filter((t) => {
    if (filters.name && !t.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.level && t.level !== filters.level) return false;
    if (filters.country && t.country !== filters.country) return false;
    if (filters.province && t.province !== filters.province) return false;
    if (filters.city && t.city !== filters.city) return false;
    return true;
  });

  const pageNumber = page ?? 1;
  const start = (pageNumber - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const hasMore = start + PAGE_SIZE < filtered.length;

  const teams = pageItems.map((t) => ({
    id: t.id,
    name: t.name,
    level: t.level,
    max_members: t.max_members,
    member_count: 0,
    owner_name: 'Entrenador Demo',
    is_public: t.is_public !== false,
    country: t.country,
    province: t.province,
    city: t.city,
    icon_url: t.icon_url ?? null,
  }));

  return { teams, has_more: hasMore };
}

// POST /api/v1/teams/{id}/join-requests
export async function mockCreateJoinRequest(teamId) {
  if (mockJoinRequests.some((r) => String(r.team_id) === String(teamId) && r.status === 'pending')) {
    const error = new Error('Ya tenés una solicitud pendiente para este equipo.');
    error.status = 409;
    error.code = 'JOIN_REQUEST_ALREADY_PENDING';
    throw error;
  }
  const request = {
    id: nextJoinRequestId++,
    team_id: Number(teamId),
    team_name: __getMockTeamName(teamId),
    runner_id: 1,
    runner_name: 'Demo User',
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  mockJoinRequests.push(request);
  return request;
}

// DELETE /api/v1/join-requests/{id}
export async function mockCancelJoinRequest(requestId) {
  const request = findJoinRequestOrThrow(requestId);
  mockJoinRequests = mockJoinRequests.filter((r) => r.id !== request.id);
  return null;
}

// GET /api/v1/join-requests/mine
export async function mockListMyJoinRequests() {
  return mockJoinRequests.filter((r) => r.runner_id === 1);
}

// GET /api/v1/teams/{id}/join-requests — solo pending, como el backend real.
export async function mockListTeamJoinRequests(teamId) {
  return mockJoinRequests.filter((r) => String(r.team_id) === String(teamId) && r.status === 'pending');
}

// GET /api/v1/join-requests/pending-count — agregado de todos los
// equipos del entrenador demo (owner_id: 1 en el seed de teams-mock.js).
export async function mockGetPendingRequestsCount() {
  const myTeamIds = __getAllMockTeams().filter((t) => __getMockTeamOwnerId(t.id) === 1).map((t) => t.id);
  const count = mockJoinRequests.filter((r) => myTeamIds.includes(Number(r.team_id)) && r.status === 'pending').length;
  return { count };
}

// POST /api/v1/join-requests/{id}/accept | /reject
export async function mockRespondJoinRequest(requestId, accept) {
  const request = findJoinRequestOrThrow(requestId);
  request.status = accept ? 'accepted' : 'rejected';
  return null;
}

export function __resetMockJoinRequests() {
  mockJoinRequests = [];
  nextJoinRequestId = 1;
}
