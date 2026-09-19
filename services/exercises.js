import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListExercises,
  mockGetExercise,
  mockCreateExercise,
  mockUpdateExercise,
  mockDeleteExercise,
  mockCloneExercise,
} from './__mocks__/exercises-mock.js';

// Backend real desde 2026-09-12 (ver docs/BACKEND_API_GAPS.md, gap 4
// resuelto) — mismo patrón USE_MOCKS que el resto de dominios reales
// (services/teams.js, etc.), sin flag de forzado propio.

// GET /api/v1/exercises?owner_id=.
export async function listExercises({ ownerId } = {}) {
  if (USE_MOCKS) return await mockListExercises({ ownerId });
  const params = new URLSearchParams();
  if (ownerId != null) params.set('owner_id', ownerId);
  const query = params.toString();
  return await api.get(query ? `/exercises?${query}` : '/exercises');
}

// GET /api/v1/exercises/{id}.
export async function getExercise(exerciseId) {
  if (USE_MOCKS) return await mockGetExercise(exerciseId);
  return await api.get(`/exercises/${exerciseId}`);
}

// POST /api/v1/exercises.
export async function createExercise(payload) {
  if (USE_MOCKS) return await mockCreateExercise(payload);
  return await api.post('/exercises', payload);
}

// PUT /api/v1/exercises/{id} (parcial).
export async function updateExercise(exerciseId, updates) {
  if (USE_MOCKS) return await mockUpdateExercise(exerciseId, updates);
  return await api.put(`/exercises/${exerciseId}`, updates);
}

// DELETE /api/v1/exercises/{id}.
export async function deleteExercise(exerciseId) {
  if (USE_MOCKS) return await mockDeleteExercise(exerciseId);
  return await api.delete(`/exercises/${exerciseId}`);
}

// POST /api/v1/exercises/{id}/clone.
export async function cloneExercise(exerciseId) {
  if (USE_MOCKS) return await mockCloneExercise(exerciseId);
  return await api.post(`/exercises/${exerciseId}/clone`);
}
