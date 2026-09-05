import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTeams } from '../services/join-requests.js';
import { toTeamSearchResultModel } from '../services/normalizers.js';

// Búsqueda paginada de equipos — primer caso de paginación del repo (ver
// docs/superpowers/specs/2026-09-03-team-search-join-requests-design.md,
// "Estado del servidor"). Sin useInfiniteQuery: "Cargar más" es una
// acción explícita del usuario que solo avanza en una dirección, así que
// alcanza con una queryKey por (filters, page) y concatenar resultados a
// mano en este hook — mismo criterio ya escrito en la spec.
export function useTeamSearch() {
  const [filters, setFilters] = useState(null);
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState({ pageKey: null, items: [] });

  const query = useQuery({
    queryKey: ['team-search', filters, page],
    queryFn: () => searchTeams(filters, page),
    enabled: Boolean(filters),
  });

  // Cuando llega una página nueva, se acumula (page > 1) o reemplaza
  // (page === 1, nueva búsqueda) — hecho acá en vez de en un useEffect
  // para no depender de un efecto separado corriendo después del render
  // que ya mostró los datos viejos.
  const dtos = query.data?.teams ?? [];
  const currentPageKey = `${JSON.stringify(filters)}:${page}`;
  if (query.isSuccess && accumulated.pageKey !== currentPageKey) {
    const mapped = dtos.map(toTeamSearchResultModel);
    setAccumulated({
      pageKey: currentPageKey,
      items: page === 1 ? mapped : [...(accumulated.items ?? []), ...mapped],
    });
  }

  const search = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
    setAccumulated({ pageKey: null, items: [] });
  };

  const loadMore = () => setPage((p) => p + 1);

  return {
    results: accumulated.items ?? [],
    hasMore: query.data?.has_more ?? false,
    loading: query.isLoading,
    error: query.error,
    search,
    loadMore,
  };
}
