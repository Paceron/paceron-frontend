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
    // staleTime 0 (no el default global de 60s) -- este estado decide la
    // rama review/manual del pre-start (`alreadyStarted`) y puede cambiar
    // por fuera de este dispositivo (el entrenador edita el feedback, o en
    // dev un `make demo-restore` reabre la sesión en el backend). Con el
    // default, volver a este mismo sessionInstanceId sin pasar por
    // foreground/background (ver ForegroundRefetch en app-providers.jsx)
    // podía quedarse mostrando "Sesión completada" ya vencido -- bug real
    // reportado, 2026-10-08: el corredor seguía viendo el registro de una
    // sesión que el backend ya había vuelto a abrir.
    staleTime: 0,
  });
  return { runnerSession: query.data ?? null, loading: query.isFetching, refetch: query.refetch };
}