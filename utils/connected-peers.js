// Roster liviano de "quién está conectado ahora" para el selector de
// destinatario del CORREDOR (spec: "un compañero de la lista de
// participantes conectados") -- a diferencia de
// utils/trainer-participant-state.js (mucho más rico: posición, estado por
// serie, etc.), acá solo hace falta un Set de userIds conectados, nada más.
// Nunca muta `current` -- devuelve el MISMO Set (misma referencia) si el
// mensaje no cambia nada, para que el caller pueda comparar por identidad.
export function applyPeerPresence(current, msg) {
  if (msg?.type !== 'presence') return current;
  const userId = msg.from != null ? String(msg.from) : null;
  if (!userId) return current;

  if (msg.event === 'left') {
    if (!current.has(userId)) return current;
    const next = new Set(current);
    next.delete(userId);
    return next;
  }

  // joined, position, set_status -- CUALQUIERA de estos prueba que ese
  // userId está conectado, mismo criterio que ya usa
  // trainer-participant-state.js#applyParticipantMessage (si alguien llega
  // tarde al `joined` explícito, su primer `position`/`set_status` igual lo
  // confirma conectado).
  if (current.has(userId)) return current;
  const next = new Set(current);
  next.add(userId);
  return next;
}
