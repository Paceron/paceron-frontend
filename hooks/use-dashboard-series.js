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
//
// El detalle de cada página viaja bajo `items`, no `series` (DTO
// `SeriesDetailResponse`, paceron-backend domains/dashboard/dto.go — el mismo
// nombre que usa el leaderboard). Leer `series` devolvía siempre una lista
// vacía sin ningún error: el gris "no hay datos" del dot/box plot y un CSV con
// solo el encabezado.
//
// `groupId` NO es obligatorio: `/dashboard/exercises/{id}/series` acepta el
// scope sin grupo (el backend solo lo valida si viene). Exigirlo acá dejaba el
// detalle por serie inutilizable en el caso más común, que es mirar el
// dashboard sin filtrar por grupo.
export function useDashboardSeries({
  teamId,
  athleteUserId,
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
  const scope = { teamId, athleteUserId, exerciseId, groupId, distanceFromM, distanceToM, timeFromMin, timeToMin, from, to, tolerance };
  const paging = { pageSize };

  const query = useInfiniteQuery({
    queryKey: DASHBOARD_KEYS.series(scope, exerciseId, paging),
    queryFn: ({ pageParam }) => getDashboardExerciseSeries({ ...scope, ...paging, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage && lastPage.page * lastPage.page_size < lastPage.total ? lastPage.page + 1 : undefined
    ),
    enabled: enabled && Boolean(exerciseId),
    retry: dashboardRetry,
  });

  const pages = query.data?.pages ?? [];

  return {
    series: pages.flatMap((page) => page.items ?? []),
    total: pages[0]?.total ?? 0,
    units: pages[0]?.units ?? null,
    axis: pages[0]?.axis ?? null,
    hasTarget: pages[0]?.has_target ?? null,
    dataQuality: pages[0]?.data_quality ?? null,
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    loading: query.isLoading,
    refreshing: query.isFetching,
    loadingMore: query.isFetchingNextPage,
    // `isError` solo cubre el primer fetch: en un infinite query una página
    // posterior que falla deja `status` en 'success'. Si el hook no lo dijera,
    // el prefetch de la pantalla reintentaría para siempre (ver
    // dashboard-screen.jsx).
    failed: Boolean(query.isError || query.isFetchNextPageError),
    error: query.error ?? null,
    refetch: query.refetch,
    role: activeRole,
  };
}
