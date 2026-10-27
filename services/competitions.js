import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListCompetitions,
  mockCreateCompetition,
  mockApproveCompetition,
  mockRejectCompetition,
  mockCancelCompetition,
  mockCloseCompetition,
  mockCreateCompetitionAttempt,
  mockGetCompetition,
  mockGetCompetitionAttempts,
  mockSeedDynamicRouteCompetitionStart,
} from './__mocks__/competitions-mock.js';

// GET /api/v1/teams/{id}/competitions -- Gap 33.
export async function listCompetitions(teamId, { status, groupId } = {}) {
  if (USE_MOCKS) return await mockListCompetitions(teamId, { status, groupId });
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (groupId) params.set('group_id', groupId);
  const query = params.toString();
  return await api.get(`/teams/${teamId}/competitions${query ? `?${query}` : ''}`);
}

// POST /api/v1/teams/{id}/competitions -- sin created_by_user_id/created_by_role
// en el body, el backend los deriva del token (mismo criterio que Gap 27).
// `isTrainerCreator` SOLO lo usa el mock (no hay token real que simular en
// modo mock) -- la llamada real lo ignora por completo.
export async function createCompetition(teamId, payload, { isTrainerCreator } = {}) {
  if (USE_MOCKS) return await mockCreateCompetition(teamId, payload, { isTrainerCreator });
  return await api.post(`/teams/${teamId}/competitions`, payload);
}

export async function approveCompetition(id) {
  if (USE_MOCKS) return await mockApproveCompetition(id);
  return await api.patch(`/competitions/${id}/approve`, {});
}

export async function rejectCompetition(id, reason) {
  if (USE_MOCKS) return await mockRejectCompetition(id, reason);
  return await api.patch(`/competitions/${id}/reject`, reason ? { reason } : {});
}

// DELETE, no PATCH -- confirmado contra la implementación real (Gap 33,
// corrección 2026-10-14): borrado físico, solo pending_approval.
export async function cancelCompetition(id) {
  if (USE_MOCKS) return await mockCancelCompetition(id);
  return await api.delete(`/competitions/${id}/cancel`);
}

export async function closeCompetition(id) {
  if (USE_MOCKS) return await mockCloseCompetition(id);
  return await api.patch(`/competitions/${id}/close`, {});
}

// GET /api/v1/competitions/{id} -- detalle + progreso (Gap 33 punto 23).
export async function getCompetition(id) {
  if (USE_MOCKS) return await mockGetCompetition(id);
  return await api.get(`/competitions/${id}`);
}

// POST /api/v1/competitions/{id}/attempts -- intake del intento (Gap 33
// punto 26, pieza nueva). `athleteUserId` solo lo usa el mock (no hay token
// real que simular en modo mock) -- la llamada real lo ignora.
export async function createCompetitionAttempt(id, athleteUserId) {
  if (USE_MOCKS) return await mockCreateCompetitionAttempt(id, athleteUserId);
  return await api.post(`/competitions/${id}/attempts`, {});
}

// GET /api/v1/competitions/{id}/attempts -- listado de intentos de un
// atleta contra una competencia de ruta (Gap 36, intentos múltiples
// configurables, endpoint todavía no mergeado al backend real).
// `athleteUserId` opcional -- default caller del lado real (no se manda
// query param); en mocks siempre explícito, no hay token real que simular.
export async function getCompetitionAttempts(competitionId, athleteUserId) {
  if (USE_MOCKS) return await mockGetCompetitionAttempts(competitionId, athleteUserId);
  const query = athleteUserId ? `?athlete_user_id=${Number(athleteUserId)}` : '';
  return await api.get(`/competitions/${competitionId}/attempts${query}`);
}

// Solo mocks -- no existe contraparte real (reubicar el trazado de una
// competencia real no es un caso de uso, es puramente para poder probar
// el gate de GPS del pre-start contra una ubicación real sin backend de
// por medio). No-op devolviendo false contra el backend real.
export function seedDynamicRouteCompetitionStart(lat, lng) {
  if (!USE_MOCKS) return false;
  return mockSeedDynamicRouteCompetitionStart(lat, lng);
}
