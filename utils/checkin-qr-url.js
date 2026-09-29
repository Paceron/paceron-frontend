// Lectura del QR de check-in. El backend codifica una URL, no un payload
// compacto (D1 del change registro-asistencia-correedor): el QR está impreso y
// colgado en la pared, así que tiene que servirle también a quien lo escanee con
// Google Lens sin tener la app. Por eso esto parsea una URL y no un string de
// la app.
//
// OJO con `URL`: react-native polyfillea un `URL` PROPIO
// (Libraries/Blob/URL), y a diferencia del de Node **no lanza con basura** —
// `new URL('hola que tal')` devuelve un objeto con `protocol: ''`, `host: ''` y
// `pathname: '/'`. O sea que el constructor no sirve como validación, y un
// `try/catch` alrededor no filtra nada en nativo (sí filtraría en web, donde sí
// es el de Node). Por eso la validación es explícita y no rely del throw.

const CHECKIN_PATH = '/attendance/register';

// Ids positivos enteros, como string. NO se castean: el comparador del proyecto
// es `isSameId` (utils/id-match.js) y los ids del roster llegan mezclados de
// tipo. El `Number()` va en el service, antes del body — la regla del CLAUDE.md
// sobre ids numéricos en requests.
const isPositiveId = (value) => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return false;
  return Number(value) > 0;
};

/**
 * Extrae `teamId` y `sessionInstanceId` de la URL del QR.
 *
 * @param {string} raw texto leído del código QR
 * @returns {{ teamId: string, sessionInstanceId: string } | null}
 *   `null` si el texto no es una URL de check-in válida. **Nunca** lanza.
 */
export function parseCheckinQrPayload(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  let url;
  try {
    url = new URL(text);
  } catch {
    // Solo llega acá en web (el `URL` de Node sí lanza). El polyfill de nativo
    // pasa el caso de basura por el chequeo de protocolo de abajo.
    return null;
  }

  // El protocolo vacío es la señal de "esto no era una URL": texto suelto, un
  // path relativo, o vacío. También rechaza `mailto:` y `javascript:` — este
  // último importa aunque suene obvio, porque un código QR malicioso puede
  // traer cualquiera de los dos esquemas y no queremos que lleguen a `openURL`.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.host) return null;

  // La ruta es lo que distingue "nuestro QR" de "cualquier URL". El HOST no se
  // valida a propósito: cambia por ambiente (Vercel prod, preview de develop,
  // localhost:8081, la IP de la máquina en la red local) y el app no tiene una
  // fuente confiable de "cuál es mi propio host web". Una URL de otro host con
  // esta ruta exacta y ids válidos no es un riesgo: el registro lo valida el
  // backend, que exige que el corredor pertenezca al equipo.
  if (url.pathname.replace(/\/+$/, '') !== CHECKIN_PATH) return null;

  const teamId = url.searchParams.get('team_id');
  const sessionInstanceId = url.searchParams.get('session_instance_id');
  if (!isPositiveId(teamId) || !isPositiveId(sessionInstanceId)) return null;

  return { teamId, sessionInstanceId };
}
