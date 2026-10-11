// Progreso ESTIMADO (no real) para requests bulk atómicas donde el backend
// no reporta avance parcial -- ver services/api.js#BULK_REQUEST_TIMEOUT_MS.
// 5s/ítem es una estimación redonda, no medida con precisión (un solo repro
// real de 38 días tardó más de 90s, sin dato exacto de cuánto más) -- de
// ahí el tope en 0.95 en vez de 1: la barra nunca debe decir "listo" antes
// de que la respuesta real llegue, solo comunicar que sigue en curso y más
// o menos cuánto falta.
const MS_PER_ITEM_ESTIMATE = 5000;
const MIN_ESTIMATE_MS = 10000;

export function estimateBulkDurationMs(itemCount) {
  return Math.max(MIN_ESTIMATE_MS, itemCount * MS_PER_ITEM_ESTIMATE);
}

export function estimateProgressFraction(elapsedMs, estimatedTotalMs) {
  if (estimatedTotalMs <= 0) return 0;
  return Math.min(elapsedMs / estimatedTotalMs, 0.95);
}
