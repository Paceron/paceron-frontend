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
    set_number: set.set_number,
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