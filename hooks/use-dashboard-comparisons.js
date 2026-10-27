import { useQuery } from '@tanstack/react-query';
import { postDashboardComparisons, postDashboardPeriods } from '../services/dashboard.js';
import { useAuthStore } from '../store/auth-store.js';
import { DEFAULT_TOLERANCE } from '../utils/dashboard-format.js';
import { DASHBOARD_KEYS, DASHBOARD_METRIC_QUERY_OPTIONS, dashboardRetry } from './use-dashboard-query.js';

// Los dos POST de comparación. Son solo del dueño del equipo —el backend
// responde 403 a un corredor—, así que los dos hooks quedan deshabilitados para
// el rol corredor: la variante del corredor de la pantalla ni los monta (no
// hay nada que comparar consigo mismo), y si alguno quedara montado en otra
// rama no dispara la request igual.
//
// `compliance_pp` son puntos porcentuales y `best_time_pct` ya viene con el signo
// invertido: bajar el tiempo es mejorar.

// POST /dashboard/comparisons: una fila por corredor comparable del scope, con su
// tendencia. Sin `athleteUserIds` compara a todo el scope del equipo.
export function useDashboardComparisons({
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
  athleteUserIds,
  enabled = true,
} = {}) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const scope = { teamId, groupId, exerciseId, exerciseIds, kind, distanceFromM, distanceToM, timeFromMin, timeToMin, from, to, tolerance };

  const query = useQuery({
    ...DASHBOARD_METRIC_QUERY_OPTIONS,
    queryKey: DASHBOARD_KEYS.comparisons(scope, athleteUserIds),
    queryFn: () => postDashboardComparisons({ ...scope, athleteUserIds }),
    enabled: enabled && Boolean(teamId) && activeRole === 'trainer',
    retry: dashboardRetry,
  });

  return {
    data: query.data ?? null,
    series: query.data?.series ?? [],
    loading: query.isLoading,
    failed: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

// POST /dashboard/comparisons/periods: el período actual contra el anterior. Sin
// `previous`, el backend lo deriva desplazando `current` hacia atrás exactamente
// su misma cantidad de días.
export function useDashboardPeriodComparison({
  teamId,
  groupId,
  exerciseId,
  exerciseIds,
  kind,
  distanceFromM,
  distanceToM,
  timeFromMin,
  timeToMin,
  current,
  previous,
  tolerance = DEFAULT_TOLERANCE,
  enabled = true,
} = {}) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const scope = { teamId, groupId, exerciseId, exerciseIds, kind, distanceFromM, distanceToM, timeFromMin, timeToMin, tolerance };
  const ranges = { current, previous };

  const query = useQuery({
    ...DASHBOARD_METRIC_QUERY_OPTIONS,
    queryKey: DASHBOARD_KEYS.periods(scope, ranges),
    queryFn: () => postDashboardPeriods({ ...scope, current, previous }),
    enabled: enabled && Boolean(teamId) && Boolean(current?.from) && activeRole === 'trainer',
    retry: dashboardRetry,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    failed: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
