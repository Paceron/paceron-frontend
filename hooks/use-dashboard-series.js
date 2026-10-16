import { useInfiniteQuery } from '@tanstack/react-query';
import { getDashboardExerciseSeries, DASHBOARD_DEFAULT_PAGE_SIZE } from '../services/dashboard.js';
import { useAuthStore } from '../store/auth-store.js';
import { DEFAULT_TOLERANCE } from '../utils/dashboard-format.js';
import { DASHBOARD_KEYS, dashboardRetry } from './use-dashboard-query.js';

// GET /dashboard/exercises/{id}/series: el detalle fila por fila del ejercicio.
//
// Es la fuente del dot plot (dispersión de las series del corredor), del box
// plot (consistencia) y de la exportación CSV. Sin este hook esos dos gráficos
// no tienen nada que dibujar.
//
// A diferencia del leaderboard, el backend NO exige rol de entrenador: la
// pantalla vive dentro del detalle de equipo y la fila es la del corredor que
// está mirando su propia progresión.
export function useDashboardSeries({
  exerciseId,
  groupId,
  distanceFromM,
  distanceToM,
  timeFromMin,
  timeToMin,
  from,
  to,
  tolerance = DEFAULT_TOLERANCE,
  pageSize = DASHBOARD_DEFAULT_PAGE_SIZE,
  enabled = true,
} = {}) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const scope = { exerciseId, groupId, distanceFromM, distanceToM, timeFromMin, timeToMin, from, to, tolerance };
  const paging = { pageSize };

  const query = useInfiniteQuery({
    queryKey: DASHBOARD_KEYS.series(scope, exerciseId, paging),
    queryFn: ({ pageParam }) => getDashboardExerciseSeries({ ...scope, ...paging, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage && lastPage.page * lastPage.page_size < lastPage.total ? lastPage.page + 1 : undefined
    ),
    enabled: enabled && Boolean(exerciseId) && Boolean(groupId),
    retry: dashboardRetry,
  });

  const pages = query.data?.pages ?? [];

  return {
    series: pages.flatMap((page) => page.series ?? []),
    total: pages[0]?.total ?? 0,
    units: pages[0]?.units ?? null,
    axis: pages[0]?.axis ?? null,
    hasTarget: pages[0]?.has_target ?? null,
    dataQuality: pages[0]?.data_quality ?? null,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage(),
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    failed: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
    role: activeRole,
  };
}