import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
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

// GET /api/v1/teams — devuelve TODO el sistema, sin filtro por usuario (ver
// docs/BACKEND_API_GAPS.md gap 1). El filtro "mis equipos" vive en
// store/team-store.js#selectAdministeredTeams, no acá.
export async function listTeams() {
  if (USE_MOCKS) return await mockListTeams();
  return await api.get('/teams');
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
