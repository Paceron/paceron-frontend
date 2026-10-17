// Spec 4b (Gap 33 punto 29) -- a qué competencia type='metric' activa se
// asocia un entrenamiento que arranca en `date` (YYYY-MM-DD). `runner_session`
// solo acepta UN `competition_id`, así que si el corredor participa en más de
// una competencia simultánea que incluye esa fecha, hace falta una regla
// determinística de desempate: gana la que termina antes (más urgente). Las
// sin `endAt` (abierta) quedan últimas en ese desempate.
export function findActiveMetricCompetitionId(competitions, userId, date) {
  if (!date) return null;
  const uid = String(userId);
  const matches = (competitions ?? []).filter(
    (c) => c.type === 'metric' && c.participantUserIds.includes(uid) && c.startAt <= date && (c.endAt == null || date <= c.endAt),
  );
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => (a.endAt ?? '9999-12-31').localeCompare(b.endAt ?? '9999-12-31'));
  return sorted[0].id;
}
