// ¿Esta competencia puede cerrarse (finalizarse) ahora? Solo la parte
// TEMPORAL/de estado -- el rol (entrenador) lo decide el caller, igual que
// el resto de los gates de competitions-tab.jsx.
//
// Una métrica tiene ventana fija (start_at → end_at): se cierra recién
// cuando la ventana terminó -- cerrarla antes cortaría un conteo en curso.
// Una ruta es ABIERTA (end_at: null por contrato, ver competitions-mock.js):
// no hay fecha que esperar, el cierre manual del entrenador ES el final.
// Antes el gate exigía `endAt && endAt < now` sin distinguir tipo, así que
// una ruta nunca mostraba el botón de cerrar (bug real, 2026-11-14).
// Una métrica sin endAt queda NO cerrable a propósito: ahí el null es un
// dato que falta, no un diseño abierto.
export function canCloseCompetition({ type, status, endAt } = {}, now = Date.now()) {
  if (status !== 'active') return false;
  if (endAt) return new Date(endAt).getTime() < now;
  return type === 'route';
}
