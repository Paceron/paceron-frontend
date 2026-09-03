import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { buildPhotoFormData } from '../utils/build-photo-form-data.js';
import {
  mockCreateTeam,
  mockGetTeam,
  mockListTeams,
  mockUpdateTeam,
  mockUpdateTeamAddress,
  mockDeleteTeam,
  mockGetTeamUsers,
  mockAddTeamUser,
  mockRemoveTeamUser,
  mockUploadTeamIcon,
  mockDeleteTeamIcon,
} from './__mocks__/teams-mock.js';

// POST /api/v1/teams — team.CreateTeamRequest.
export async function createTeam(payload) {
  if (USE_MOCKS) return await mockCreateTeam(payload);
  return await api.post('/teams', payload);
}

// GET /api/v1/teams/{id}.
export async function getTeam(teamId) {
  if (USE_MOCKS) return await mockGetTeam(teamId);
  return await api.get(`/teams/${teamId}`);
}

// GET /api/v1/teams?owner_id=&member_id= — ambos filtros opcionales,
// resueltos en backend. Sin params, devuelve TODO el sistema — el store
// global (`fetchTeams`) lo sigue usando sin filtrar, porque necesita
// poder encontrar cualquier equipo por id sin importar el rol activo. El
// filtro "mis equipos como entrenador" vive client-side en
// store/team-store.js#selectAdministeredTeams sobre esa lista global; el
// de "mis equipos como corredor" sí necesita el query param real — no hay
// forma de resolverlo client-side sin roster por equipo (ver
// store/team-store.js#fetchMyMemberTeams).
export async function listTeams({ ownerId, memberId } = {}) {
  if (USE_MOCKS) return await mockListTeams({ ownerId, memberId });
  const params = new URLSearchParams();
  if (ownerId != null) params.set('owner_id', ownerId);
  if (memberId != null) params.set('member_id', memberId);
  const query = params.toString();
  return await api.get(query ? `/teams?${query}` : '/teams');
}

// PUT /api/v1/teams/{id} — team.UpdateTeamRequest (parcial).
export async function updateTeam(teamId, updates) {
  if (USE_MOCKS) return await mockUpdateTeam(teamId, updates);
  return await api.put(`/teams/${teamId}`, updates);
}

// PUT /api/v1/teams/{id}/address — team.UpdateTeamAddressRequest. Endpoint
// separado del PUT general (decisión ya tomada del lado de backend).
export async function updateTeamAddress(teamId, address) {
  if (USE_MOCKS) return await mockUpdateTeamAddress(teamId, address);
  return await api.put(`/teams/${teamId}/address`, address);
}

// DELETE /api/v1/teams/{id}?user_id=.
export async function deleteTeam(teamId, userId) {
  if (USE_MOCKS) return await mockDeleteTeam(teamId, userId);
  return await api.delete(`/teams/${teamId}?user_id=${encodeURIComponent(userId)}`);
}

// GET /api/v1/teams/{id}/users. Sin consumidor en la UI de esta etapa
// (el roster sigue siendo sintético, ver store/team-store.js) — se agrega
// igual como espejo 1:1 barato del contrato ya documentado.
export async function getTeamUsers(teamId) {
  if (USE_MOCKS) return await mockGetTeamUsers(teamId);
  return await api.get(`/teams/${teamId}/users`);
}

// POST /api/v1/teams/{id}/users — teamuser.AddTeamUserRequest.
export async function addTeamUser(teamId, userId, roleInTeam) {
  if (USE_MOCKS) return await mockAddTeamUser(teamId, userId, roleInTeam);
  return await api.post(`/teams/${teamId}/users`, { user_id: userId, role_in_team: roleInTeam });
}

// DELETE /api/v1/teams/{id}/users/{user_id}.
export async function removeTeamUser(teamId, userId) {
  if (USE_MOCKS) return await mockRemoveTeamUser(teamId, userId);
  return await api.delete(`/teams/${teamId}/users/${userId}`);
}

// PUT /api/v1/teams/{id}/icon — multipart/form-data, campo "photo". Solo
// el entrenador dueño (valida el backend). Máx 5MB, JPEG/PNG/WEBP.
export async function uploadTeamIcon(teamId, uri, mimeType) {
  if (USE_MOCKS) return await mockUploadTeamIcon(teamId, uri);
  const formData = await buildPhotoFormData(uri, { mimeType });
  return await api.putForm(`/teams/${teamId}/icon`, formData);
}

// DELETE /api/v1/teams/{id}/icon — solo el entrenador dueño, idempotente (204).
export async function deleteTeamIcon(teamId) {
  if (USE_MOCKS) return await mockDeleteTeamIcon(teamId);
  return await api.delete(`/teams/${teamId}/icon`);
}
