// Construcción PURA de los payloads de sync contra workout_feedback. Sin
// SQLite ni fetch a propósito — es lo único del pipeline de sync testeable
// con Jest.
export const COMPLETION_STATUS = {
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
};

const toNumberOrNull = (value) => (value == null ? null : Number(value));

export function buildSetPayload({ set, run }) {
  const base = {
    team_id: toNumberOrNull(run.team_id),
    assigned_session_id: Number(run.session_instance_id),
    assigned_exercise_id: Number(set.exercise_instance_id),
    athlete_user_id: toNumberOrNull(run.athlete_user_id),
    report_source: run.report_source ?? 'corredor',
    session_date: run.session_date,
    // set.set_number es 0-indexado en el almacenamiento local (session-db.js,
    // "Serie N" en pantalla siempre le suma 1 al mostrarlo) -- el backend
    // espera 1-indexado, mismo criterio que ya usa buildManualSetPayload
    // (arma set_number a partir de un `i + 1`). Sin este +1, cualquier
    // sesión sincronizada por este camino (vivo o asíncrono) queda con
    // set_number=0,1,2... y la revisión, que busca 1,2,3..., nunca matchea
    // ninguna fila -- "Sin registro" para todo lo sincronizado (bug real,
    // 2026-09-30, confirmado con datos reales de workout_feedback).
    set_number: set.set_number + 1,
  };

  if (set.status === 'skipped') {
    return {
      ...base,
      completion_status: COMPLETION_STATUS.SKIPPED,
      started_at: null,
      ended_at: null,
      duration_ms: null,
      active_duration_ms: null,
      distance_meters: null,
    };
  }

  return {
    ...base,
    completion_status: COMPLETION_STATUS.COMPLETED,
    started_at: set.started_at ?? null,
    ended_at: set.ended_at ?? null,
    duration_ms: set.duration_ms ?? null,
    active_duration_ms: set.active_duration_ms ?? null,
    distance_meters: set.distance_meters ?? null,
  };
}

export function buildPointsPayload({ run, set, points }) {
  return {
    points: (points ?? []).map((point) => ({
      order: point.point_order,
      session_instance_id: Number(run.session_instance_id),
      exercise_instance_id: Number(set.exercise_instance_id),
      latitude: point.latitude,
      longitude: point.longitude,
      recorded_at: new Date(point.recorded_at_ms).toISOString(),
    })),
  };
}