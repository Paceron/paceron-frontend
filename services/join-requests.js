import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockSearchTeams,
  mockCreateJoinRequest,
  mockCancelJoinRequest,
  mockListMyJoinRequests,
  mockListTeamJoinRequests,
  mockGetPendingRequestsCount,
  mockRespondJoinRequest,
} from './__mocks__/join-requests-mock.js';

// GET /api/v1/teams/search?name=&level=&country=&province=&city=&page=
// — todos los filtros opcionales, page 1-indexado (default 1 si no se
// pasa). Respuesta real: { teams: TeamSearchResult[], has_more: bool },
// page size fijo en 20 del lado del backend, sin total.
export async function searchTeams(filters = {}, page = 1) {
  if (USE_MOCKS) return await mockSearchTeams(filters, page);
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.level) params.set('level', filters.level);
  if (filters.country) params.set('country', filters.country);
  if (filters.province) params.set('province', filters.province);
  if (filters.city) params.set('city', filters.city);
  params.set('page', String(page));
  return await api.get(`/teams/search?${params.toString()}`);
}

// POST /api/v1/teams/{id}/join-requests — sin body, crea solicitud pending.
export async function createJoinRequest(teamId) {
  if (USE_MOCKS) return await mockCreateJoinRequest(teamId);
  return await api.post(`/teams/${teamId}/join-requests`, {});
}

// DELETE /api/v1/join-requests/{id} — cancela mientras siga pending.
export async function cancelJoinRequest(requestId) {
  if (USE_MOCKS) return await mockCancelJoinRequest(requestId);
  return await api.delete(`/join-requests/${requestId}`);
}

// GET /api/v1/join-requests/mine — todas las del corredor actual, cualquier estado.
export async function listMyJoinRequests() {
  if (USE_MOCKS) return await mockListMyJoinRequests();
  return await api.get('/join-requests/mine');
}

// GET /api/v1/teams/{id}/join-requests — pending del equipo (lado entrenador dueño).
export async function listTeamJoinRequests(teamId) {
  if (USE_MOCKS) return await mockListTeamJoinRequests(teamId);
  return await api.get(`/teams/${teamId}/join-requests`);
}

// GET /api/v1/join-requests/pending-count — agregado de todos los
// equipos del entrenador, para el badge.
export async function getPendingRequestsCount() {
  if (USE_MOCKS) return await mockGetPendingRequestsCount();
  return await api.get('/join-requests/pending-count');
}

// POST /api/v1/join-requests/{id}/accept | /reject — sin body.
export async function respondJoinRequest(requestId, accept) {
  const path = accept ? 'accept' : 'reject';
  if (USE_MOCKS) return await mockRespondJoinRequest(requestId, accept);
  return await api.post(`/join-requests/${requestId}/${path}`, {});
}
