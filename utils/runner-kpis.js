// Piezas puras de la tarjeta de KPIs del Home del corredor.
//
// Todo lo que decide TEXTO o FORMATO vive acá para que el componente no repita
// reglas en el JSX y para poder testearlo sin render. Las métricas NO se
// recalculan: el backend ya entrega cada campo agregado y el front solo elige
// qué fila mostrarlo y cómo escribirlo.
import { EMPTY_METRIC, formatMetric } from './dashboard-format.js';
import { fromISODate } from './date-field-format.js';

// Tabla propia del mes, a propósito: `Intl.DateTimeFormat` en Hermes puede
// devolver "octubre de 2026" en minúscula y con preposición, y el título es un
// texto de producto que no debe depender de la implementación de Intl del
// dispositivo (design.md D3).
export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

// Orden y contrato exacto de las cuatro pestañas.
export const RUNNER_KPI_TABS = [
  { tab: 'general', label: 'Números generales' },
  { tab: 'ritmo_continuo', label: 'Ritmo continuo' },
  { tab: 'velocidad_tiempo', label: 'Velocidad en tiempo' },
  { tab: 'velocidad_distancia', label: 'Velocidad en distancia' },
];

export const PERIOD_OPTIONS = [
  { period: 'month', label: 'Mes' },
  { period: 'week', label: 'Semana' },
  { period: 'day', label: 'Día' },
];

// Una fila por métrica visible, en el orden del spec. `field` es la clave de
// `metrics` que se lee tal cual; el formato sale de FIELD_FORMAT (abajo), no de
// una condición escrita en cada celda.
export const RUNNER_KPI_ROWS = {
  general: [
    { label: 'Distancia recorrida', field: 'total_distance_m' },
    { label: 'Mayor distancia en un día', field: 'best_day_distance_m' },
    { label: 'Fecha del mejor día', field: 'best_day_date' },
    { label: 'Mejor velocidad', field: 'best_speed_kph' },
    { label: 'Velocidad promedio en ritmo continuo', field: 'average_speed_kph' },
  ],
  ritmo_continuo: [
    { label: 'Distancia recorrida', field: 'total_distance_m' },
    { label: 'Velocidad promedio', field: 'average_speed_kph' },
    { label: 'Mejor velocidad', field: 'best_speed_kph' },
    { label: 'Mayor distancia en un ejercicio', field: 'best_distance_m' },
  ],
  velocidad_tiempo: [
    { label: 'Distancia recorrida', field: 'total_distance_m' },
    { label: 'Velocidad promedio', field: 'average_speed_kph' },
    { label: 'Mejor tiempo', field: 'best_time_ms' },
  ],
  velocidad_distancia: [
    { label: 'Distancia recorrida', field: 'total_distance_m' },
    { label: 'Velocidad promedio', field: 'average_speed_kph' },
    { label: 'Mejor velocidad', field: 'best_speed_kph' },
  ],
};

const FIELD_FORMAT = {
  total_distance_m: 'distance',
  best_day_distance_m: 'distance',
  best_distance_m: 'distance',
  best_day_date: 'date',
  best_speed_kph: 'speed',
  average_speed_kph: 'speed',
  best_time_ms: 'time',
};

// El formateador de km necesita exactamente un decimal (12,4 km). formatMetric
// no tiene una unidad `km` en su tabla: su fallback usa dos decimales. Se
// reutiliza el locale es-AR acá para no mezclar comas y puntos en la tabla.
const KM_FORMATTER = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function daysLabel(days) {
  return days === 1 ? '1 día considerado' : `${days} días considerados`;
}

// Título del período. `from`, `to` y `daysConsidered` son los de la RESPUESTA:
// el front no recalcula el calendario ni la cantidad de días (spec, título).
export function buildPeriodTitle({ period, from, to, daysConsidered } = {}) {
  const parsedDays = Number(daysConsidered);
  const days = Number.isFinite(parsedDays) ? parsedDays : 0;
  const label = daysLabel(days);

  if (period === 'month') {
    const date = parseISODate(from) ?? parseISODate(to);
    if (!date) return label;
    return `${MONTHS_ES[date.month - 1]} ${date.year} · ${label}`;
  }

  if (period === 'week') {
    const start = fromISODate(from);
    const end = fromISODate(to);
    if (!start) return label;
    return `${start}${end ? ` al ${end}` : ''} · ${label}`;
  }

  if (period === 'day') {
    const date = fromISODate(from) || fromISODate(to);
    if (!date) return label;
    return `${date} · ${label}`;
  }

  return label;
}

// Distancia del contrato en metros. Menos de 1000 se queda en metros enteros;
// desde 1000 se presenta en km con un decimal. Un `null` es "—", nunca 0.
export function formatDistanceM(value) {
  const n = toNumber(value);
  if (n === null) return EMPTY_METRIC;
  if (n < 1000) return formatMetric(n, 'm');
  return `${KM_FORMATTER.format(n / 1000)} km`;
}

// El único lugar que decide el formato de una celda. `best_speed_kph` es una
// velocidad en km/h; no existe ningún porcentaje en esta tarjeta.
export function formatRunnerKpiValue(field, value) {
  if (value === null || value === undefined || value === '') return EMPTY_METRIC;

  switch (FIELD_FORMAT[field]) {
    case 'distance':
      return formatDistanceM(value);
    case 'date': {
      const text = fromISODate(value);
      return text || EMPTY_METRIC;
    }
    case 'speed':
      return formatMetric(value, 'km/h');
    case 'time':
      return formatMetric(value, 'ms');
    default:
      return formatMetric(value, '');
  }
}

// Prefijo `runner-kpis` compartido con la invalidación del pull-to-refresh del
// Home: cambiar período, fecha o pestaña produce una key distinta, pero todas
// cuelgan del mismo prefijo.
export function runnerKpisQueryKey({ period, referenceDate, tab } = {}) {
  return ['runner-kpis', period, referenceDate, tab];
}
