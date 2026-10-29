import { useQuery } from '@tanstack/react-query';
import { getRunnerKpis } from '../services/runner-kpis.js';
import { dashboardRetry } from './use-dashboard-query.js';
import { runnerKpisQueryKey } from '../utils/runner-kpis.js';

// GET /dashboard/runner-kpis para la tarjeta del Home.
//
// Sin `placeholderData: keepPreviousData` a propósito (design.md D4): entre
// pestañas mostraría por un instante los números de la anterior. Tampoco hay
// prefetch de las otras tres ni `refetchInterval`: el Home pide solo la pestaña
// activa y no sondea.
//
// `staleTime: 0` deja que volver a una pestaña ya vista muestre el cache y
// revalide en segundo plano. `loading` solo es true cuando no hay dato para esa
// combinación; con cache, `refreshing` alcanza para el indicador discreto.
export function useRunnerKpis({ period = 'month', referenceDate, tab = 'general' } = {}) {
  const query = useQuery({
    queryKey: runnerKpisQueryKey({ period, referenceDate, tab }),
    queryFn: () => getRunnerKpis({ period, referenceDate, tab }),
    staleTime: 0,
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
