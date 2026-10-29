// HTML del documento imprimible del dashboard. Parte PURA a propósito: es lo
// único de la exportación a PDF que se puede testear con Jest. La entrega vive
// en services/dashboard-pdf.js (expo-print + expo-sharing) y
// services/dashboard-pdf.web.js (diálogo de impresión del navegador sobre un
// iframe), porque en web `expo-print` imprime la app entera — ver
// utils/attendance-qr-file.js.
//
// Los gráficos y las secciones visuales llegan rasterizados como capturas por
// sección; la parte textual (contexto, KPIs y series) se construye acá para que
// el HTML no dependa del contrato de la API ni de React Native.
//
// La captura llega YA rasterizada como data URI (`react-native-view-shot`, ver
// services/dashboard-capture.js): este builder es puro y no sabe de views. El
// logo también llega como data URI porque `printToFileAsync` renderiza en un
// contexto sin acceso a archivos locales — mismo motivo que el logo del PDF de
// asistencia (`utils/attendance-qr-file.js`).
//
// Todo lo que entra se escapa: el nombre del ejercicio y del grupo los escribe
// el usuario, y un `<` en el HTML no es un detalle cosmético — rompe la tabla
// entera o, peor, inyecta markup en un documento que se comparte.

import { seriesColumnHeaders, seriesRows } from './dashboard-export.js';

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

// El logo va como data URI (no como ruta): `printToFileAsync` no puede leer
// `assets/…` desde el HTML. Se valida el prefijo aunque venga de nuestro propio
// resolver: un string arbitrario interpolado en `src` es justamente el tipo de
// agujero que este archivo evita en el resto de los campos.
function logoHtml(logoDataUri) {
  const source = String(logoDataUri ?? '').trim();
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(source)) {
    return '<div class="wordmark">PACERON</div>';
  }
  return `<img class="logo" src="${escapeHtml(source)}" alt="Paceron" />`;
}

// La captura de la pantalla es opcional: si el dispositivo no pudo rasterizar
// la view, el PDF sale igual (con los números y la tabla). Se restringe a los
// formatos que produce `react-native-view-shot` y se evita aceptar cualquier
// `data:` que llegue por error.
function screenshotHtml(screenshotDataUri, screenshotDataUris) {
  const sources = [
    ...(Array.isArray(screenshotDataUris) ? screenshotDataUris : []),
    ...(screenshotDataUri ? [screenshotDataUri] : []),
  ].map((item) => String(item ?? '').trim())
    .filter((source) => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(source));
  if (!sources.length) return '';
  return sources.map((source, index) => (
    `<figure class="screenshot${index ? ' screenshot-next-page' : ''}"><img src="${escapeHtml(source)}" alt="Sección ${index + 1} del reporte" /></figure>`
  )).join('');
}

// "Filtros aplicados" es una lista explícita de lo que recorta el documento.
// No se deduce de los KPIs: el PDF circula solo (por mail, impreso), así que
// tiene que decir por sí mismo qué período, corredor o rango está mirando.
function filtersHtml(filters) {
  const items = (Array.isArray(filters) ? filters : []).filter(
    (item) => item && item.label && item.value !== null && item.value !== undefined && item.value !== '',
  );
  if (!items.length) return '';
  return [
    '<h2>Filtros aplicados</h2>',
    '<table class="filters"><tbody>',
    items.map((item) => `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`).join(''),
    '</tbody></table>',
  ].join('');
}

function metaHtml(meta) {
  const items = (Array.isArray(meta) ? meta : []).filter((item) => item && item.value !== null && item.value !== undefined && item.value !== '');
  if (!items.length) return '';
  return `<div class="meta">${items
    .map((item) => `<div><span class="meta-label">${escapeHtml(item.label)}</span><span class="meta-value">${escapeHtml(item.value)}</span></div>`)
    .join('')}</div>`;
}

