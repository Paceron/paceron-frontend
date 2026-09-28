// Compartir el documento del QR de asistencia: la hoja nativa (con el PDF
// adjunto) y el atajo de WhatsApp (D9, tarea 7.7).
//
// Son dos acciones porque resuelven cosas distintas, y la diferencia NO es
// cosmética: solo la primera puede mandar el archivo. Un deep link no adjunta
// archivos (R2), así que el atajo de WhatsApp es para "avisar que hay
// asistencia" y nada más — y el texto del mensaje dice eso explícitamente
// (ver buildAttendanceWhatsAppMessage), porque el mensaje es lo que el
// entrenador lee en WhatsApp: si el botón promete mandar el PDF y el mensaje no
// lo aclara, el destinatario se queda esperando un archivo que nunca llega. O
// sea: la honestidad va en el texto, no solo en el label del botón.
//
// Igual que en utils/attendance-qr-file.js, la plataforma se decide con
// utils/platform.js (`isWeb`) y no con un `Platform.OS` inline.

import { Linking } from 'react-native';
import * as Sharing from 'expo-sharing';

import { isWeb } from './platform';
import { openBrowserPrintDialog } from './attendance-qr-file';

// PDF que genera printToFileAsync, en el cache de la app.
const PDF_MIME_TYPE = 'application/pdf';

// Compartir el PDF con el archivo ADJUNTO: la hoja de compartir del sistema
// (WhatsApp, Mail, Drive, lo que haya). Es el camino principal de D9 y el único
// que cumple "mandar el PDF de verdad".
//
// En web el `uri` ni siquiera existe (printAttendanceQr devuelve
// `{ printed: true }`: el archivo lo produce el navegador desde el diálogo de
// impresión, no la app), así que la acción cae al diálogo de impresión — que es
// el "Guardar como PDF" equivalente. Para eso hace falta el `html` del
// documento: es el caller (7.8) el que lo tiene, y sin él esta función no
// tiene nada que imprimir.
//
// Ojo con un supuesto de D9 que en la versión instalada NO se cumple:
// `expo-sharing` sí tiene implementación web (node_modules/expo-sharing/build/
// ExpoSharing.web.js) y su `isAvailableAsync()` devuelve `!!navigator.share`,
// o sea TRUE en un Chrome de escritorio sobre HTTPS. Si se le confiara, el
// `shareAsync` de web haría `navigator.share({ url: 'file://…' })` — pasar un
// archivo local a la Web Share API no funciona, y el usuario vería un diálogo
// para compartir un link que no abre. Por eso la rama web NO entra por
// expo-sharing: va derecho al diálogo de impresión, que sí produce el PDF.
export async function shareAttendanceQr(uri, { dialogTitle, html } = {}) {
  if (isWeb) {
    return openBrowserPrintDialog(html);
  }

  const fileUri = String(uri ?? '').trim();
  if (!fileUri) {
    throw new Error('No hay archivo del documento para compartir');
  }

  // Guard explícito y no confianza en el error nativo: en iOS/Android el error
  // de `shareAsync` no dice nada accionable, y el caller necesita un mensaje
  // para el toast. El `mimeType` es solo Android (en los tipos de
  // expo-sharing está anotado @platform android); en iOS expo-sharing deriva el
  // UTI de la extensión del archivo, que ya es `.pdf` porque lo nombró
  // `printToFileAsync`.
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Este dispositivo no permite compartir archivos');
  }

  await Sharing.shareAsync(fileUri, { dialogTitle, mimeType: PDF_MIME_TYPE });
}

