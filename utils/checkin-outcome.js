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
 * lo compara con el valor real: era el único acoplamiento por STRING entre este
 * repo y el backend en todo el flujo de check-in. Ya no decide nada — el status
 * manda— pero queda el texto a mano para poder compararlo.
 */
export const ALREADY_REGISTERED = 'esta asistencia fue previamente registrada';

// Por status del backend, no por texto: el texto de error es del backend y este
// es el que la pantalla muestra. 403 es "no pertenecés a este equipo" y 404 es
// "esa sesión ya no existe" — confundirlos manda al usuario a la persona
// equivocada.
const BY_STATUS = { 400: 'invalid', 403: 'forbidden', 404: 'gone' };

/** Los dos resultados de éxito: el corredor quedó registrado. */
const SUCCESS_KINDS = new Set(['registered', 'duplicate']);

/**
 * @param {object|null} response respuesta 2xx con `status` a mano, o null si hubo error
 * @param {object|null} error error normalizado de `services/api.js`, o null
 * @returns {{ kind: string, sessionDate: string|null, detail?: string }}
 *   `kind` nunca es undefined. `sessionDate` es la fecha (YYYY-MM-DD) de la
 *   sesión recién registrada, que es lo que permite abrir el día exacto.
 */
export function toOutcome(response, error) {
  if (!error) {
    // El STATUS manda, no el texto. El 201 (asistencia nueva) y el 200 (ya
    // estaba) devuelven el mismo body salvo por `message`, así que clasificar
    // por texto ataba el front a la redacción del otro repo — y ya se vio el
    // costo: un "ya estaba registrada" que no correspondía quedó sin forma de
    // diagnosticar porque el 200 no se veía desde la app.
    //
    // Sin `status` (backend viejo, o un test que arma la respuesta a mano) cae
    // en "registered", que es el default prudente: un duplicado mostrado como
    // registro nuevo molesta menos que un registro nuevo mostrado como duplicado.
    const successKind = response?.status === 200 ? 'duplicate' : 'registered';
    return {
      kind: successKind,
      sessionDate: typeof response?.session_date === 'string' ? response.session_date : null,
    };
  }

  const kind = BY_STATUS[error.status];
  if (kind) return { kind, sessionDate: null };

  // Sin status conocido: error de red (offline), un 5xx, o un 401 que el
  // interceptor no llegó a convertir. No se le inventa un mensaje concreto —
  // se conserva el detail real para que se pueda reportar, y el ícono es el de
  // error genérico.
  return { kind: 'unknown', sessionDate: null, detail: error.message };
}

/** ¿El corredor quedó registrado, sea la primera vez o la segunda? */
export function isCheckinSuccess(kind) {
  return SUCCESS_KINDS.has(kind);
}

/**
 * A dónde va el corredor cuando toca ACEPTAR.
 *
 * Éxito con fecha: directo al día que recién registró. La pantalla de
 * calendário ya sabe abrir un día por deep link (`?date=`): salta al mes y abre
 * el modal, así que no hace falta tocar el calendario a mano.
 *
 * Éxito sin fecha: se lo manda al calendario igual, en vez de dejarlo en un
 * limbo. Puede pasar si el backend no manda `session_date` (no debería, hay
 * contrato, pero el front no se rompe por eso).
 *
 * Error: al home. El calendario es un lugar de trabajo, no un lugar al que se
 * cae uno cuando el registro falló — y además en el 403 la sesión ni era suya.
 *
 * `returnTo`: cuando el escáner se abrió DESDE una sesión presencial en curso
 * (pre-start o en vivo, ver `session-pre-start-screen.jsx`/
 * `training-session-live-screen.jsx`), un éxito vuelve ahí en vez de saltar al
 * calendario — si no, el corredor queda sacado de su propia sesión y tiene que
 * rehacer el Play (bug real, 2026-10-01). Solo aplica a un ÉXITO: un error
 * sigue yendo al home sin `returnTo`, mismo criterio de siempre (una sesión
 * que no era suya no amerita devolverlo a ningún lado puntual).
 */
export function destinationForOutcome(outcome, returnTo) {
  if (!outcome || !isCheckinSuccess(outcome.kind)) return '/';
  if (returnTo) return returnTo;
  if (outcome.sessionDate) return `/calendar?date=${encodeURIComponent(outcome.sessionDate)}`;
  return '/calendar';
}
