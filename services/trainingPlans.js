import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListTrainingPlans,
  mockGetTrainingPlan,
  mockCreateTrainingPlan,
  mockUpdateTrainingPlan,
  mockDeleteTrainingPlan,
  mockCloneTrainingPlan,
  mockListRunnerPlanAssignments,
  mockAssignPlanToRunner,
  mockUnassignPlanFromRunner,
  mockListCurrentPlanMarks,
  mockMarkPlanAsCurrent,
  mockUnmarkPlanAsCurrent,
} from './__mocks__/training-plans-mock.js';

// Sin backend real de planes de entrenamiento todavía (ver
// docs/BACKEND_API_GAPS.md, gap 4) — USE_MOCKS siempre gana acá hoy. Las
// rutas de abajo son las esperadas, mismo estilo que services/teams.js,
// para que alcance con que el backend las implemente y nada más cambie
// de este lado.

// GET /api/v1/training-plans?owner_id=.
export async function listTrainingPlans({ ownerId } = {}) {
  if (USE_MOCKS) return await mockListTrainingPlans({ ownerId });
  const params = new URLSearchParams();
  if (ownerId != null) params.set('owner_id', ownerId);
  const query = params.toString();
  return await api.get(query ? `/training-plans?${query}` : '/training-plans');
}

// GET /api/v1/training-plans/{id}.
export async function getTrainingPlan(planId) {
  if (USE_MOCKS) return await mockGetTrainingPlan(planId);
  return await api.get(`/training-plans/${planId}`);
}

// POST /api/v1/training-plans.
export async function createTrainingPlan(payload) {
  if (USE_MOCKS) return await mockCreateTrainingPlan(payload);
  return await api.post('/training-plans', payload);
}

// PUT /api/v1/training-plans/{id} (parcial).
export async function updateTrainingPlan(planId, updates) {
  if (USE_MOCKS) return await mockUpdateTrainingPlan(planId, updates);
  return await api.put(`/training-plans/${planId}`, updates);
}

// DELETE /api/v1/training-plans/{id}.
export async function deleteTrainingPlan(planId) {
  if (USE_MOCKS) return await mockDeleteTrainingPlan(planId);
  return await api.delete(`/training-plans/${planId}`);
}

// POST /api/v1/training-plans/{id}/clone.
export async function cloneTrainingPlan(planId) {
  if (USE_MOCKS) return await mockCloneTrainingPlan(planId);
  return await api.post(`/training-plans/${planId}/clone`);
}

// GET /api/v1/training-plans/assignments?user_id=&plan_id=.
export async function listRunnerPlanAssignments({ userId, planId } = {}) {
  if (USE_MOCKS) return await mockListRunnerPlanAssignments({ userId, planId });
  const params = new URLSearchParams();
  if (userId != null) params.set('user_id', userId);
  if (planId != null) params.set('plan_id', planId);
  return await api.get(`/training-plans/assignments?${params.toString()}`);
}

// POST /api/v1/training-plans/{id}/assignments — asigna a un corredor
// individual (reemplaza cualquier asignación individual previa de ese
// corredor). La asignación a un grupo NO pasa por acá — reusa
// group.trainingPlanId, ver store/team-store.js#setGroupTrainingPlan.
export async function assignPlanToRunner(planId, userId) {
  if (USE_MOCKS) return await mockAssignPlanToRunner(planId, userId);
  return await api.post(`/training-plans/${planId}/assignments`, { user_id: userId });
}

// DELETE /api/v1/training-plans/assignments/{user_id}.
export async function unassignPlanFromRunner(userId) {
  if (USE_MOCKS) return await mockUnassignPlanFromRunner(userId);
  return await api.delete(`/training-plans/assignments/${userId}`);
}

// "Plan actual" — preferencia del corredor, no una asignación nueva. Sin
// equivalente real en el backend todavía (gap 4, igual que el resto de
// este archivo).

// GET /api/v1/training-plans/current-marks?user_id=.
export async function listCurrentPlanMarks({ userId } = {}) {
  if (USE_MOCKS) return await mockListCurrentPlanMarks({ userId });
  const params = new URLSearchParams();
  if (userId != null) params.set('user_id', userId);
  return await api.get(`/training-plans/current-marks?${params.toString()}`);
}

// POST /api/v1/training-plans/{id}/current-marks — tope de 2 por
// corredor, se hace cumplir del lado del servicio (ver mock).
export async function markPlanAsCurrent(userId, planId) {
  if (USE_MOCKS) return await mockMarkPlanAsCurrent(userId, planId);
  return await api.post(`/training-plans/${planId}/current-marks`, { user_id: userId });
}

// DELETE /api/v1/training-plans/{id}/current-marks/{user_id}.
export async function unmarkPlanAsCurrent(userId, planId) {
  if (USE_MOCKS) return await mockUnmarkPlanAsCurrent(userId, planId);
  return await api.delete(`/training-plans/${planId}/current-marks/${userId}`);
}
