import { useQuery } from '@tanstack/react-query';
import { getRunnerSession } from '../services/runnerSession.js';
import { toRunnerSessionModel } from '../services/normalizers.js';

export function runnerSessionQueryKey(sessionInstanceId, athleteUserId) {
  return ['runner-session', String(sessionInstanceId), String(athleteUserId)];
}

// Estado de la sesión del corredor (runner_session) — la fuente de verdad
// del badge "Sesión completada" y de la rama review/manual del pre-start y de
// la entrada web del corredor. 404 (todavía sin estado) → null.
export function useRunnerSession(sessionInstanceId, athleteUserId) {
  const query = useQuery({
    queryKey: runnerSessionQueryKey(sessionInstanceId, athleteUserId),
    queryFn: async () => {
      try {
        const res = await getRunnerSession(sessionInstanceId, athleteUserId);
        return toRunnerSessionModel(res?.data ?? null);
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(sessionInstanceId && athleteUserId),
  });
  return { runnerSession: query.data ?? null, loading: query.isFetching, refetch: query.refetch };
}