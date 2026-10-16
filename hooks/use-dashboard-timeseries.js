import { useQuery } from '@tanstack/react-query';
import { getDashboardTimeseries, DASHBOARD_GRANULARITIES } from '../services/dashboard.js';
import { DEFAULT_TOLERANCE } from '../utils/dashboard-format.js';
import { DASHBOARD_KEYS, DASHBOARD_POLL_INTERVAL_MS, dashboardRetry } from './use-dashboard-query.js';

// GET /dashboard/metrics/timeseries: la evolución, con los mismos KPIs del
// resumen en cada bucket de calendario.
//
// `granularity` va parametrizado por el usuario (session/week/month/quarter) y
// entra en la query key: cambiar el anclaje cambia el shape de la respuesta, no
// es un filtro más. Los anclajes son de calendario, así que un bucket puede
// empezar antes del `from` — no es un bug del backend.
export function useDashboardTimeseries({
  teamId,
  groupId,
  exerciseId,
  exerciseIds,
  kind,
  distanceFromM,
  distanceToM,
  timeFromMin,
  timeToMin,
  from,
  to,
  tolerance = DEFAULT_TOLERANCE,
  granularity = DASHBOARD_GRANULARITIES[0],
  enabled = true,
} = {}) {
  const scope = { teamId, groupId, exerciseId, exerciseIds, kind, distanceFromM, distanceToM, timeFromMin, timeToMin, from, to, tolerance };
  const query = useQuery({
    queryKey: DASHBOARD_KEYS.timeseries(scope, granularity),
    queryFn: () => getDashboardTimeseries({ ...scope, granularity }),
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