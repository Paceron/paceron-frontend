// Traduce la respuesta del backend al resultado de pantalla del escáner.
//
// Vive acá y no en el componente para que sea testeable: el preset de jest es
// `jest-expo` pero los tests de este repo son de lógica pura (no hay render de
// componentes, ver CLAUDE.md), así que una función dentro de un `.jsx` no se
// puede ejercitar. Además es el módulo del que depende una decisión de diseño:
// qué ícono y qué copy muestra el corredor, que es donde un mapeo mal hecho
// hace que alguien llame al entrenador en vez de revisar si su sesión sigue en
// pie.
//
// D7: el 200 (ya registrada) lleva check verde, NO error. La asistencia quedó
// cargada igual, que es exactamente lo que el corredor quería hacer; ponerle
// error mentiría sobre si su sesión quedó en el cartel.

/**
 * El backend responde este texto exacto en el 200 idempotente
 * (`attendance.MessageAlreadyExists`). Exportado para que el test de contrato
 * loCompare con el valor real: es el único acoplamiento por STRING entre este
 * repo y el backend en todo el flujo de check-in.
 */
export const ALREADY_REGISTERED = 'esta asistencia fue previamente registrada';

// Por status del backend, no por texto: el texto de error es del backend y este
// es el que la pantalla muestra. 403 es "no pertenecés a este equipo" y 404 es
// "esa sesión ya no existe" — confundirlos manda al usuario a la persona
// equivocada.
const BY_STATUS = { 400: 'invalid', 403: 'forbidden', 404: 'gone' };

/**
 * @param {object|null} response cuerpo de la respuesta 2xx, o null si hubo error
 * @param {object|null} error error normalizado de `services/api.js`, o null
 * @returns {{ kind: string, detail?: string }} `kind` nunca es undefined.
 */
export function toOutcome(response, error) {
  if (!error) {
    return response?.message === ALREADY_REGISTERED
      ? { kind: 'duplicate' }
      : { kind: 'registered' };
  }

  const kind = BY_STATUS[error.status];
  if (kind) return { kind };

  // Sin status conocido: error de red (offline), un 5xx, o un 401 que el
  // interceptor no llegó a convertir. No se le inventa un mensaje concreto —
  // se conserva el detail real para que se pueda reportar, y el ícono es el de
  // error genérico.
  return { kind: 'unknown', detail: error.message };
}
