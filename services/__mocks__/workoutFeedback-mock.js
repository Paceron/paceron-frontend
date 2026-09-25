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
      f.set_number === payload.set_number,
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