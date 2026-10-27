// Captura de la región visual del dashboard para el PDF, en NATIVO. Devuelve un
// data URI PNG listo para embeber en el HTML de `expo-print` (que no puede leer
// archivos locales) y para el iframe de impresión de web.
//
// La captura es OPCIONAL: si falla, el PDF sale igual con los números y la
// tabla. Por eso el caller la trata como best-effort y no bloquea la
// exportación (ver components/dashboard/export-actions.jsx).
//
// En web hay otro archivo (`dashboard-capture.web.js`): la librería resuelve el
// nodo con `findNodeHandle`, que en react-native-web tira siempre, así que ahí
// se rasteriza directo con `html2canvas`. En nativo es un módulo nativo, así
// que requiere dev client: Expo Go no alcanza (ver README de la librería).
import { captureRef } from 'react-native-view-shot';

export function captureDashboardView(viewRef) {
  const target = viewRef?.current ?? viewRef;
  if (!target) return Promise.resolve(null);

  return captureRef(target, {
    format: 'png',
    quality: 1,
    result: 'data-uri',
  });
}
