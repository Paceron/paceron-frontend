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

export function mergeHistoryPage(accumulated, filtersKey, pageKey, page, incomingItems) {
  return {
    filtersKey,
    pageKey,
    items: page === 1 ? incomingItems : [...accumulated.items, ...incomingItems],
  };
}

export function computeHasMore(page, pageSize, total) {
  return page * pageSize < total;
}

export function visibleHistoryItems(accumulated, filtersKey) {
  return accumulated.filtersKey === filtersKey ? accumulated.items : [];
}
