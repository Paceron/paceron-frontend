import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';
import { toISODate } from '../utils/date-field-format.js';
import { resolveTolerance } from '../utils/dashboard-format.js';
import {
  mockGetDashboardFilters,
  mockGetDashboardSummary,
  mockGetDashboardTimeseries,
  mockGetDashboardLeaderboard,
  mockGetDashboardExerciseSeries,
  mockPostDashboardComparisons,
  mockPostDashboardPeriods,
} from './__mocks__/dashboard-mock.js';

// Dashboard analítico de rendimiento: los 7 endpoints de /dashboard.
//
// Contrato leído del backend YA IMPLEMENTADO (paceron-backend, rama develop):
// los DTOs en cmd/api/domains/dashboard/dto.go, los handlers en
// cmd/api/controllers/dashboard_controller.go y los defaults/validaciones en
// cmd/api/services/dashboard_service.go. `api` ya antepone /api/v1, así que las
// rutas de abajo van sin ese prefijo.
//
// Reglas del contrato que esta capa tiene que respetar y no reimplementar:
//
// - `team_id` es obligatorio en los 7 endpoints y es la ancla de la
//   autorización: el usuario llega desde la pestaña del detalle de equipo, así
//   que siempre lo tiene.
// - `from` es obligatorio en los cinco GET de métricas y en /comparisons; `to`
//   es opcional (sin él el rango cierra en `from`). NO se inventa un `from` por
//   defecto: el 400 MISSING_FROM es uno de los estados que la pantalla tiene que
//   saber pintar (spec, estado de validación).
// - Las fechas viajan en ISO 'YYYY-MM-DD'. Los callers pueden pasar 'DD/MM/YYYY'
//   (lo que emite DateField) y se normalizan acá, en el borde de la request.
// - `kinds[]` y `exercise_ids[]` son 1:N y excluyentes con `exercise_id`. El
//   backend los lee con c.QueryArray, que solo entiende el parámetro REPETIDO:
//   el swagger los anota collectionFormat csv, pero mandarlos "a,b" llega como
//   un único string "a,b" y no matchea nada (gin no separa comas en QueryArray).
// - La tolerancia se manda siempre explícita: `tolerance_applied` de la respuesta
//   es lo que el tooltip del KPI muestra, y sin mandarla sería un default
//   invisible del backend.
// - La validación de whitelist (tolerance, granularity, sort, order, page_size)
//   vive en el backend y NO se replica acá: su 400 con code estable es lo que
//   alimenta el estado de validación de la pantalla.

// Defaults del backend, declarados acá para que la query key del hook sea
// concreta (cambiar 'session' por undefined y volver sería otra query) y para
// que el mock reciba siempre el mismo juego de parámetros.
export const DASHBOARD_GRANULARITIES = ['session', 'week', 'month', 'quarter'];
export const DASHBOARD_LEADERBOARD_SORTS = [
  'best_time_ms',
  'mean_speed_kph',
  'total_distance_m',
  'compliance_rate',
];
export const DASHBOARD_ORDERS = ['asc', 'desc'];
export const DASHBOARD_DEFAULT_PAGE_SIZE = 20;
export const DASHBOARD_MAX_PAGE_SIZE = 100;

// El backend deriva el llamador del token; el mock necesita el id explícito para
// reproducir el 403 de scope (los tres endpoints de comparación solo responden
// para el dueño del equipo). Se lee del store únicamente en la rama de mocks: la
// request real ya viaja autenticada.
function currentUserId() {
  return useAuthStore.getState().userId ?? null;
}

// El body de los POST viaja como JSON y Go no acepta un id numérico escrito como
// string: `team_id: "4"` no binds y el backend responde INVALID_REQUEST.
function toId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

function toIdList(values) {
  return (values ?? []).filter((id) => !isBlank(id)).map(toId);
}

