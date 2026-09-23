import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListSessions,
  mockGetSession,
  mockCreateSession,
  mockUpdateSession,
  mockDeleteSession,
  mockCloneSession,
} from './__mocks__/sessions-mock.js';

// Backend real desde 2026-09-12 (ver docs/BACKEND_API_GAPS.md, gap 4
// resuelto) — mismo patrón USE_MOCKS que el resto de dominios reales
// (services/teams.js, etc.), sin flag de forzado propio. El `PUT` de
// abajo NUNCA va a mandar `exclude_group_ids`/`clone_name`/
// `clone_description` — el mecanismo de clonado por divergencia que los
// necesitaba fue eliminado del backend (instanciación de sesiones en el
// calendario, 2026-09-20, ver docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md
// §5, obsoleto). Editar una sesión de catálogo ya no puede afectar
// ninguna asignación existente — no hace falta esta UI.

// GET /api/v1/sessions?owner_id=.
export async function listSessions({ ownerId } = {}) {
  if (USE_MOCKS) return await mockListSessions({ ownerId });
  const params = new URLSearchParams();
  if (ownerId != null) params.set('owner_id', ownerId);
  const query = params.toString();
  return await api.get(query ? `/sessions?${query}` : '/sessions');
}

// GET /api/v1/sessions/{id}.
export async function getSession(sessionId) {
  if (USE_MOCKS) return await mockGetSession(sessionId);
  return await api.get(`/sessions/${sessionId}`);
}

// POST /api/v1/sessions.
export async function createSession(payload) {
  if (USE_MOCKS) return await mockCreateSession(payload);
  return await api.post('/sessions', payload);
}

// PUT /api/v1/sessions/{id} (parcial).
export async function updateSession(sessionId, updates) {
  if (USE_MOCKS) return await mockUpdateSession(sessionId, updates);
  return await api.put(`/sessions/${sessionId}`, updates);
}

// DELETE /api/v1/sessions/{id}.
export async function deleteSession(sessionId) {
  if (USE_MOCKS) return await mockDeleteSession(sessionId);
  return await api.delete(`/sessions/${sessionId}`);
}

// POST /api/v1/sessions/{id}/clone.
export async function cloneSession(sessionId) {
  if (USE_MOCKS) return await mockCloneSession(sessionId);
  return await api.post(`/sessions/${sessionId}/clone`);
}
