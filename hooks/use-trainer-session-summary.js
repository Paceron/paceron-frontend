import { useQueries } from '@tanstack/react-query';
import { getRunnerSession, getSessionFeedback } from '../services/runnerSession.js';
import { toRunnerSessionModel, toSessionFeedbackModel } from '../services/normalizers.js';
import { runnerSessionQueryKey } from './use-runner-session.js';
import { exerciseNameById } from '../utils/trainer-participant-progress.js';
import { appendFeedEvent } from '../utils/trainer-records-feed.js';

// Resumen ESTÁTICO post-sesión para el entrenador: mismo dato que
// use-trainer-session-runtime.js resuelve por REST al bootstrapear (feedback
// por atleta + estado de runner_session), pero sin WS/GPS/presencia -- acá no
// hay nada "en vivo" que seguir, la sesión ya terminó (o el entrenador la
// cerró). A diferencia del hook en vivo, no hay reducer ni estado local: es
// una proyección directa de las queries en cada render.
export function useTrainerSessionSummary({ sessionInstanceId, exercises, rosterMembers }) {
  const feedbackQueries = useQueries({
    queries: (rosterMembers ?? []).map((member) => ({
      queryKey: ['session-feedback', sessionInstanceId, member.userId],
      queryFn: () => getSessionFeedback(sessionInstanceId, member.userId),
      enabled: Boolean(sessionInstanceId && member.userId),
    })),
  });

  const statusQueries = useQueries({
    queries: (rosterMembers ?? []).map((member) => ({
      queryKey: runnerSessionQueryKey(sessionInstanceId, member.userId),
      queryFn: async () => {
        try {
          const res = await getRunnerSession(sessionInstanceId, member.userId);
          return toRunnerSessionModel(res?.data ?? null);
        } catch (error) {
          if (error.status === 404) return null;
          throw error;
        }
      },
      enabled: Boolean(sessionInstanceId && member.userId),
    })),
  });

  const loading = feedbackQueries.some((q) => q.isLoading) || statusQueries.some((q) => q.isLoading);

  let feed = [];
  const participants = (rosterMembers ?? []).map((member, index) => {
    const rows = (feedbackQueries[index]?.data?.data ?? []).map(toSessionFeedbackModel).filter(Boolean);
    for (const row of rows) {
      feed = appendFeedEvent(feed, {
        id: row.id,
        athleteUserId: String(member.userId),
        athleteName: member.name,
        athletePhotoUrl: member.photoUrl ?? null,
        exerciseName: exerciseNameById(exercises, row.assignedExerciseId),
        setNumber: row.setNumber,
        status: row.completionStatus,
        timestamp: new Date(row.updatedAt ?? row.endedAt ?? 0).getTime(),
      });
    }
    return {
      userId: String(member.userId),
      name: member.name,
      photoUrl: member.photoUrl ?? null,
      // null (nunca se unió/nunca creó runner_session), 'wip' (arrancó pero
      // nunca quedó en un estado terminal -- no debería pasar si el cierre en
      // cascada funcionó, pero posible si nunca volvió a abrir la app),
      // 'finished' o 'interrupted'.
      runnerStatus: statusQueries[index]?.data?.status ?? null,
      resolvedSetCount: rows.length,
    };
  });

  return { participants, feed, loading };
}
