import { METRIC_OPTIONS } from './gamification-metric-options.js';
import { totalRouteMeters } from './route-geometry.js';
import { formatMeters } from './distance.js';

// El backend todavía no tiene columna de nombre para una competencia
// (confirmado 2026-10-14, decisión D8 del lado backend -- ver Gap 33,
// no entra por POST ni se persiste). Mientras no exista, el frontend
// arma un título legible a partir de la métrica y la ventana. Sacar esta
// función el día que `name` llegue real y usar ese campo directo.
//
// type='route' no tiene metric ni endAt (bug real, 2026-10-16: el template
// de abajo los interpolaba igual, produciendo "null (fecha → null)") --
// rama propia, sin fecha de fin (una competencia por trayectoria queda
// abierta hasta que el entrenador la cierra a mano). Distancia total vía
// totalRouteMeters (mismo cálculo que RouteDrawPicker al dibujar) --
// `coordinates` es GeoJSON [lng,lat], se remapea a {lat,lng}.
export function buildCompetitionTitle(competition) {
  if (competition.type === 'route') {
    const coordinates = competition.route?.coordinates ?? [];
    const pointCount = coordinates.length;
    const meters = totalRouteMeters(coordinates.map(([lng, lat]) => ({ lat, lng })));
    return `Por trayectoria · ${formatMeters(meters)} · ${pointCount} punto${pointCount === 1 ? '' : 's'}`;
  }
  const metricName = METRIC_OPTIONS.find((m) => m.id === competition.metric)?.name ?? competition.metric;
  return `${metricName} (${competition.startAt} → ${competition.endAt})`;
}
