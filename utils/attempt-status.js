// Status de un intento de competencia de ruta a partir de los dos datos
// remotos (runner_session + lista de feedback) -- puro, sin imports de
// session-db.js a propósito: ese módulo importa expo-sqlite (ESM puro),
// que Jest no puede transformar, así que cualquier archivo que lo
// importe (ni siquiera transitivamente) deja de ser testeable. `wip` con
// feedback ya sincronizado SÍ es `synced` (un intento de ruta es un solo
// set; una vez que ese set tiene feedback, hay stats reales que mostrar
// aunque el runner_session todavía no haya recibido el PATCH finished).
export function deriveAttemptStatus({ runnerSession, feedbackList }) {
  if (!runnerSession) return 'not_found';
  if (!feedbackList?.length) return 'pending';
  return 'synced';
}
