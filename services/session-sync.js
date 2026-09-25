import { getGpsPoints, getRun, getSetsForSync, markSetSynced } from './session-db.js';
import { createWorkoutFeedback, createWorkoutFeedbackPoints } from './workoutFeedback.js';
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
export async function syncRun(runId) {
  const run = await getRun(runId);
  if (!run) return { synced: 0, conflicts: 0, errors: [] };

  const sets = await getSetsForSync(runId);
  const result = { synced: 0, conflicts: 0, errors: [] };

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
      break;
    }
  }
  return result;
}