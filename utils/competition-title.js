import { METRIC_OPTIONS } from './gamification-metric-options.js';

// El backend todavía no tiene columna de nombre para una competencia
// (confirmado 2026-10-14, decisión D8 del lado backend -- ver Gap 33,
// no entra por POST ni se persiste). Mientras no exista, el frontend
// arma un título legible a partir de la métrica y la ventana. Sacar esta
// función el día que `name` llegue real y usar ese campo directo.
export function buildCompetitionTitle(competition) {
  const metricName = METRIC_OPTIONS.find((m) => m.id === competition.metric)?.name ?? competition.metric;
  return `${metricName} (${competition.startAt} → ${competition.endAt})`;
}
