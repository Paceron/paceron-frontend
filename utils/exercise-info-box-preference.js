// Preferencia de UI del recuadro explicativo del form de ejercicios ("oculto para
// siempre"). Es una preferencia LOCAL: no es dato del usuario, no va al backend y
// no contiene nada sensible.
//
// Persiste por `services/storage.js` (localStorage en web, expo-secure-store en
// nativo) — el mismo mecanismo que el tema (`paceron-theme-mode`) y que la sesión
// (`paceron.auth`). No se inventó un helper de cookies: no hay soporte de cookies
// en este repo y meter un segundo mecanismo para el mismo tipo de dato sería lo
// contrario de la convención.
//
// Fallback: si el storage falla (modo privado, cuota llena), `read` devuelve null
// (se muestra el info box, que es el default) y `write` no rompe nada. El form
// nunca queda bloqueado por esto.

import { getItem, setItem } from '../services/storage.js';

const KEY = 'paceron.exercise-form-info-box-hidden';

export async function readInfoBoxDismissed() {
  try {
    return (await getItem(KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function writeInfoBoxDismissed(dismissed) {
  try {
    await setItem(KEY, dismissed ? 'true' : 'false');
  } catch {
    // Sin persistencia esta vez — el estado en memoria del form igual funciona.
  }
}
