import { useQuery } from '@tanstack/react-query';
import { getDashboardFilters } from '../services/dashboard.js';
import { DASHBOARD_KEYS, dashboardRetry } from './use-dashboard-query.js';

// GET /dashboard/filters: la barra de filtros de la pantalla. Trae equipos,
// grupos, corredores, tipos, catálogo con su objetivo vigente y el rango de
// fechas REAL con datos (`date_range` null cuando el scope no tiene ninguna
// sesión), todo ya recortado por el scope del solicitante.
//
// No sondea: cambia cuando cambia el equipo, no cuando alguien entrena.
export function useDashboardFilters({ teamId, enabled = true } = {}) {
  const query = useQuery({
    queryKey: DASHBOARD_KEYS.filters(teamId),
    queryFn: () => getDashboardFilters({ teamId }),
    enabled: enabled && Boolean(teamId),
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