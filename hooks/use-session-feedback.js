import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createWorkoutFeedback } from '../services/workoutFeedback.js';
import {
  finishRunnerSession,
  getSessionFeedback,
  updateWorkoutFeedback,
} from '../services/runnerSession.js';
import { toFeedbackEditPayload, toSessionFeedbackListModel } from '../services/normalizers.js';
import { runnerSessionQueryKey } from './use-runner-session.js';

export function sessionFeedbackQueryKey(sessionInstanceId, athleteUserId) {
  return ['session-feedback', String(sessionInstanceId), String(athleteUserId)];
}

// Feedbacks de una sesión agrupados por ejercicio (una fila por set que se
// registró). Al habilitarse bajo `manual`, el listado igual consulta — el
// editor arranca vacío pero el 409→PATCH necesita conocer filas preexistentes.
export function useSessionFeedback(sessionInstanceId, athleteUserId, enabled = true) {
  const query = useQuery({
    queryKey: sessionFeedbackQueryKey(sessionInstanceId, athleteUserId),
    queryFn: async () => {
      const res = await getSessionFeedback(sessionInstanceId, athleteUserId);
      return toSessionFeedbackListModel(res?.data ?? []);
    },
    enabled: enabled && Boolean(sessionInstanceId && athleteUserId),
  });
  return { groups: query.data ?? [], loading: query.isFetching, refetch: query.refetch };
}

const findFeedbackId = (groups, exerciseId, setNumber) => {
  const group = groups.find((g) => g.exerciseId === String(exerciseId));
  return group?.sets.find((s) => s.setNumber === setNumber)?.id ?? null;
};

// Payload del POST manual (serie que nunca se registró) — mismo shape que el
// del sync (buildSetPayload) pero sin run local: la sesión de fecha pasada no
// tiene tiempos de arranque/parada que reportar.
export function buildManualSetPayload({ slot, exerciseId, setNumber, values }) {
  return {
    team_id: slot.teamId != null ? Number(slot.teamId) : null,
    assigned_session_id: Number(slot.sessionInstance?.id ?? slot.sessionInstanceId),
    assigned_exercise_id: Number(exerciseId),
    athlete_user_id: Number(slot.athleteUserId),
    report_source: slot.role === 'trainer' ? 'entrenador' : 'corredor',
    session_date: slot.date,
    completion_status: 'completed',
    started_at: null,
    ended_at: null,
    set_number: setNumber,
    duration_ms: values.durationMs != null ? Math.round(Number(values.durationMs)) : null,
    active_duration_ms: values.activeDurationMs != null ? Math.round(Number(values.activeDurationMs)) : null,
    distance_meters: values.distanceMeters != null ? Number(values.distanceMeters) : null,
  };
}

// Mutación de guardado de una serie: PATCH si la serie ya tiene fila
// (completed), POST /workout-feedback si no (modo manual) con el 409→PATCH de
// resiliencia (una serie que "sin registro" en manual pero que el backend
// tiene de un sync parcial).
export function useSaveSetMutation({ sessionInstanceId, athleteUserId }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: sessionFeedbackQueryKey(sessionInstanceId, athleteUserId) });

  return useMutation({
    mutationFn: async ({ feedback, editValues, createPayload }) => {
      if (feedback?.id) {
        return await updateWorkoutFeedback(feedback.id, toFeedbackEditPayload(editValues));
      }
      try {
        return await createWorkoutFeedback(createPayload);
      } catch (error) {
        if (error.status === 409) {
          const res = await getSessionFeedback(sessionInstanceId, athleteUserId);
          const groups = toSessionFeedbackListModel(res?.data ?? []);
          const existingId = findFeedbackId(groups, createPayload.assigned_exercise_id, createPayload.set_number);
          if (existingId) return await updateWorkoutFeedback(existingId, toFeedbackEditPayload(editValues));
        }
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// PATCH runner { finished } — completa la sesión (aparece el badge la próxima
// vez). Se dispara en manual cuando se completan todas las series.
export function useFinishRunnerMutation({ sessionInstanceId, athleteUserId }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => finishRunnerSession(sessionInstanceId, { athleteUserId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: runnerSessionQueryKey(sessionInstanceId, athleteUserId) }),
  });
}