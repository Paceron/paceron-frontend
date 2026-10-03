import { useQuery } from '@tanstack/react-query';
import { getSessionInstance } from '../services/sessionInstances.js';
import { toSessionInstanceModel } from '../services/normalizers.js';

// Fetch de una instancia de sesión completa por id sola (Gap 14) — solo se
// habilita cuando el caller no tiene ya el objeto completo en memoria (ver
// session-review-screen.jsx#ReviewFlow). `refetchInterval` (Gap 26) es lo que
// usa la sala de espera del pre-start del corredor para detectar
// presencialOpen/openedAt/closedAt sin WS -- mismo criterio de polling que
// AttendanceSessionModal.
export function useSessionInstance(sessionInstanceId, enabled, { refetchInterval } = {}) {
  const query = useQuery({
    queryKey: ['session-instance', String(sessionInstanceId)],
    // api.get() devuelve el body crudo (sin envolver en `{data}` — a
    // diferencia de otros endpoints hermanos bajo /session-instances/:id/*
    // (runner, feedback) cuyo backend sí envuelve su respuesta así). Este
    // endpoint (Gap 14) devuelve el objeto plano; se tolera igual el caso
    // envuelto por si el backend cambia de convención más adelante.
    queryFn: () => getSessionInstance(sessionInstanceId).then((res) => toSessionInstanceModel(res?.data ?? res ?? null)),
    enabled: Boolean(sessionInstanceId) && enabled,
    refetchInterval,
  });
  return { sessionInstance: query.data ?? null, loading: query.isLoading };
}
