import { METRIC_OPTIONS } from './gamification-metric-options.js';
import { totalRouteMeters } from './route-geometry.js';
import { formatMeters } from './distance.js';

// No se reusa formatDisplayDate (utils/format-date-display.js): ese módulo
// importa react-native-calendars a nivel de archivo (lo necesitan sus otras
// funciones, formatWeekdayLabel/formatShortDate) -- fuera del allowlist de
// transform de Jest, rompía este test con "Unexpected token 'export'" (mismo
// tipo de problema que expo-router -> @react-navigation/native, ver
// authenticated-home-screen.test.js). Esta función es pura y no necesita esa
// dependencia -- mismo formato DD-MM-YYYY, sin el acoplamiento.
function formatISODateAsDDMMYYYY(isoDateOnly) {
  if (!isoDateOnly) return '';
  const [year, month, day] = isoDateOnly.split('-');
  return `${day}-${month}-${year}`;
}

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
  // `startAt`/`endAt` llegan ISO con hora (ej. "2026-11-06T00:00:00Z") --
  // una competencia por métrica no tiene horario, solo ventana de días, así
  // que mostrar la hora (siempre medianoche UTC, nunca informativa) era un
  // bug real reportado 2026-11-08. Se recorta a la fecha y se formatea con
  // el mismo DD-MM-YYYY que el resto de la app (formatDisplayDate).
  const start = formatISODateAsDDMMYYYY(competition.startAt?.slice(0, 10));
  const end = formatISODateAsDDMMYYYY(competition.endAt?.slice(0, 10));
  return `${metricName} (${start} → ${end})`;
}
