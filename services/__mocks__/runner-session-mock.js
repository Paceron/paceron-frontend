// Mock stateful en memoria de runner_session + feedback por sesión — mismo
// patrón que el resto de services/__mocks__. Replica las reglas de dominio
// que importan para la pantalla de revisión:
// - create idempotente: misma (session_instance_id, athlete_user_id) → 200 con
//   el estado actual, nunca duplica ni baja de finished a wip.
// - finish solo desde wip; ya finished → idempotente.
// - get sin fila → 404.
// - GET feedback de una sesión lee la lista compartida de workout-feedback
//   (ver __getMockFeedbacks) para que lo creado por el sync/aparezca acá.
import { __getMockFeedbacks, __getMockPoints } from './workoutFeedback-mock.js';

let nextRunnerSessionId = 1;
const runnerSessions = [];

export function __resetRunnerSessionMock() {
  runnerSessions.length = 0;
  nextRunnerSessionId = 1;
}

// Seed para pruebas deterministas de la pantalla de revisión.
export function __seedRunnerSession(dto) {
  const row = { id: nextRunnerSessionId++, status: 'wip', end_date: null, ...dto };
  runnerSessions.push(row);
  return row;
}

function findRow(sessionInstanceId, athleteUserId) {
  return runnerSessions.find(
    (r) => r.session_instance_id === Number(sessionInstanceId) && r.athlete_user_id === Number(athleteUserId),
  );
}

const toResponse = (row) => ({
  id: row.id,
  session_instance_id: row.session_instance_id,
  athlete_user_id: row.athlete_user_id,
  status: row.status,
  start_date: row.start_date,
  end_date: row.end_date ?? null,
});

export async function mockCreateRunnerSession(sessionInstanceId, body) {
  const athleteUserId = body.athlete_user_id ?? 0;
  const existing = findRow(sessionInstanceId, athleteUserId);
  if (existing) {
    return { message: 'el estado de sesión ya existía', data: toResponse(existing) };
  }
  const row = {
    id: nextRunnerSessionId++,
    session_instance_id: Number(sessionInstanceId),
    athlete_user_id: athleteUserId,
    status: 'wip',
    start_date: body.start_date,
    end_date: null,
  };
  runnerSessions.push(row);
  return { message: 'estado de sesión creado', data: toResponse(row) };
}

export async function mockFinishRunnerSession(sessionInstanceId, body) {
  const athleteUserId = body.athlete_user_id ?? 0;
  const row = findRow(sessionInstanceId, athleteUserId);
  if (!row) {
    const error = new Error('estado de sesión no encontrado');
    error.status = 404;
    error.data = { message: error.message };
    throw error;
  }
  if (row.status === 'wip') {
    row.status = 'finished';
    row.end_date = new Date().toISOString();
  }
  return { message: 'sesión marcada como completada', data: toResponse(row) };
}

export async function mockGetRunnerSession(sessionInstanceId, athleteUserId) {
  const row = findRow(sessionInstanceId, athleteUserId);
  if (!row) {
    const error = new Error('estado de sesión no encontrado');
    error.status = 404;
    error.data = { message: error.message };
    throw error;
  }
  return { data: toResponse(row) };
}

function findBySession(sessionInstanceId, athleteUserId) {
  return __getMockFeedbacks().filter(
    (f) =>
      f.assigned_session_id === Number(sessionInstanceId) && f.athlete_user_id === Number(athleteUserId),
  );
}

function toFeedbackResponse(f) {
  return {
    ...f,
    points_count: __getMockPoints(f.id).length,
  };
}

export async function mockGetSessionFeedback(sessionInstanceId, athleteUserId) {
  const rows = findBySession(sessionInstanceId, athleteUserId);
  return { data: rows.map(toFeedbackResponse) };
}

export async function mockUpdateWorkoutFeedback(feedbackId, payload) {
  const feedback = __getMockFeedbacks().find((f) => f.id === Number(feedbackId));
  if (!feedback) {
    const error = new Error('Feedback not found');
    error.status = 404;
    error.data = { message: error.message };
    throw error;
  }
  Object.assign(feedback, payload, { updated_at: new Date().toISOString() });
  return { message: 'feedback actualizado', data: feedback };
}