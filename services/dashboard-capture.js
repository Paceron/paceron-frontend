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
//
// `require` diferido, NO `import` arriba: la librería llama a
// `TurboModuleRegistry.getEnforcing('RNViewShot')` apenas se evalúa, y en un
// dev client generado antes de sumarla eso tira y tumba el bundle ENTERO al
// arrancar (este archivo está en el grafo de imports por el dashboard), no
// solo la captura (bug real, 2026-11-10). Cargándola acá adentro, sin el
// módulo nativo solo falla esta Promise y el PDF sale sin figura.
export function captureDashboardView(viewRef) {
  const target = viewRef?.current ?? viewRef;
  if (!target) return Promise.resolve(null);

  let captureRef;
  try {
    ({ captureRef } = require('react-native-view-shot'));
  } catch (error) {
    return Promise.reject(error);
  }

  return captureRef(target, {
    format: 'png',
    quality: 1,
    result: 'data-uri',
  });
}
