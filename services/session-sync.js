import {
  getGpsPoints,
  getRun,
  getSetsForSync,
  markRunnerSessionCreated,
  markRunnerSessionFinished,
  markSetSynced,
} from './session-db.js';
import { createWorkoutFeedback, createWorkoutFeedbackPoints } from './workoutFeedback.js';
import { createRunnerSession, finishRunnerSession } from './runnerSession.js';
import { buildPointsPayload, buildSetPayload } from '../utils/session-sync-payload.js';

// Orquestador de sync: popular el backend con los sets de un run ya
// registrados. Cada set es un POST /workout-feedback; si el set tiene
// distancia y puntos, después se suben los puntos con el POST
// /workout-feedback/:id/points del feedback recién creado.
//
// Idempotencia: el índice único unique_feedback_per_set del backend hace que
// reintentar un set ya creado devuelva 409 — se interpreta como "ya existía",
// se marca `synced` y se continúa. Ante error de red/5xx se corta el loop y el
// set fallido queda sin `synced` para que el caller ofrezca reintentarlo.
//
// Estado runner_session (spec session-registration-review): el upsert idempotente
// del create corre ANTES del primer POST feedback (un Play offline pierde el
// fire-and-forget del pre-start; acá se recupera), y el PATCH finished solo
// cuando el run quedó `completed` (cancelar NO completa la sesión). Cada paso
// se marca en la fila local para no reintentar lo ya logrado.
export async function syncRun(runId) {
  const run = await getRun(runId);
  if (!run) return { synced: 0, conflicts: 0, errors: [] };

  const result = { synced: 0, conflicts: 0, errors: [] };

  if (!run.runner_session_created) {
    try {
      await createRunnerSession(run.session_instance_id, {
        startDate: run.started_at ?? undefined,
        athleteUserId: run.athlete_user_id ?? undefined,
      });
      await markRunnerSessionCreated(runId);
    } catch (error) {
      result.errors.push({ error, step: 'create_runner_session' });
      return result;
    }
  }

  const sets = await getSetsForSync(runId);

  for (const set of sets) {
    try {
      const response = await createWorkoutFeedback(buildSetPayload({ set, run }));
      const feedbackId = response?.data?.id;
      if (feedbackId != null && set.status === 'finished' && set.distance_meters != null) {
        const points = await getGpsPoints(set.id);
        if (points.length) {
          await createWorkoutFeedbackPoints(feedbackId, buildPointsPayload({ run, set, points }));
        }
      }
      await markSetSynced(set.id);
      result.synced += 1;
    } catch (error) {
      if (error.status === 409) {
        await markSetSynced(set.id);
        result.conflicts += 1;
        continue;
      }
      result.errors.push({ set, error });
      return result;
    }
  }

  if (run.status === 'completed' && !run.runner_session_finished) {
    try {
      await finishRunnerSession(run.session_instance_id, {
        athleteUserId: run.athlete_user_id ?? undefined,
      });
      await markRunnerSessionFinished(runId);
    } catch (error) {
      if (error.status !== 409) {
        result.errors.push({ error, step: 'finish_runner_session' });
      }
    }
  }

  return result;
}