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
  const cols = Array.isArray(columns) && columns.length ? columns : DASHBOARD_SERIES_COLUMNS;
  const rows = Array.isArray(series) ? series : [];

  const lines = [cols.map((column) => escapeCell(headerOf(column, units))).join(CSV_SEPARATOR)];
  for (const row of rows) {
    const source = row && typeof row === 'object' ? row : {};
    lines.push(cols.map((column) => escapeCell(cellValue(source[column.key]))).join(CSV_SEPARATOR));
  }

  return CSV_BOM + lines.join(CSV_EOL);
}