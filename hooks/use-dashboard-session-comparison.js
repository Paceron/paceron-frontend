import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { getDashboardGroupAthletes, postDashboardSessionComparison } from '../services/dashboard.js';
import { DASHBOARD_KEYS, dashboardRetry } from './use-dashboard-query.js';

function hasRef(ref) {
  return Boolean(ref?.groupId && ref?.athleteUserId && ref?.sessionInstanceId && ref?.exerciseId);
}

// Los roster por grupo solo se piden para el entrenador y se cachean por grupo.
// El corredor ya viene fijado al usuario autenticado y no necesita leer datos
// ajenos para poblar un selector.
export function useDashboardGroupAthletes({ teamId, groupId, enabled = true } = {}) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const query = useQuery({
    queryKey: ['dashboard', 'comparison-athletes', String(teamId ?? ''), String(groupId ?? '')],
    queryFn: () => getDashboardGroupAthletes({ teamId, groupId }),
    enabled: enabled && activeRole === 'trainer' && Boolean(teamId) && Boolean(groupId),
    retry: dashboardRetry,
  });

  return {
    athleteIds: query.data ?? [],
    loading: query.isLoading,
    failed: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

// POST /dashboard/comparisons/sessions. No reusa `keepPreviousData`: una
// comparación anterior no debe quedar rotulada como si correspondiera a las
// referencias A/B que se acaban de elegir.
export function useDashboardSessionComparison({ teamId, from, to, a, b, enabled = true } = {}) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const request = { teamId, from, to, a, b };
  const ready = Boolean(teamId && from && to && hasRef(a) && hasRef(b));
  const query = useQuery({
    queryKey: DASHBOARD_KEYS.sessionComparison(request),
    queryFn: () => postDashboardSessionComparison(request),
    enabled: enabled && ready && (activeRole === 'trainer' || activeRole === 'runner'),
    retry: dashboardRetry,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    fetching: query.isFetching,
    failed: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
