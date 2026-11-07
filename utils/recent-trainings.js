// Selector puro para el widget de entrenamientos recientes del Home --
// toma la lista de sesiones de /activities/comparison (useComparisonList)
// y se queda con las `limit` más recientes YA finalizadas. `date` es
// siempre 'YYYY-MM-DD' (sin hora), así que la comparación lexicográfica
// de strings alcanza para ordenar cronológicamente, sin pasar por Date.
export function selectRecentFinishedTrainings(sessions, limit = 3) {
  return (sessions ?? [])
    .filter((session) => session.status === 'finished')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit);
}
