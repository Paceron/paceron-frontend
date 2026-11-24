import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { getTrainerHomeKpis } from '../services/trainer-home-kpis.js';
import { toTrainerHomeKpisModel } from '../services/normalizers.js';
import { dashboardRetry } from './use-dashboard-query.js';

export function trainerHomeKpisQueryKey({ userId, period, referenceDate } = {}) {
  return ['trainer-home-kpis', userId ?? null, period ?? 'month', referenceDate ?? null];
}

export function trainerHomeKpisQueryOptions({ userId, period = 'month', referenceDate } = {}) {
  return {
    queryKey: trainerHomeKpisQueryKey({ userId, period, referenceDate }),
    queryFn: () => getTrainerHomeKpis({ period, referenceDate }).then(toTrainerHomeKpisModel),
    enabled: Boolean(userId),
    retry: dashboardRetry,
  };
}

export function useTrainerHomeKpis({
  period = 'month',
  referenceDate,
  enabled = true,
} = {}) {
  const userId = useAuthStore((state) => state.userId);
  const query = useQuery({
    ...trainerHomeKpisQueryOptions({ userId, period, referenceDate }),
    enabled: Boolean(userId) && enabled,
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