// Un solo lugar decide qué viaja en la request. Se usa para las DOS ramas —la
// real y la del mock— para que el mock valide exactamente lo que se manda en
// producción: si normalizara distinto, el mock estaría probando otra request.
function normalizeMetricsFilters(filters = {}) {
  return {
    teamId: toId(filters.teamId),
    groupId: isBlank(filters.groupId) ? null : toId(filters.groupId),
    exerciseId: isBlank(filters.exerciseId) ? null : toId(filters.exerciseId),
    exerciseIds: toIdList(filters.exerciseIds),
    kinds: (filters.kinds ?? []).filter((kind) => !isBlank(kind)),
    from: toISODate(filters.from),
    to: toISODate(filters.to),
    tolerance: resolveTolerance(filters.tolerance),
  };
}

function appendMetricsFilters(params, filters) {
  params.set('team_id', filters.teamId);
  if (filters.groupId !== null) params.set('group_id', filters.groupId);
  if (filters.exerciseId !== null) params.set('exercise_id', filters.exerciseId);
  filters.exerciseIds.forEach((id) => params.append('exercise_ids', id));
  filters.kinds.forEach((kind) => params.append('kinds', kind));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('tolerance', filters.tolerance);
  return params;
}

function queryString(params) {
  const query = params.toString();
  return query ? `?${query}` : '';
}

// GET /api/v1/dashboard/filters?team_id=
// Equipos, grupos, corredores, tipos, catálogo con su objetivo VIGENTE y el rango
// de fechas REAL. Todo recortado por el scope del solicitante; `date_range` viene
// null cuando el scope no tiene ninguna sesión registrada.
export async function getDashboardFilters({ teamId } = {}) {
  if (USE_MOCKS) return await mockGetDashboardFilters({ teamId: toId(teamId), callerUserId: currentUserId() });
  const params = new URLSearchParams({ team_id: teamId });
  return await api.get(`/dashboard/filters?${params.toString()}`);
}

// GET /api/v1/dashboard/metrics/summary?team_id&group_id&exercise_id&exercise_ids&kinds&from&to&tolerance
// KPIs del período. `compliance_rate` es porcentaje 0-100 y `delta_pct` va con
// signo positivo hacia la mejora, incluso en el eje temporal.
export async function getDashboardSummary(filters = {}) {
  const scope = normalizeMetricsFilters(filters);
  if (USE_MOCKS) return await mockGetDashboardSummary({ ...scope, callerUserId: currentUserId() });
  return await api.get(`/dashboard/metrics/summary${queryString(appendMetricsFilters(new URLSearchParams(), scope))}`);
}

// GET /api/v1/dashboard/metrics/timeseries?...&granularity=
// Buckets de calendario con los mismos KPIs del resumen. Los anclajes son de
// calendario: un bucket puede empezar antes del `from` y el recorte nunca parte
// una semana ni un trimestre por la mitad.
export async function getDashboardTimeseries(filters = {}) {
  const scope = normalizeMetricsFilters(filters);
  if (USE_MOCKS) return await mockGetDashboardTimeseries({ ...scope, granularity: filters.granularity, callerUserId: currentUserId() });
  const params = appendMetricsFilters(new URLSearchParams(), scope);
  if (filters.granularity) params.set('granularity', filters.granularity);
  return await api.get(`/dashboard/metrics/timeseries${queryString(params)}`);
}

// GET /api/v1/dashboard/leaderboard?...&page&page_size&sort&order
// Ranking paginado con la posición GLOBAL de cada corredor (`position`), para
// poder mostrar "vas 14°" sin traer todas las páginas. Solo el dueño del equipo:
// un corredor recibe 403.
export async function getDashboardLeaderboard(filters = {}) {
  const scope = normalizeMetricsFilters(filters);
  const paging = {
    page: filters.page ?? null,
    pageSize: filters.pageSize ?? null,
    sort: filters.sort ?? null,
    order: filters.order ?? null,
  };
  if (USE_MOCKS) return await mockGetDashboardLeaderboard({ ...scope, ...paging, callerUserId: currentUserId() });
  const params = appendMetricsFilters(new URLSearchParams(), scope);
  if (paging.page !== null) params.set('page', paging.page);
  if (paging.pageSize !== null) params.set('page_size', paging.pageSize);
  if (paging.sort) params.set('sort', paging.sort);
  if (paging.order) params.set('order', paging.order);
  return await api.get(`/dashboard/leaderboard${queryString(params)}`);
}

