import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockCreateSessionMessage, mockGetSessionMessages } from './__mocks__/session-messages-mock.js';

// Mensajería en sesión presencial en vivo (Gap 27, docs/BACKEND_API_GAPS.md).
// El POST responde el mensaje creado DIRECTO en el body -- sin envoltorio
// `{data: ...}`, a diferencia de runnerSession.js. El GET sí envuelve, en
// `{messages: [...]}`, nunca un array crudo. Ambos confirmados contra el
// contrato real desplegado, no son una suposición.
const messagesPath = (sessionInstanceId) => `/session-instances/${Number(sessionInstanceId)}/messages`;

// POST /api/v1/session-instances/:id/messages -- 201 con el mensaje creado.
// `body` ya viene en snake_case (armado por toSessionMessagePayload en el caller).
export async function createSessionMessage(sessionInstanceId, body) {
  if (USE_MOCKS) return await mockCreateSessionMessage(sessionInstanceId, body);
  return await api.post(messagesPath(sessionInstanceId), body);
}

// GET /api/v1/session-instances/:id/messages?since=<id> -- el backend ya
// filtra por visibilidad (emisor, recipient_mode='all', o mi userId en
// recipient_user_ids); el frontend no vuelve a filtrar nada. Sin `since` (o
// `0`/null) trae todo el historial visible de la sesión.
export async function getSessionMessages(sessionInstanceId, since) {
  const query = since ? `?since=${Number(since)}` : '';
  if (USE_MOCKS) return await mockGetSessionMessages(sessionInstanceId, since);
  return await api.get(`${messagesPath(sessionInstanceId)}${query}`);
}
