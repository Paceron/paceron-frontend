// Piso de duración del overlay de espera del check-in del corredor.
//
// Sin esto, contra un backend local el POST resuelve en milisegundos y el GIF
// de "un segundo más" aparece un flash antes de que el resultado tome su lugar:
// se lee como un tirón, no como una confirmación.
//
// 2 s es un PISO, no un tiempo fijo. Si la request tarda 5 s (backend lento, red
// móvil) el overlay sigue ahí hasta que responda: lo que se busca es que el
// mensaje se lea en la pantalla, no que se cronometre. Por eso esto se mide
// contra el instante en que arrancó la request y no como un timer ciego.

/** Piso en ms del overlay de espera. */
export const MIN_WAITING_MS = 2000;

/**
 * Espera lo que falte para que hayan pasado `minMs` desde `startedAt`.
 *
 * El `Math.min` es un techo: sin él, un `startedAt` en el futuro (salto del reloj
 * del dispositivo, o un reloj que el usuario corrige mientras espera) daría un
 * `remaining` enorme y dejaría al corredor mirando el GIF mucho más de lo
 * previsto. Con el techo, la espera nunca supera el piso: solo puede rellenarlo.
 *
 * @param {number} minMs  piso a garantizar, en ms
 * @param {number} startedAt `Date.now()` del arranque de la request
 * @returns {Promise<void>} resuelve ya si la request ya cubrió el piso.
 */
export function waitMinimum(minMs, startedAt) {
  const remaining = Math.min(minMs, minMs - (Date.now() - startedAt));
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => { setTimeout(resolve, remaining); });
}
