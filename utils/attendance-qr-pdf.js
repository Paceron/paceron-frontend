// Documento PDF (A4) del QR de asistencia, armado como string HTML desde el
// cliente — D8: `expo-print.printToFileAsync({ html })` en nativo y el diálogo
// de impresión del navegador en web (tarea 7.6). Descartado el endpoint de PDF
// en el backend porque el diseño del documento itera con diseño y cada iteración
// sería un deploy.
//
// Función PURA a propósito — sin React, sin fetch, sin expo-print — para que el
// HTML se pueda testear con Jest en vez de tener que imprimir un PDF en un
// device para verificar que el equipo o la fecha están. El render/impresión es
// del caller (7.6); acá solo se arma el documento.
//
// `logoDataUri` y `qrDataUri` llegan YA como data URI (el primero lo resuelve
// utils/attendance-qr-file.js con expo-asset + expo-file-system, cacheado a nivel
// de módulo, porque printToFileAsync renderiza en un contexto sin acceso a
// archivos locales: `assets/logo_paceron_*.png` no se puede referenciar por ruta,
// tiene que ir embebido).

// Escapado de HTML para TODO lo que viene de datos.
//
// Por qué un escaper propio y no "sanear" quitando tags, ni una librería:
//  - Quitar tags altera el dato. Un nombre de sesión legítimo como
//    `Sesión "A" & "B"` perdería contenido, y los nombres los escribe el
//    entrenador: es contenido, no markup.
//  - Una librería de DOM no existe en el contexto donde se imprime: en nativo
//    `printToFileAsync` pasa el HTML a un renderer nativo sin `document`, así que
//    ni `createElement` ni DOMPurify están disponibles. El util tiene que correr
//    en Node (Jest) y en ese renderer con la misma implementación.
//
// Los cinco caracteres son los que hacen falta para dos riesgos distintos:
// `<`/`>` abren y cierran etiquetas (un nombre con `<script>` inyectaría markup en
// el documento), y `"`/`'` rompen el atributo delimitado por comillas — que es
// exactamente donde caen `src` del QR, `src` del logo y los `content` de los
// labels. El `&` va PRIMERO en la cadena de reemplazos para no escapar dos veces
// lo que genera el propio escape (`&lt;` no debe terminar en `&amp;lt;`).
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

