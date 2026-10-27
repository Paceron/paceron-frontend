// Formato de los KPIs del dashboard. Un solo lugar decide cómo se escribe cada
// magnitud, porque el mismo número se muestra en varias piezas (tile, tooltip,
// tabla del radar) y dos copias del formato divergen apenas tocan un borde.
//
// Dos reglas del design que se aplican acá:
//
// D4 — la unidad NO es un sufijo fijo del componente: viene del bloque `units`
// de la respuesta, y la misma magnitud se expresa distinto según el período
// (un tiempo de 4 minutos no se muestra igual que uno de 40). Además el front
// no inventa ni convierte unidades: los valores crudos llegan en la unidad que
// el backend declara y el front solo los escribe.
//
// D5 — `null` es "—", NUNCA 0. `Number(null) === 0` pasa un `Number.isFinite`,
// y un 0 de cumplimiento se lee como "no cumplió nada" cuando en realidad no se
// midió. Mismo criterio que formatArs en utils/currency.js.

import { formatClock } from './time.js';

export const EMPTY_METRIC = '—';

// Typographic minus (U+2212), no el guion: el guion es más corto que el signo
// más y alinea mal el delta contra el resto de los números del tile.
const MINUS = '−';

// El descarte explícito de null/undefined/'' es necesario porque Number(null) y
// Number('') dan 0, que es finito. Un string numérico sí se acepta: el mismo
// criterio de utils/currency.js, para no perder el dato si un normalizer
// devolvió texto.
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const formatters = new Map();
function decimal(n, maxFractionDigits, minimumFractionDigits = 0) {
  const key = `${maxFractionDigits}:${minimumFractionDigits}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat('es-AR', {
        maximumFractionDigits: maxFractionDigits,
        minimumFractionDigits,
      })
    );
  }
  const text = formatters.get(key).format(n);
  // Intl con es-AR usa el guion normal para el negativo; lo cambiamos por el
  // typográfico para que todos los deltas del app se vean igual.
  return text.replace('-', MINUS);
}

// Las únicas unidades del contrato. `time` y `best_time` llegan en
// milisegundos SIEMPRE y se muestran como reloj (m:ss o h:mm:ss según la
// duración — de ahí la conversión de D4): no existe una clave `s` ni `min` que
// el backend pueda declarar, así que no hay nada que convertir a otra unidad.
const UNIT_FORMATTERS = {
  'km/h': (n) => `${decimal(n, 1)} km/h`,
  ms: (n) => formatClock(n),
  m: (n) => `${decimal(n, 0)} m`,
  '%': (n) => `${decimal(n, 1)} %`,
  pp: (n) => `${decimal(n, 1)} pp`,
};

// Magnitud con su unidad. `null`/undefined/''/NaN → "—", sin importar la
// unidad. Una unidad que el backend agregue después del contrato cae en el
// default (número + sufijo crudo): muestra algo honesto en vez de tirar.
export function formatMetric(value, unit) {
  const n = toNumber(value);
  if (n === null) return EMPTY_METRIC;
  const formatter = UNIT_FORMATTERS[unit];
  if (formatter) return formatter(n);
  const suffix = unit == null || unit === '' ? '' : ` ${unit}`;
  return `${decimal(n, 2)}${suffix}`;
}

// Igual que formatMetric pero con el signo explícito en los positivos, para
// donde el signo es parte del dato y no un detalle: el delta de ritmo y la
// diferencia de cumplimiento (que va en puntos porcentuales, D6 — "−6 pp" y no
// un "−9,4 %" relativo, que es otro número y confunde).
export function formatDelta(value, unit) {
  const n = toNumber(value);
  if (n === null) return EMPTY_METRIC;
  const formatted = formatMetric(n, unit);
  return n > 0 ? `+${formatted}` : formatted;
}

// ¿El valor es un número que se puede mostrar? Lo usan las piezas que pintan
// algo en función del dato (flecha de tendencia, gráfico) para no dibujar con
// un número que en realidad no existe.
export function hasMetric(value) {
  return toNumber(value) !== null;
}

// ---------- enums del contrato, traducidos para mostrar ----------
//
// Los enums llegan en inglés de la API (`improving`/`stable`/`regressing`,
// `alta`/`degraded`) y en pantalla se muestran traducidos: el veredicto es lo
// que lee una persona, no lo que reconcilia una response. El CSV es la
// excepción y los deja crudos a propósito — ver utils/dashboard-export.js.
// `BAND_LABELS` (met/near/missed/unknown) vive en utils/dashboard-chart.js,
// junto a la geometría que las dibuja.

export const VERDICT_LABELS = {
  improving: 'Mejoró',
  stable: 'Estable',
  regressing: 'Retrocedió',
};

// El ícono va con el texto y no en lugar de él: la spec exige que ninguna señal
// se comunique solo por color (WCAG 1.4.1), y el mismo par color+ícono es lo que
// distingue "mejoró" de "retrocedió" sin depender del tono.
export const VERDICT_ICONS = {
  improving: 'trending-up',
  stable: 'minus',
  regressing: 'trending-down',
};

// Un veredicto que no sea del contrato no se muestra crudo: se muestra como
// ausencia de dato. Un slug desconocido en pantalla no le dice nada a nadie.
export function formatVerdict(value) {
  return VERDICT_LABELS[value] ?? 'Sin veredicto';
}

export function verdictIcon(value) {
  return VERDICT_ICONS[value] ?? 'help-circle-outline';
}

export const TIME_QUALITY_LABELS = {
  alta: 'Alta',
  degraded: 'Degradada',
};

export function formatTimeQuality(value) {
  return TIME_QUALITY_LABELS[value] ?? 'Sin dato';
}

// Los cinco tipos vigentes, con el texto que se muestra en el filtro. El orden
// es el de utils/exercise-field-matrix.js (los dos de velocidad primero).
export const KIND_LABELS = {
  velocidad_tiempo: 'Velocidad en tiempo',
  velocidad_distancia: 'Velocidad en distancia',
  liviano: 'Liviano',
  elongacion: 'Elongación',
  ritmo_continuo: 'Ritmo continuo',
};

export function formatKind(value) {
  return KIND_LABELS[value] ?? String(value ?? EMPTY_METRIC);
}

// ---------- calidad de los datos ----------

// ¿El backend marcó el período como insuficiente? Cuando es `true`, la pantalla
// oculta los indicadores de tendencia y muestra el motivo en vez de pintar un
// porcentaje calculado sobre muy pocos datos (spec, "estado de calidad de los
// datos"). Vive acá porque lo consultan la banner y las paletas, y duplicar la
// condición en dos JSX es la forma de que una se olvide del caso.
export function hasInsufficientData(quality) {
  return Boolean(quality?.insufficient_data);
}

// `legacy_sessions` NO es un defecto: son series válidas sin fila en
// `runner_session` que igual entran a los KPI (quality.go del backend). La
// banner lo muestra como nota al pie con esa aclaración, nunca como advertencia.
export function isLegacyNote(quality) {
  return Number(quality?.legacy_sessions) > 0;
}

// ---------- tolerancia de cumplimiento ----------
//
// Las cotas son las del backend (dashboardMinTolerance/dashboardMaxTolerance en
// paceron-backend, services/dashboard_service.go), replicadas acá solo para no
// gastar un 400 en un valor que el usuario no puede cambiar: hoy no hay control
// de UI para la tolerancia, así que la request la arma el código. El backend
// sigue siendo la validación real —esto no reemplaza su whitelist, la evita.
//
// `config/env.js` queda fuera a propósito: dos tests lo mockean completo con su
// propia factory (attendance-delete.test.js, checkin-service.test.js), así que
// una constante exportada de ahí llega `undefined` bajo Jest — y el módulo que
// la importa revienta sin que se entienda por qué.
export const DEFAULT_TOLERANCE = 0.05;
export const TOLERANCE_MIN = 0.01;
export const TOLERANCE_MAX = 0.2;

// La tolerancia efectiva de una request. Sin valor, o con uno fuera de rango,
// vuelve a la default: mandar la default explícita deja `tolerance_applied` de
// la respuesta diciendo la verdad, que es lo que el tooltip del KPI muestra.
export function resolveTolerance(value) {
  const n = toNumber(value);
  if (n === null) return DEFAULT_TOLERANCE;
  if (n < TOLERANCE_MIN || n > TOLERANCE_MAX) return DEFAULT_TOLERANCE;
  return n;
}

// Labels de la granularidad de la línea de evolución. Viven acá y no en la
// pantalla porque los consume el control que va montado en el ChartCard, que es
// un componente aparte.
export const GRANULARITY_LABELS = {
  session: 'Por sesión',
  week: 'Por semana',
  month: 'Por mes',
  quarter: 'Por trimestre',
};
