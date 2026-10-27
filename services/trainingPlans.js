import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListTrainingPlans,
  mockGetTrainingPlan,
  mockCreateTrainingPlan,
  mockUpdateTrainingPlan,
  mockDeleteTrainingPlan,
  mockCloneTrainingPlan,
} from './__mocks__/training-plans-mock.js';

// Catálogo (TrainingPlan/PlanDay) contra backend real desde 2026-09-12
// (ver docs/BACKEND_API_GAPS.md, gap 4 resuelto) — mismo patrón
// USE_MOCKS que el resto de dominios reales, sin flag de forzado
// propio.

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