// `date` de la sesión es un ISO CON hora ("2026-09-24T23:00:00.000Z"), no el
// "YYYY-MM-DD" de los días de calendario: se recorta a la parte de fecha y se
// rearma en DD-MM-AAAA, el mismo formato de pantalla. Es el mismo razonamiento
// (y el mismo criterio) que formatSessionDate de
// components/attendance/attendance-selection-panel.jsx:207-219, para que la fecha
// del cartel y la de la pantalla no se desincronicen.
//
// El formateo va duplicado acá a propósito, en vez de delegar en
// utils/format-date-display.js: ese módulo importa `react-native-calendars` por
// LocaleConfig (format-date-display.js:1), cuyo src/index.ts es ESM sin
// transpilar y el `transformIgnorePatterns` actual del proyecto no lo procesa —
// importarlo hace que ESTE test no pueda correr ("SyntaxError: Unexpected token
// 'export'"), o sea que la reutilización rompería el requisito explícito de 7.4
// (función pura testeable con Jest). Tres líneas de split, sin dependencia.
//
// Recortar el string en vez de parsear con `new Date()` también es a propósito:
// parsear un timestamp con Z y formatearlo en hora local puede correr el día al
// que sea, y esto es un documento IMPRESO — un cartel con la fecha equivocada no
// se corrige después. Si el `date` no viene o no parece una fecha, la fila de
// fecha no se renderiza (mismo criterio que horario/lugar: no imprimir campos
// vacíos).
function formatAttendanceDate(isoDate) {
  const value = String(isoDate ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

// Horario presencial. `presencial_time_from`/`presencial_time_to` son NULLABLES
// y lo es de verdad: `is_presencial` es un booleano del día, independiente de que
// tenga horario — el DAO de calendario contempla explícitamente el
// `presencial_time_from IS NULL` y la fixture de
// services/__mocks__/attendance-mock.js:68-72 tiene la sesión 502 exactamente
// así (los dos horarios y el lugar en null).
//
// Con los dos → "19:00 – 20:15". Con uno solo → se imprime el que vino, sin
// inventar el otro: no se deduce un rango de una hora suelta ni se rotula
// "hasta" lo que puede ser el inicio. Sin ninguno → null (no se renderiza la
// fila).
function formatScheduleRange(session) {
  const from = String(session?.presencial_time_from ?? '').trim();
  const to = String(session?.presencial_time_to ?? '').trim();
  if (from && to) return `${from} – ${to}`;
  return from || to || null;
}

// Lugar presencial.
//
// `presencial_location` NO es un string: es el jsonb `{lat, lng, label?}` del
// backend (docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md, tabla de
// GroupCalendarDay; normalizado igual en services/normalizers.js:663-664 y con
// la misma forma en el mock, attendance-mock.js:63). Lo único imprimible de ese
// objeto es el `label`, que además es OPCIONAL: el entrenador puede dejar solo
// el pin en el mapa.
//
// Sin label no se imprime la fila: el spec pide "el lugar cuando existan" y
// "no muestra campos vacíos" (scenarios "El PDF muestra horario y lugar cuando
// existen" / "…cuando no existen" del requirement del PDF), y una fila con
// "Lugar:" y nada al lado es exactamente el campo vacío que el spec prohíbe.
// Las coordenadas crudas (-32.8895, -68.8458) no son un lugar que se pueda leer
// en un cartel colgado en un parque.
function readLocationLabel(session) {
  const label = session?.presencial_location?.label;
  const value = String(label ?? '').trim();
  return value || null;
}

// Una fila de detalle: label en versalitas + valor. Se arma por fila y se
// concatena solo con las que tienen dato, así el bloque no existe (no queda
// padding ni una línea en blanco) cuando no hay horario ni lugar.
function detailRow(label, value) {
  return [
    '<div class="detail">',
    `<div class="detail-label">${escapeHtml(label)}</div>`,
    `<div class="detail-value">${escapeHtml(value)}</div>`,
    '</div>',
  ].join('');
}

function buildDetailsHtml(session) {
  const rows = [];
  const schedule = formatScheduleRange(session);
  const location = readLocationLabel(session);
  if (schedule) rows.push(detailRow('Horario', schedule));
  if (location) rows.push(detailRow('Lugar', location));
  if (rows.length === 0) return '';
  return `<section class="details">${rows.join('')}</section>`;
}

// El logo es opcional a propósito: si utils/attendance-qr-file.js no pudo
// resolver el asset, el documento tiene que salir igual (el QR es lo
// indispensable) pero sin un <img> con src vacío — según el renderer eso deja un
// ícono de imagen rota o, peor, un request a la propia URL del documento. En
// su lugar va el wordmark de texto con el verde de marca.
//
// El wordmark NO intenta reproducir el `skewX` de PaceronBrand: es el transform
// que no se aplica en Android (quirk conocido en CLAUDE.md, "Quirks"), y
// aplicarlo en un renderer de impresión que puede ser el mismo Android sería
// justamente repetir el bug.
function buildLogoHtml(logoDataUri) {
  const logo = String(logoDataUri ?? '').trim();
  if (!logo) return '<div class="wordmark">PACERON</div>';
  return `<img class="logo" src="${escapeHtml(logo)}" alt="Paceron" />`;
}

// Documento A4 completo. El <title> no es decorativo: en web es de donde el
// navegador saca el nombre de archivo sugerido en "Guardar como PDF", así que
// conviene que identifique la sesión y no sea "Documento".
export function buildAttendanceQrHtml({ team, session, qrDataUri, logoDataUri } = {}) {
  // Falla ruidoso, y no es una exageración: este documento se IMPRIME y se CUELGA
  // en la pared. Un PDF sin QR es un cartel que no escanea, y el entrenador se
  // entera días después, cuando ya no hay nada que corregir. Un throw lo corta
  // acá, y el caller (7.6) ya tiene su camino de error (aviso + el modal sigue
  // abierto) — mismo criterio que "fallar ruidoso es mejor que mandar un
  // team_id equivocado" de utils/attendance-payload.js.
  if (!String(qrDataUri ?? '').trim()) {
    throw new Error('No se puede armar el PDF del QR sin el código QR de la sesión');
  }

  const teamName = String(team?.name ?? '').trim();
  const sessionName = String(session?.name ?? '').trim();
  const date = formatAttendanceDate(session?.date);
  const title = [teamName, sessionName].filter(Boolean).join(' — ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title || 'QR de asistencia')}</title>
<style>
  /* A4 real y márgenes 0: el padding lo hace .page, para que el fondo del
     documento llegue al borde del papel en vez de dejar la banda blanca
     default del renderer. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    color: #111518;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    /* Tamaños y line-heights en pt (D8): el documento se mide en unidades de
       impresión, no de pantalla — el mismo string alimenta el printToFile y el
       preview del navegador. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 16mm 18mm 12mm;
    display: flex;
    flex-direction: column;
  }

  /* Cabecera: logo a la izquierda, equipo + fecha a la derecha. */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 0.6pt solid #c0c8cd;
    padding-bottom: 6mm;
  }
  .logo { max-height: 13mm; max-width: 42mm; }
  .wordmark {
    font-size: 15pt;
    font-weight: 800;
    letter-spacing: 2pt;
    color: #8cc63e;
  }
  .header-meta { text-align: right; }
  .header-team { font-size: 15pt; font-weight: 700; line-height: 1.25; }
  .header-date { font-size: 10pt; color: #40484c; line-height: 1.35; margin-top: 1.5mm; }

  /* Título de la sesión: es lo que identifica el cartel de una pared a otro. */
  .session-name {
    font-size: 24pt;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    margin: 12mm 0 0;
  }

  /* La fecha va DEBAJO del nombre, no solo en el header: el header es chico y se
     lee de reojo, y la fecha de la sesión es justo lo que el entrenador necesita
     para colgar el cartel del día correcto (un cartel con la fecha corrida no se
     corrige después de impreso). Se rotula con la palabra "del" para que se lea
     sola en vez de una fecha suelta colgando del nombre. */
  .session-date {
    font-size: 12pt;
    color: #40484c;
    line-height: 1.35;
    text-align: center;
    margin: 1.5mm 0 0;
  }

  /* El QR es el elemento dominante: 108mm de los 174mm de ancho útil, sobre una
     tarjeta blanca con borde y zona de silencio propia (padding), para que los
     módulos del código no queden pegados al marco. El QR del backend es de
     256px (go-qrcode), así que a 108mm los módulos quedan holgados y escanean
     bien impreso. page-break-inside evita que se parta al medio si el detalle de
     abajo empuja el alto de la página. */
  .qr-card {
    width: 128mm;
    margin: 10mm auto 0;
    padding: 10mm;
    background: #ffffff;
    border: 0.6pt solid #c0c8cd;
    border-radius: 3mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .qr { display: block; width: 108mm; height: 108mm; }

  .hint {
    text-align: center;
    font-size: 11pt;
    color: #40484c;
    margin: 7mm 0 0;
  }

  /* Bloque secundario: horario y lugar, solo si existen. Sin fila vacía ni
     separadores huérfanos (ver buildDetailsHtml). */
  .details {
    width: 128mm;
    margin: 11mm auto 0;
    display: flex;
    gap: 10mm;
  }
  .detail { flex: 1; }
  .detail-label {
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.8pt;
    text-transform: uppercase;
    color: #40484c;
  }
  .detail-value { font-size: 12.5pt; line-height: 1.35; margin-top: 1.5mm; }

  .footer {
    margin-top: auto;
    padding-top: 8mm;
    text-align: center;
    font-size: 8.5pt;
    color: #40484c;
  }
</style>
</head>
<body>
  <div class="page">
    <header class="header">
      ${buildLogoHtml(logoDataUri)}
      <div class="header-meta">
        ${teamName ? `<div class="header-team">${escapeHtml(teamName)}</div>` : ''}
        ${date ? `<div class="header-date">${escapeHtml(date)}</div>` : ''}
      </div>
    </header>
    ${sessionName ? `<h1 class="session-name">${escapeHtml(sessionName)}</h1>` : ''}
    ${date ? `<p class="session-date">Sesión del ${escapeHtml(date)}</p>` : ''}
    <div class="qr-card">
      <img class="qr" src="${escapeHtml(qrDataUri)}" alt="Código QR de asistencia" />
    </div>
    <p class="hint">Escaneá este código con la cámara para registrar tu asistencia</p>
    ${buildDetailsHtml(session)}
    <div class="footer">Generado con Paceron</div>
  </div>
</body>
</html>`;
}
