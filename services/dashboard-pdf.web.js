// Entrega WEB del PDF: el diálogo de impresión del navegador sobre el documento,
// no sobre la app. `expo-print` en web es `window.print()` y descarta el HTML
// (ver exponente en utils/attendance-qr-file.js), así que se reusa el mismo
// helper del PDF de asistencia — iframe con `srcdoc`, `print()` en el `load` del
// documento, y rechazo (en vez de imprimir la app) si el iframe no puede.
import { openBrowserPrintDialog } from '../utils/attendance-qr-file.js';

export async function saveDashboardPdf(html) {
  await openBrowserPrintDialog(html, { title: 'Impresión del rendimiento' });
  return { printed: true };
}
