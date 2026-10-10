// Mock stateful en memoria de session_messages -- mismo patrón que
// services/__mocks__/runner-session-mock.js. No reimplementa la regla de
// visibilidad del backend real de forma completa (no hace falta para probar
// contra mocks en un solo dispositivo): devuelve todos los mensajes de la
// sesión tal cual se crearon, sin filtrar por destinatario. Suficiente para
// ver tus propios mensajes enviados y los que vos mismo recibís como "todos".
let nextMessageId = 1;
const messagesBySession = new Map(); // sessionInstanceId (number) -> array de DTOs

export function __resetSessionMessagesMock() {
  messagesBySession.clear();
  nextMessageId = 1;
}

function listFor(sessionInstanceId) {
  const key = Number(sessionInstanceId);
  if (!messagesBySession.has(key)) messagesBySession.set(key, []);
  return messagesBySession.get(key);
}

export async function mockCreateSessionMessage(sessionInstanceId, body) {
  const row = {
    id: nextMessageId++,
    session_instance_id: Number(sessionInstanceId),
    sender_user_id: body.sender_user_id ?? 0,
    sender_role: body.sender_role ?? 'runner',
    type: body.type,
    recipient_mode: body.recipient_mode,
    recipient_user_ids: body.recipient_user_ids ?? [],
    body: body.body,
    reply_to_message_id: body.reply_to_message_id ?? null,
    created_at: new Date().toISOString(),
  };
  listFor(sessionInstanceId).push(row);
  return row;
}

export async function mockGetSessionMessages(sessionInstanceId, since) {
  const sinceId = since ? Number(since) : 0;
  const rows = listFor(sessionInstanceId).filter((r) => r.id > sinceId);
  return { messages: rows };
}
