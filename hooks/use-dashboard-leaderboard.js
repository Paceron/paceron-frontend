import { useInfiniteQuery } from '@tanstack/react-query';
import { getDashboardLeaderboard, DASHBOARD_LEADERBOARD_SORTS, DASHBOARD_ORDERS, DASHBOARD_DEFAULT_PAGE_SIZE } from '../services/dashboard.js';
import { useAuthStore } from '../store/auth-store.js';
import { DEFAULT_TOLERANCE } from '../utils/dashboard-format.js';
import { DASHBOARD_KEYS, dashboardRetry } from './use-dashboard-query.js';

// GET /dashboard/leaderboard: el ranking paginado y ordenable del scope.
//
// La posición global de cada corredor viene en `position`, calculada sobre TODAS
// las filas con el mismo criterio de orden: sin eso, mostrar "vas 14°" obligaría
// a traer todas las páginas.
//
// Solo el dueño del equipo: el backend responde 403 a un corredor, así que el
// hook queda `enabled: false` para el rol corredor — con la variante del corredor
// de la pantalla ni siquiera debería montarse, pero que un hook colgado en otra
// rama no dispare la request es la red de seguridad. Los defaults de `sort` y
// `order` son los del backend (best_time_ms asc: con mean_speed_kph ascendente
// el primero sería el más lento).
export function useDashboardLeaderboard({
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
  pageSize = DASHBOARD_DEFAULT_PAGE_SIZE,
  sort = DASHBOARD_LEADERBOARD_SORTS[0],
  order = DASHBOARD_ORDERS[0],
  enabled = true,
} = {}) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const scope = { teamId, groupId, exerciseId, exerciseIds, kind, distanceFromM, distanceToM, timeFromMin, timeToMin, from, to, tolerance };
  const paging = { sort, order, pageSize };

  const query = useInfiniteQuery({
    queryKey: DASHBOARD_KEYS.leaderboard(scope, paging),
    queryFn: ({ pageParam }) => getDashboardLeaderboard({ ...scope, ...paging, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage && lastPage.page * lastPage.page_size < lastPage.total ? lastPage.page + 1 : undefined
    ),
    enabled: enabled && Boolean(teamId) && activeRole === 'trainer',
    retry: dashboardRetry,
  });

  const pages = query.data?.pages ?? [];

  return {
    items: pages.flatMap((page) => page.items ?? []),
    total: pages[0]?.total ?? 0,
    sort: pages[0]?.sort ?? sort,
    order: pages[0]?.order ?? order,
    units: pages[0]?.units ?? null,
    dataQuality: pages[0]?.data_quality ?? null,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage(),
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    failed: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}