// Armado del mensaje del atajo. Función PURA y exportada (a diferencia del resto
// del archivo) por dos razones: es la parte con el texto que el usuario lee de
// verdad, así que es la que más vale la pena poder testear; y sacarla del
// `openURL` la deja legible sin estar persiguiendo un string encodeado dentro
// de una URL.
export function buildAttendanceWhatsAppMessage({ teamName, sessionName, date } = {}) {
  const team = String(teamName ?? '').trim();
  const session = String(sessionName ?? '').trim();
  const day = formatAttendanceDate(date);

  // Armado por bloques unidos con línea en blanco, en vez de una lista de líneas
  // con separadores fijos: si faltara el equipo o la fecha, los separadores fijos
  // quedarían pegados y el mensaje llevaría tres líneas en blanco en el medio.
  //
  // El `filter(Boolean)` es lo que descarta las líneas sin dato, y hace falta
  // contra TODO lo falsy, no solo contra `false`: con un campo vacío el
  // `team && \`Equipo: ${team}\`` devuelve `''` (no `false`), así que un
  // `filter((line) => line !== false)` los dejaría pasar y el mensaje
  // terminaría con "Equipo:" y nada al lado — el campo vacío que el spec
  // prohíbe en todas partes (mismo criterio que buildDetailsHtml en
  // attendance-qr-pdf.js:119-126).
  const header = [
    'Hola! Te escribo por la sesión de Paceron.',
    team && `Equipo: ${team}`,
    session && `Sesión: ${session}`,
    day && `Fecha: ${day}`,
  ].filter(Boolean);

  return [
    header.join('\n'),
    'Para registrar tu asistencia, escaneá el código QR del cartel (o abrilo desde la app, en la sesión).',
    'Aclaración: este mensaje es solo un aviso y el PDF del cartel NO va adjunto — los enlaces de WhatsApp no pueden mandar archivos. Si lo necesitás, contestame y te lo reenvío con el PDF adjunto.',
  ].join('\n\n');
}

// `date` de la sesión: el backend manda un ISO con hora
// ("2026-09-24T23:00:00.000Z"), no el "YYYY-MM-DD" de los días de calendario.
// Se recorta a la parte de fecha y se rearma en DD-MM-AAAA — el mismo formato
// de pantalla, y el mismo razonamiento que formatAttendanceDate de
// utils/attendance-qr-pdf.js:60-66.
//
// Va duplicado en vez de delegar por el mismo motivo que allá:
// utils/format-date-display.js importa `react-native-calendars` por
// `LocaleConfig`, cuyo src/index.ts es ESM sin transpilar y rompe cualquier
// test de este módulo. Tres líneas de split, sin dependencia.
//
// Y se recorta el string en vez de parsear con `new Date()` a propósito: parsear
// un timestamp con Z y formatearlo en hora local puede correr el día al que sea,
// y un mensaje que dice la fecha equivocada no se corrige. Si el valor no parece
// una fecha, no se manda la línea.
function formatAttendanceDate(date) {
  const value = String(date ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

// Atajo de WhatsApp: abre una conversación con el mensaje escrito (R2 — el PDF
// NO se adjunta, no se puede; la forma de mandarlo es la hoja nativa de arriba,
// dos toques más).
//
// `Linking.canOpenURL` NO se usa, y es deliberado (R2/R3 del design):
//  - En Android 11+ `canOpenURL` devuelve `false` para todo esquema que no esté
//    declarado en `<queries>` del manifest, **aunque la app esté instalada** —
//    o sea la guarda mentiría justo en el caso principal (el entrenador con
//    WhatsApp instalado) y el atajo quedaría muerto en silencio. Declarar
//    `intentFilters` en app.config.js para arreglarlo sumaría superficie de
//    configuración a un atajo opcional.
//  - En web (R3) abrir un esquema custom puede no lanzar excepción nunca, así
//    que un `try/catch` alrededor de `openURL` no es un detector de
//    disponibilidad: por eso en web se va directo a `https://wa.me/`
//    explícitamente, no por try/catch.
//
// El orden es: nativo primero al esquema (abre la app instalada, que es lo que
// quiere el 90% de los casos y no pierde la conversación), y `wa.me` como
// red de contención si el sistema no puede resolver el esquema.
export async function shareViaWhatsApp({ teamName, sessionName, date } = {}) {
  const text = buildAttendanceWhatsAppMessage({ date, sessionName, teamName });
  const webUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  if (isWeb) {
    // R3: en web no se intenta el esquema custom.
    await Linking.openURL(webUrl);
    return;
  }

  try {
    await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`);
  } catch {
    await Linking.openURL(webUrl);
  }
}
