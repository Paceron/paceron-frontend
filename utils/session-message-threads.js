// Agrupa mensajes de sesión en vivo en "hilos" por conversación -- un
// mensaje raíz (sin reply_to_message_id) más todas las respuestas que, subiendo
// la cadena de reply_to_message_id, terminan en esa misma raíz. Cubre tanto un
// 1 a 1 como un mensaje a varios con respuestas de distinta gente: todas caen
// en el mismo hilo porque todas apuntan (directa o indirectamente) a la misma
// raíz. `messages` ya viene cronológico (id ASC, orden del backend) -- el
// orden de los hilos sale de la posición de su raíz en esa misma lista, sin
// ordenar de nuevo.
export function groupMessagesByThread(messages) {
  const list = messages ?? [];
  const byId = new Map(list.map((m) => [m.id, m]));

  const rootIdFor = (message) => {
    let current = message;
    const visited = new Set([current.id]);
    while (current.replyToMessageId != null) {
      const next = byId.get(current.replyToMessageId);
      if (!next || visited.has(next.id)) break;
      visited.add(next.id);
      current = next;
    }
    return current.id;
  };

  const order = [];
  const groups = new Map();
  for (const message of list) {
    const rootId = rootIdFor(message);
    if (!groups.has(rootId)) {
      groups.set(rootId, []);
      order.push(rootId);
    }
    groups.get(rootId).push(message);
  }

  return order.map((rootId) => ({ rootId, messages: groups.get(rootId) }));
}