// GET /api/v1/dashboard/exercises/{id}/series?team_id&group_id&from&to&tolerance&page&page_size
// Detalle serie por serie de un ejercicio de CATÁLOGO (el mismo `exercises.id`
// que expone /dashboard/filters). Los objetivos son los CONGELADOS de cada
// instancia, no los vigentes del catálogo.
export async function getDashboardExerciseSeries({ exerciseId, ...filters } = {}) {
  const scope = normalizeMetricsFilters(filters);
  const paging = { page: filters.page ?? null, pageSize: filters.pageSize ?? null };
  if (USE_MOCKS) {
    return await mockGetDashboardExerciseSeries({
      ...scope,
      ...paging,
      exerciseId: toId(exerciseId),
      callerUserId: currentUserId(),
    });
  }
  const params = appendMetricsFilters(new URLSearchParams(), scope);
  if (paging.page !== null) params.set('page', paging.page);
  if (paging.pageSize !== null) params.set('page_size', paging.pageSize);
  return await api.get(`/dashboard/exercises/${exerciseId}/series${queryString(params)}`);
}

// POST /api/v1/dashboard/comparisons
// Una fila por corredor comparable del scope, con su tendencia. Solo el dueño del
// equipo. Sin `athlete_user_ids` compara a todo el scope.
export async function postDashboardComparisons({ athleteUserIds, ...filters } = {}) {
  const scope = normalizeMetricsFilters(filters);
  const ids = toIdList(athleteUserIds);
  if (USE_MOCKS) return await mockPostDashboardComparisons({ ...scope, athleteUserIds: ids, callerUserId: currentUserId() });
  const body = { team_id: scope.teamId, tolerance: scope.tolerance };
  if (scope.groupId !== null) body.group_id = scope.groupId;
  if (scope.exerciseId !== null) body.exercise_id = scope.exerciseId;
  if (scope.exerciseIds.length) body.exercise_ids = scope.exerciseIds;
  if (scope.kinds.length) body.kinds = scope.kinds;
  if (scope.from) body.from = scope.from;
  if (scope.to) body.to = scope.to;
  if (ids.length) body.athlete_user_ids = ids;
  return await api.post('/dashboard/comparisons', body);
}

// POST /api/v1/dashboard/comparisons/periods
// Período actual contra el anterior de la misma longitud. Sin `previous`, el
// backend lo deriva desplazando `current` hacia atrás. Solo el dueño del equipo.
// `compliance_pp` son puntos porcentuales y `best_time_pct` ya viene con el signo
// invertido: bajar el tiempo es mejorar.
export async function postDashboardPeriods({ current, previous, ...filters } = {}) {
  const scope = normalizeMetricsFilters(filters);
  const ranges = {
    current: { from: toISODate(current?.from), to: toISODate(current?.to) },
    previous: previous ? { from: toISODate(previous.from), to: toISODate(previous.to) } : null,
  };
  if (USE_MOCKS) return await mockPostDashboardPeriods({ ...scope, ...ranges, callerUserId: currentUserId() });
  const body = { team_id: scope.teamId, tolerance: scope.tolerance, current: ranges.current };
  if (ranges.previous) body.previous = ranges.previous;
  if (scope.groupId !== null) body.group_id = scope.groupId;
  if (scope.exerciseId !== null) body.exercise_id = scope.exerciseId;
  if (scope.exerciseIds.length) body.exercise_ids = scope.exerciseIds;
  if (scope.kinds.length) body.kinds = scope.kinds;
  return await api.post('/dashboard/comparisons/periods', body);
}