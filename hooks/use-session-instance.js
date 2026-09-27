import { useQuery } from '@tanstack/react-query';
import { getSessionInstance } from '../services/sessionInstances.js';
import { toSessionInstanceModel } from '../services/normalizers.js';

// Fetch de una instancia de sesión completa por id sola (Gap 14) — solo se
// habilita cuando el caller no tiene ya el objeto completo en memoria (ver
// session-review-screen.jsx#ReviewFlow).
export function useSessionInstance(sessionInstanceId, enabled) {
  const query = useQuery({
    queryKey: ['session-instance', String(sessionInstanceId)],
    queryFn: () => getSessionInstance(sessionInstanceId).then((res) => toSessionInstanceModel(res?.data ?? null)),
    enabled: Boolean(sessionInstanceId) && enabled,
  });
  return { sessionInstance: query.data ?? null, loading: query.isLoading };
}
