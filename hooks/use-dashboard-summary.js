import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '../services/dashboard.js';
import { DEFAULT_TOLERANCE } from '../utils/dashboard-format.js';
import { DASHBOARD_KEYS, DASHBOARD_POLL_INTERVAL_MS, dashboardRetry } from './use-dashboard-query.js';

// GET /dashboard/metrics/summary: los KPIs del período (totales, cumplimiento,
// mejor tiempo, consistencia, tendencia y estado de los datos).
//
// Sondea cada 90 s (spec: 60-120 s). `loading` sale de `isLoading`, que en
// TanStack Query v5 es `isPending && isFetching`: durante un sondeo hay datos en
// pantalla y `loading` sigue en false, así que la pantalla NO vuelve al skeleton
// en cada ciclo (D7). Para el fondo se usa `refreshing`.
export function useDashboardSummary({
  teamId,
  groupId,
  exerciseId,
  exerciseIds,
  kinds,
  from,
  to,
  tolerance = DEFAULT_TOLERANCE,
  enabled = true,
} = {}) {
  const scope = { teamId, groupId, exerciseId, exerciseIds, kinds, from, to, tolerance };
  const query = useQuery({
    queryKey: DASHBOARD_KEYS.summary(scope),
    queryFn: () => getDashboardSummary(scope),
    enabled: enabled && Boolean(teamId),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
    retry: dashboardRetry,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading,
    failed: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}