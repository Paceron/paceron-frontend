import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { getComparisons, getSessionComparison } from '../services/activity-comparison.js';
import { toComparisonListModel, toSessionComparisonModel } from '../services/normalizers.js';

// Estado de servidor de la comparación planificado vs realizado (Gap 35).
// Rango y filtros van en la key: cada combinación se cachea aparte.

export const ACTIVITY_COMPARISON_KEYS = {
  list: (userId) => ['activity-comparison', 'list', userId],
  session: (userId) => ['activity-comparison', 'session', userId],
};

export function useComparisonList({ dateFrom, dateTo, teamId, kind, enabled = true } = {}) {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: [...ACTIVITY_COMPARISON_KEYS.list(userId), dateFrom, dateTo, teamId ?? 'all', kind ?? 'all'],
    queryFn: () => getComparisons({ dateFrom, dateTo, teamId, kind }).then(toComparisonListModel),
    enabled: enabled && Boolean(userId) && Boolean(dateFrom) && Boolean(dateTo),
  });
  return {
    list: query.data ?? null,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useSessionComparison(sessionInstanceId, { athleteUserId, enabled = true } = {}) {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: [...ACTIVITY_COMPARISON_KEYS.session(userId), String(sessionInstanceId), athleteUserId ?? 'self'],
    queryFn: () => getSessionComparison({ sessionInstanceId, athleteUserId }).then(toSessionComparisonModel),
    enabled: enabled && Boolean(userId) && Boolean(sessionInstanceId),
    // Al terminar una ejecución se abre con lo recién sincronizado.
    staleTime: 0,
  });
  return {
    comparison: query.data ?? null,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
