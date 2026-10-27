// Generación del CSV de exportación del dashboard. Parte pura y sin dependencias
// de plataforma a propósito: es lo único de la exportación que se puede testear
// con Jest (el env de test es react-native/jest/react-native-env.js, sin
// `document` ni `window`, así que la descarga web no es observable desde un
// test). La entrega —`File` + `expo-sharing` en nativo, `Blob` + `<a download>`
// en web— vive en services/dashboard-csv.js / .web.js y solo escribe el texto
// que sale de acá.
//
// Dos decisiones de formato que vienen del destino real, no de una preferencia:
//
// - BOM UTF-8 + separador ';': el archivo se abre en una planilla en español,
//   donde la coma es el separador decimal. Con coma como separador, "12,4" se
//   parte en dos columnas y el archivo se lee roto.
//
// - `null` es celda VACÍA. Ni la palabra "null" ni un 0: un 0 en la columna de
//   tiempo sería un resultado que nunca se midió (design.md D5).

import { toISODate } from './date-field-format.js';

export const CSV_BOM = '\uFEFF';
export const CSV_SEPARATOR = ';';
export const CSV_EOL = '\r\n';

// Columnas por defecto de la exportación. `unitKey` es la clave del bloque
// `units` de la respuesta: la unidad que el backend declara se escribe en el
// encabezado de la columna, para que el número de la celda nunca sea ambiguo.
//
// Se incluyen `athlete_user_id` Y `feedback_owner_user_id` a propósito: un CSV
// exportado por el entrenador tiene que distinguir quién EJECUTÓ de quién
// REPORTÓ. El leaderboard agrupa por ejecutor, así que un CSV que no lo diga no
// se puede reconciliar con la pantalla.
//
// Las columnas de FC / cadencia / desnivel / RPE NO están acá a propósito: los
// nombres exactos de esos campos los define el change del backend y no son
// verificables desde este repo todavía (el proposal los nombra en prosa, no por
// clave). Agregarlos con un nombre adivinado sería peor que no tenerlos: el
// `columns` que acepta toCsv los recibe del normalizer, que sí va a conocer las
// claves reales.
export const DASHBOARD_SERIES_COLUMNS = [
  { key: 'session_date', header: 'Fecha' },
  { key: 'athlete_user_id', header: 'Corredor (user_id)' },
  { key: 'feedback_owner_user_id', header: 'Reportó (user_id)' },
  { key: 'set_number', header: 'Número de serie' },
  { key: 'started_at', header: 'Inicio' },
  { key: 'ended_at', header: 'Fin' },
  { key: 'duration_ms', header: 'Duración', unitKey: 'time', defaultUnit: 'ms' },
  { key: 'active_duration_ms', header: 'Tiempo activo', unitKey: 'time', defaultUnit: 'ms' },
  { key: 'distance_meters', header: 'Distancia', unitKey: 'distance', defaultUnit: 'm' },
  { key: 'band', header: 'Cumplimiento' },
  { key: 'report_source', header: 'Origen del reporte' },
];

function headerOf(column, units) {
  if (!column.unitKey) return column.header;
  const unit = units?.[column.unitKey] ?? column.defaultUnit ?? '';
  return unit ? `${column.header} (${unit})` : column.header;
}

function resolveColumns(columns) {
  return Array.isArray(columns) && columns.length ? columns : DASHBOARD_SERIES_COLUMNS;
}

// Los dos productos de las columnas se exponen por separado porque el PDF
// imprime la MISMA tabla que el CSV: si cada documento armara sus encabezados
// por su lado, un cambio de columna en uno dejaría al otro desincronizado sin
// que nada falle (mismo criterio que `toCsv` recibiendo `columns`).
export function seriesColumnHeaders({ units = {}, columns = DASHBOARD_SERIES_COLUMNS } = {}) {
  return resolveColumns(columns).map((column) => headerOf(column, units));
}

// Una fila por serie, con las celdas ya convertidas a texto (o '' en vez de
// `null`). El escapado RFC 4180 es del CSV; el PDF escapa HTML por su cuenta.
export function seriesRows(series, { columns = DASHBOARD_SERIES_COLUMNS } = {}) {
  const cols = resolveColumns(columns);
  const rows = Array.isArray(series) ? series : [];
  return rows.map((row) => {
    const source = row && typeof row === 'object' ? row : {};
    return cols.map((column) => cellValue(source[column.key]));
  });
}

// Una celda nunca lleva un valor que no se pueda escribir: `null`/`undefined`
// quedan vacíos, y un no-finito (NaN/Infinity) también — `NaN` en una planilla
// es texto que después alguien suma. Los enums se copian crudo (`met`,
// `degraded`, `alta`): son el contrato del backend y traduciéndolos el archivo
// deja de reconciliarse con la respuesta de la API.
function cellValue(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '';
  if (typeof raw === 'boolean') return String(raw);
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? '' : raw.toISOString();
  if (typeof raw === 'string') return raw;
  // Un objeto o un array no se escribe: '[object Object]' en una celda es
  // basura silenciosa.
  return '';
}

// RFC 4180: se entrecomilla lo que tiene separador, salto de línea o comillas, y
// las comillas internas se duplican. Con separador ';' una coma igual exige
// comillas, porque no todos los lectores de planilla la tratan como dato.
function escapeCell(text) {
  const value = String(text ?? '');
  if (value === '') return '';
  const needsQuotes = /[";,\r\n]/.test(value) || value !== value.trim();
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

// Una fila por serie. `units` es el bloque de la respuesta; `columns` permite que
// el caller pase las columnas reales una vez que el backend cierre el contrato.
// Sin filas igual se emite el encabezado: un archivo con las columnas correctas
// y cero datos todavía dice qué se iba a exportar.
export function toCsv(series, { units = {}, columns = DASHBOARD_SERIES_COLUMNS } = {}) {
  const lines = [
    seriesColumnHeaders({ units, columns }).map(escapeCell).join(CSV_SEPARATOR),
    ...seriesRows(series, { columns }).map((row) => row.map(escapeCell).join(CSV_SEPARATOR)),
  ];

  return CSV_BOM + lines.join(CSV_EOL);
}

// Nombre del archivo exportado. `from`/`to` llegan como los emite `DateField`
// ('DD/MM/AAAA') y se bajan a ISO en el nombre: así la planilla y el buscador
// del sistema ordenan los archivos por fecha sin que nadie tenga que pensarlo.
// El nombre del ejercicio va sin acentos ni espacios — es un nombre de archivo,
// no un título.
export function dashboardExportFileName({ exerciseName, from, to, extension = 'csv' } = {}) {
  const parts = ['dashboard'];
  const name = slugify(exerciseName);
  if (name) parts.push(name);
  const range = [toISODate(from), toISODate(to)].filter(Boolean).join('_');
  if (range) parts.push(range);
  return `${parts.join('-')}.${slugify(extension) || 'csv'}`;
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}