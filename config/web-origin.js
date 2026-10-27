// Origen de la web deployada que carga el checkout nativo (WebView, ver
// components/payments/checkout-flow.jsx). Tiene que ser la web del MISMO entorno
// que el backend: la página del checkout le pega a la API con la que se buildeó,
// y el token que inyecta la app solo vale en el backend que lo emitió. Antes el
// default era siempre la web de producción (release viejo, sin /checkout) aunque
// la app apuntara al backend de develop: en mobile el pago terminaba en
// "ruta no encontrada".
export const PRODUCTION_WEB_ORIGIN = 'https://paceron-frontend.vercel.app';
export const DEVELOP_WEB_ORIGIN = 'https://paceron-frontend-git-develop-paceron.vercel.app';

// Backend (hostname) → web del mismo entorno. Ver docs/WORKFLOW.md, "Despliegues".
const WEB_ORIGIN_BY_API_HOST = {
  'paceron-backend.onrender.com': PRODUCTION_WEB_ORIGIN,
  'paceron-backend-as9c.onrender.com': DEVELOP_WEB_ORIGIN,
};

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// `override` (EXPO_PUBLIC_WEB_ORIGIN) gana siempre: es la forma de apuntar a una
// web local cuando el backend también es local. Un backend desconocido cae a la
// web de develop, el mismo entorno que el backend por default de config/env.js.
export function resolveWebOrigin(apiUrl, override) {
  const explicit = override?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return WEB_ORIGIN_BY_API_HOST[hostOf(apiUrl)] ?? DEVELOP_WEB_ORIGIN;
}
