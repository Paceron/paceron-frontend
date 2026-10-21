// Mock stateful en memoria — mismo patrón que el resto de services/__mocks__.
// Simula el ABM real de workout_feedback (create + points). Asigna ids
// incrementales y replica la única regla de dominio que importa para el sync:
// el mismo set activo (session, exercise, set_number) no se puede crear dos
// veces → 409 (unique_feedback_per_set del backend real).
let nextFeedbackId = 1;
const feedbacks = [];
const pointsByFeedback = new Map();

export function __resetWorkoutFeedbackMock() {
  feedbacks.length = 0;
  pointsByFeedback.clear();
  nextFeedbackId = 1;
}

// Seed de un intento de competencia de ruta ya completado y sincronizado
// (athlete_user_id 101, mismo runner_session seed de runner-session-mock.js)
// -- pedido real 2026-10-21, poder verificar en web el camino 'synced' del
// detalle de intento. assigned_session_id/assigned_exercise_id = 9000/90000
// (session_instance_id de la seed 7 de competitions-mock.js y su ejercicio
// sintético, id = session_instance_id * 10, ver mockCreateCompetitionAttempt).
// Puntos trazan aproximadamente la ruta de la seed 7
// (`[[-58.365,-34.660],[-58.364,-34.660],[-58.364,-34.661],[-58.365,-34.661]]`).
// Vive fuera de __resetWorkoutFeedbackMock por el mismo motivo que la seed
// de runner-session-mock.js -- los tests existentes esperan reset = vacío.
feedbacks.push({
  id: 9000,
  assigned_session_id: 9000,
  assigned_exercise_id: 90000,
  athlete_user_id: 101,
  team_id: 5,
  exercise_name: 'Corrida',
  set_number: 1,
  completion_status: 'completed',
  started_at: '2026-10-18T14:02:00Z',
  ended_at: '2026-10-18T14:03:47Z',
  duration_ms: 107000,
  active_duration_ms: 107000,
  distance_meters: 287,
  report_source: 'corredor',
  annotations: null,
  created_at: '2026-10-18T14:03:50Z',
  updated_at: '2026-10-18T14:03:50Z',
});
pointsByFeedback.set(9000, [
  { order: 0, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.660, longitude: -58.365, recorded_at: '2026-10-18T14:02:00Z' },
  { order: 1, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.660, longitude: -58.3645, recorded_at: '2026-10-18T14:02:30Z' },
  { order: 2, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.6605, longitude: -58.364, recorded_at: '2026-10-18T14:03:00Z' },
  { order: 3, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.661, longitude: -58.364, recorded_at: '2026-10-18T14:03:25Z' },
  { order: 4, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.661, longitude: -58.365, recorded_at: '2026-10-18T14:03:47Z' },
]);
nextFeedbackId = 9001;

// Accesores compartidos con runner-session-mock: GET feedback por sesión y
// GET points leen de la MISMA lista que crea el sync/los POSTs manuales,
// para que en modo mocks la pantalla de revisión muestre lo que se guardó.
export function __getMockFeedbacks() {
  return feedbacks;
}

export function __getMockPoints(feedbackId) {
  return pointsByFeedback.get(Number(feedbackId)) ?? [];
}

export async function mockCreateWorkoutFeedback(payload) {
  const duplicated = feedbacks.some(
    (f) =>
      f.assigned_session_id === payload.assigned_session_id &&
      f.assigned_exercise_id === payload.assigned_exercise_id &&
      f.set_number === payload.set_number &&
      f.athlete_user_id === payload.athlete_user_id,
  );
  if (duplicated) {
    const error = new Error('El set ya fue registrado');
    error.status = 409;
    error.data = { message: error.message };
    throw error;
  }
  const feedback = { id: nextFeedbackId++, ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  feedbacks.push(feedback);
  return { message: 'feedback registrado', data: feedback };
}

export async function mockCreateWorkoutFeedbackPoints(feedbackId, payload) {
  const existing = feedbacks.find((f) => f.id === Number(feedbackId));
  if (!existing) {
    const error = new Error('Feedback not found');
    error.status = 404;
    error.data = { message: error.message };
    throw error;
  }
  const points = pointsByFeedback.get(Number(feedbackId)) ?? [];
  let skipped = 0;
  for (const point of payload.points) {
    if (points.some((p) => p.order === point.order)) {
      skipped += 1;
      continue;
    }
    points.push(point);
  }
  points.sort((a, b) => a.order - b.order);
  pointsByFeedback.set(Number(feedbackId), points);
  return { message: 'puntos registrados', data: { created: payload.points.length - skipped, skipped } };
}