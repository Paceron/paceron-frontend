import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockCreateWorkoutFeedback, mockCreateWorkoutFeedbackPoints } from './__mocks__/workoutFeedback-mock.js';

// Feedback de entrenamiento contra el backend real (módulo que ya existe y
// tiene su ABM completo — ver docs/BACKEND_API_GAPS.md Gap 12, resuelto en
// parte por esta integración). Un set de un ejercicio = una fila de
// workout_feedback; 409 = ya existe el mismo set activo
// (unique_feedback_per_set), el caller lo interpreta como "ya syncado".

// POST /api/v1/workout-feedback
export async function createWorkoutFeedback(payload) {
  if (USE_MOCKS) return await mockCreateWorkoutFeedback(payload);
  return await api.post('/workout-feedback', payload);
}

// POST /api/v1/workout-feedback/:id/points — bulk de puntos GPS de una serie.
// Idempotente server-side (ON CONFLICT (feedback_id, order) DO NOTHING).
export async function createWorkoutFeedbackPoints(feedbackId, payload) {
  if (USE_MOCKS) return await mockCreateWorkoutFeedbackPoints(feedbackId, payload);
  return await api.post(`/workout-feedback/${feedbackId}/points`, payload);
}