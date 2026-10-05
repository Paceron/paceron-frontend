// Feed cronológico (más reciente primero) de series completadas/salteadas de
// TODOS los corredores de la sesión -- alimentado por el bootstrap REST
// (feedback ya sincronizado antes de que el entrenador se sumara) y por cada
// update:set_event que llega mientras la pantalla está montada.
export function appendFeedEvent(feed, event) {
  const withoutDuplicate = feed.filter((item) => item.id !== event.id);
  return [event, ...withoutDuplicate].sort((a, b) => b.timestamp - a.timestamp);
}

export function filterFeedByAthlete(feed, athleteUserId) {
  if (athleteUserId === null || athleteUserId === undefined) return feed;
  const needle = String(athleteUserId);
  return feed.filter((event) => String(event.athleteUserId) === needle);
}
