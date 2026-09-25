import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockCreateRunnerSession,
  mockFinishRunnerSession,
  mockGetRunnerSession,
  mockGetSessionFeedback,
  mockUpdateWorkoutFeedback,
} from './__mocks__/runner-session-mock.js';

// Estado de sesión del corredor (runner_session) + feedback por sesión para
// la pantalla de "Registro de Sesión" — ver
// docs/superpowers/specs/2026-09-24-session-registration-review-design.md.
// El create es idempotente server-side (nunca duplica fila por
// session_instance_id + athlete_user_id): 201 si creó, 200 si ya existía.

const sessionPath = (sessionInstanceId) => `/session-instances/${Number(sessionInstanceId)}/runner`;

const withAthleteQuery = (athleteUserId) => (athleteUserId ? `?athlete_user_id=${Number(athleteUserId)}` : '');

// POST /api/v1/session-instances/:id/runner — crea el estado wip (idempotente).
export async function createRunnerSession(sessionInstanceId, { startDate, athleteUserId } = {}) {
  const body = {
    start_date: startDate ?? new Date().toISOString(),
  };
  if (athleteUserId != null) body.athlete_user_id = Number(athleteUserId);
  if (USE_MOCKS) return await mockCreateRunnerSession(sessionInstanceId, body);
  return await api.post(sessionPath(sessionInstanceId), body);
}

// PATCH /api/v1/session-instances/:id/runner — pasa a finished (idempotente,
// el end_date lo pone el servidor). Es lo que hace aparecer el badge.
export async function finishRunnerSession(sessionInstanceId, { athleteUserId } = {}) {
  const body = { status: 'finished' };
  if (athleteUserId != null) body.athlete_user_id = Number(athleteUserId);
  if (USE_MOCKS) return await mockFinishRunnerSession(sessionInstanceId, body);
  return await api.patch(sessionPath(sessionInstanceId), body);
}

// GET /api/v1/session-instances/:id/runner — estado actual. 404 (todavía no
// existe) se interpreta como "sin estado" → ver useRunnerSession.
export async function getRunnerSession(sessionInstanceId, athleteUserId) {
  if (USE_MOCKS) return await mockGetRunnerSession(sessionInstanceId, athleteUserId);
  return await api.get(`${sessionPath(sessionInstanceId)}${withAthleteQuery(athleteUserId)}`);
}

// GET /api/v1/session-instances/:id/feedback — los workout_feedback activos de
// la sesión (una fila por set registrado), ordenados por (ejercicio, serie).
export async function getSessionFeedback(sessionInstanceId, athleteUserId) {
  if (USE_MOCKS) return await mockGetSessionFeedback(sessionInstanceId, athleteUserId);
  return await api.get(
    `/session-instances/${Number(sessionInstanceId)}/feedback${withAthleteQuery(athleteUserId)}`,
  );
}

// GET /api/v1/workout-feedback/:id/points — puntos GPS de una serie (solo
// lectura en la revisión; se preservan tal como se grabaron).
export async function getWorkoutFeedbackPoints(feedbackId) {
  return await api.get(`/workout-feedback/${Number(feedbackId)}/points`);
}

// PUT /api/v1/workout-feedback/:id — edita tiempos/distancia de una serie
// existente (solo completion_status = 'completed').
export async function updateWorkoutFeedback(feedbackId, payload) {
  if (USE_MOCKS) return await mockUpdateWorkoutFeedback(feedbackId, payload);
  return await api.put(`/workout-feedback/${Number(feedbackId)}`, payload);
}