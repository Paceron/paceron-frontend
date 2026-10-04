// Estado acumulado de "cargar más" (mismo espíritu que hooks/use-team-search.js,
// pero acá los filtros se recalculan cada render en vez de dispararse por una
// acción explícita de "buscar" — estas funciones puras son las que deciden
// cuándo se resetea la página y cómo se combina cada respuesta nueva, para que
// hooks/use-trainings-history.js quede como un wrapper fino sobre useQuery.

export function computeFiltersKey(filters) {
  const { page: _page, ...rest } = filters;
  return JSON.stringify(rest);
}

export function shouldResetPage(prevFiltersKey, nextFiltersKey, currentPage) {
  return prevFiltersKey !== null && prevFiltersKey !== nextFiltersKey && currentPage !== 1;
}

// `responseKey` incluye `query.dataUpdatedAt` (timestamp de TanStack Query,
// cambia en CADA fetch exitoso, incluso a la misma página con los mismos
// filtros) -- `pageKey` solo (filtersKey+page) no alcanza: tras borrar una
// sesión, invalidateQueries sí dispara un refetch, pero como filtros y
// página no cambiaron, el `pageKey` resultante es idéntico al ya guardado y
// el merge nunca corría -- la lista se quedaba mostrando la sesión borrada
// hasta desmontar la pantalla (bug real, 2026-10-05). Con `dataUpdatedAt` en
// la clave, un refetch de la MISMA página todavía dispara el merge.
export function mergeHistoryPage(accumulated, filtersKey, pageKey, responseKey, page, incomingItems) {
  return {
    filtersKey,
    pageKey,
    responseKey,
    items: page === 1 ? incomingItems : [...accumulated.items, ...incomingItems],
  };
}

export function computeHasMore(page, pageSize, total) {
  return page * pageSize < total;
}

export function visibleHistoryItems(accumulated, filtersKey) {
  return accumulated.filtersKey === filtersKey ? accumulated.items : [];
}
