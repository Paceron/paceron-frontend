// Qué dispara cada tipo de mensaje de sesión en vivo (Gap 27) -- función pura
// para no hardcodear el mapeo inline en el modal, así se puede testear sin
// montar nada (ver spec, sección "Entrega por severidad").
export function deliveryFor(type) {
  if (type === 'aviso') return { toast: false, modal: true, haptics: 'medium', sound: false };
  if (type === 'alerta') return { toast: false, modal: true, haptics: 'heavy', sound: true };
  // 'info' y cualquier valor desconocido caen al comportamiento más simple --
  // nunca bloquear la pantalla por un tipo que no se reconoce.
  return { toast: true, modal: false, haptics: null, sound: false };
}

// Filtra, de la lista COMPLETA de mensajes ya visibles para mí (el backend ya
// aplicó la regla de privacidad), los que todavía no se "entregaron"
// (toast/modal/haptics/sonido) y que no son míos -- un mensaje propio no se
// entrega a mí mismo, ya lo vi al escribirlo. `deliveredIds` es un Set de
// strings (los `id` ya normalizados a string por toSessionMessageModel). No
// muta `deliveredIds` -- el caller decide cuándo marcar como entregado.
export function pickUndeliveredMessages(messages, deliveredIds, selfUserId) {
  const self = String(selfUserId);
  return (messages ?? []).filter((msg) => !deliveredIds.has(msg.id) && msg.senderUserId !== self);
}
