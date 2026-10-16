import { resolveDashboardError } from '../utils/dashboard-error-codes.js';

// Piezas compartidas por los hooks del dashboard. Existe para no repetir seis
// veces el mismo prefijo de query key, el mismo `retry` y el mismo intervalo de
// sondeo: cualquier cambio en la política tiene que verse en un solo lugar.

// Un `retry: 1` global (lib/query-client.js:13) reintenta también los 400, los
// 403 y los 404, que no mejoran por reintentarse: lo único que logra es retrasar
// el estado de error que la pantalla necesita mostrar. Este predicado reusa la
// clasificación de utils/dashboard-error-codes.js —red y 5xx sí son
// reintentables— en vez de volver a mirar el status con otra regla.
//
// El conteo está acotado a propósito: `retry` como función REEMPLAZA el default
// del QueryClient, así que devolver `true` siempre reintenta para siempre y el
// estado de "error transitorio" con su botón de reintento (spec, estado 3) no
// llegaría a mostrarse nunca. El presupuesto es el mismo que el global.
export const DASHBOARD_MAX_RETRIES = 1;

export function dashboardRetry(failureCount, error) {
  return failureCount < DASHBOARD_MAX_RETRIES && resolveDashboardError(error).retryable;
}

// Sondeo de 90 s, en el medio del rango de 60-120 s que fija la spec. Va con
// TanStack Query y no con WebSocket: el WS del repo publica por sesión
// (`session_{id}`), no por scope de dashboard.
export const DASHBOARD_POLL_INTERVAL_MS = 90 * 1000;

// Los ids y las fechas llegan como string desde la URL y como number desde el
// store; sin normalizarlos, `team_id: 4` y `team_id: '4'` serían dos queries
// distintas para la misma pantalla.
function keyPart(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function listPart(values) {
  return (values ?? []).map(keyPart).join(',');
}

// Los cuatro de rango van en la clave junto con el resto del scope, y no es un
// detalle: sin ellos, cambiar de "5 a 10 km" a "5 a 20 km" devuelve la respuesta
// cacheada de la otra combinación de filtros — que es justo lo que el usuario
// está mirando mientras escribe.
export function dashboardScopeKey(scope = {}) {
  return [
    keyPart(scope.teamId),
    keyPart(scope.groupId),
    keyPart(scope.exerciseId),
    listPart(scope.exerciseIds),
    keyPart(scope.kind),
    keyPart(scope.distanceFromM),
    keyPart(scope.distanceToM),
    keyPart(scope.timeFromMin),
    keyPart(scope.timeToMin),
    keyPart(scope.from),
    keyPart(scope.to),
    keyPart(scope.tolerance),
  ].join('|');
}

export const DASHBOARD_KEYS = {
  filters: (teamId) => ['dashboard', 'filters', keyPart(teamId)],
  summary: (scope) => ['dashboard', 'summary', dashboardScopeKey(scope)],
  timeseries: (scope, granularity) => ['dashboard', 'timeseries', dashboardScopeKey(scope), keyPart(granularity)],
  leaderboard: (scope, paging) => ['dashboard', 'leaderboard', dashboardScopeKey(scope), keyPart(paging.page), keyPart(paging.sort), keyPart(paging.order)],
  comparisons: (scope, athleteUserIds) => ['dashboard', 'comparisons', dashboardScopeKey(scope), listPart(athleteUserIds)],
  periods: (scope, ranges) => ['dashboard', 'periods', dashboardScopeKey(scope), keyPart(ranges?.current?.from), keyPart(ranges?.current?.to), keyPart(ranges?.previous?.from), keyPart(ranges?.previous?.to)],
  series: (scope, exerciseId, paging) => ['dashboard', 'series', keyPart(exerciseId), dashboardScopeKey(scope), keyPart(paging.pageSize)],
};