// Captura de la región visual del dashboard para el PDF, en WEB.
//
// NO usa `react-native-view-shot` acá aunque la librería tenga un build web:
// su `captureRef` compartido resuelve el nodo con `findNodeHandle`, y en
// react-native-web ese helper **tira siempre** (`findNodeHandle is not
// supported on web`). O sea que en web el camino de la librería es un throw
// síncrono, no una promesa rechazada. Acá el ref de una View de RN Web ya es el
// nodo DOM, que es justo lo que necesita `html2canvas`.
//
// La captura es OPCIONAL: si falla, el PDF sale igual con los números y la
// tabla. El caller la trata como best-effort (ver export-actions.jsx).
import html2canvas from 'html2canvas';

// Fondo sobre el que se compone la captura. NO puede quedar transparente: la
// pantalla tiene superficies translúcidas (`dark:bg-green-950/25` en las cards
// de KPIs), y al embeberlas en el blanco del PDF el texto claro del modo oscuro
// termina sobre un fondo casi blanco. Con el fondo real del tema, la captura
// conserva el contraste que el usuario ve en pantalla.
//
// `getComputedStyle(document.body)` es la fuente de verdad porque global.css
// pinta `.dark body` con el fondo de la app; el fallback cubre un body sin
// background resuelto (por ejemplo, durante el arranque).
function captureBackgroundColor() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '#ffffff';
  const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  const isTransparent = !bodyBackground || bodyBackground === 'transparent' || bodyBackground === 'rgba(0, 0, 0, 0)';
  if (!isTransparent) return bodyBackground;
  return document.documentElement.classList.contains('dark') ? '#020617' : '#ffffff';
}

export async function captureDashboardView(viewRef) {
  const target = viewRef?.current ?? viewRef;
  // En RN Web `ref.current` es el elemento DOM; si todavía no montó, no hay
  // nada que capturar.
  if (!target || typeof target.getBoundingClientRect !== 'function') return null;

  const canvas = await html2canvas(target, {
    // El fondo del tema evita que las superficies translúcidas se aplanen
    // contra el blanco del documento (ver captureBackgroundColor).
    backgroundColor: captureBackgroundColor(),
    // El dashboard puede medir ~900px de ancho; a 3x en un celular/tablet el
    // PNG se vuelve innecesariamente grande para una hoja A4.
    scale: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
    logging: false,
    useCORS: true,
  });

  return canvas.toDataURL('image/png');
}