function kpisHtml(kpis) {
  const items = (Array.isArray(kpis) ? kpis : []).filter((item) => item && item.label);
  if (!items.length) return '';
  return `<table class="kpis"><tbody>${items
    .map((item) => `<tr><th scope="row">${escapeHtml(item.label)}</th><td class="value">${escapeHtml(item.value)}</td></tr>`)
    .join('')}</tbody></table>`;
}

function seriesHtml(series, units, columns) {
  if (!Array.isArray(series) || !series.length) return '';
  const headers = seriesColumnHeaders({ units, columns });
  const rows = seriesRows(series, { columns });
  return [
    '<h2>Series del período</h2>',
    '<table class="series"><thead><tr>',
    headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join(''),
    '</tr></thead><tbody>',
    rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join(''),
    '</tbody></table>',
  ].join('');
}

export function buildDashboardPdfHtml({
  title = 'Rendimiento',
  subtitle = '',
  meta = [],
  kpis = [],
  series = [],
  units = {},
  columns,
  generatedAt = '',
  logoDataUri = '',
  screenshotDataUri = '',
  screenshotDataUris = [],
  filters = [],
} = {}) {
  const titleHtml = escapeHtml(title);
  const subtitleText = String(subtitle ?? '').trim();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${titleHtml}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #111518; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 0 0 16px; }
  .doc-heading { flex: 1; min-width: 0; }
  h1 { margin: 0 0 4px; font-size: 20px; line-height: 1.2; }
  .subtitle { margin: 0; color: #40484c; font-size: 12px; }
  .logo { display: block; max-height: 13mm; max-width: 42mm; }
  .wordmark { color: #6d9e2f; font-size: 16px; font-weight: 700; letter-spacing: .08em; }
  .screenshot { margin: 0 0 18px; padding: 0; break-inside: avoid; }
  .screenshot-next-page { break-before: page; page-break-before: always; }
  .screenshot img { display: block; width: auto; height: auto; max-width: 100%; max-height: 255mm; margin: 0 auto; border: 1px solid #dfe5e7; border-radius: 2px; background: #fff; }
  .meta { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 0 0 18px; }
  .meta-label { display: block; color: #6b7378; font-size: 9px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .meta-value { display: block; margin-top: 2px; font-size: 11px; }
  .filters { width: 100%; margin: 0 0 18px; border-collapse: collapse; }
  .filters th { width: 30%; padding: 5px 8px 5px 0; border-bottom: 1px solid #e9edef; color: #40484c; font-size: 10px; font-weight: 400; text-align: left; }
  .filters td { padding: 5px 0; border-bottom: 1px solid #e9edef; font-size: 10px; }
  .kpis { width: 100%; margin: 0 0 18px; border-collapse: collapse; }
  .kpis th { width: 60%; padding: 6px 8px 6px 0; border-bottom: 1px solid #e2e6e8; color: #40484c; font-size: 11px; font-weight: 400; text-align: left; }
  .kpis td.value { padding: 6px 0; border-bottom: 1px solid #e2e6e8; font-size: 11px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  h2 { margin: 0 0 8px; font-size: 13px; }
  .series { width: 100%; border-collapse: collapse; font-size: 9px; }
  .series th { padding: 4px 5px; background: #f1f4f5; border-bottom: 1px solid #cfd6d9; text-align: left; font-weight: 600; }
  .series td { padding: 3px 5px; border-bottom: 1px solid #e9edef; font-variant-numeric: tabular-nums; }
  footer { margin-top: 16px; color: #6b7378; font-size: 9px; }
</style>
</head>
<body>
<div class="doc-header">
  <div class="doc-heading">
    <h1>${titleHtml}</h1>
    ${subtitleText ? `<p class="subtitle">${escapeHtml(subtitleText)}</p>` : ''}
  </div>
  ${logoHtml(logoDataUri)}
</div>
${metaHtml(meta)}
${filtersHtml(filters)}
${kpisHtml(kpis)}
${screenshotHtml(screenshotDataUri, screenshotDataUris)}
${seriesHtml(series, units, columns)}
${generatedAt ? `<footer>Generado el ${escapeHtml(generatedAt)} · Paceron</footer>` : ''}
</body>
</html>`;
}
