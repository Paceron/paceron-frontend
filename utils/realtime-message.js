// Sobre de mensaje del bus de tiempo real genérico (spec 2026-09-28). `from`
// nunca lo pone el cliente -- lo pisa el servidor siempre -- así que
// buildMessage ni lo acepta como input.
export function buildMessage({ channel, type, event, to, payload }) {
  const msg = { channel, type, ts: Date.now() };
  if (event !== undefined) msg.event = event;
  if (to !== undefined) msg.to = to;
  if (payload !== undefined) msg.payload = payload;
  return msg;
}

export function parseMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (typeof parsed.type !== 'string') return null;
  return parsed;
}

// wss://host/api/v1/ws (o ws:// para desarrollo local sobre http) a partir de
// EXPO_PUBLIC_API_URL / el default remoto -- ver config/env.js#API_BASE_URL.
// El gateway vive bajo el mismo prefijo que el resto de la API (Gap 18,
// confirmado con backend 2026-09-29) -- no en la raíz. Preserva el path del
// base URL (típicamente /api/v1) y le agrega /ws, sin importar si el base
// URL trae barra final o no.
export function buildWsUrl(apiBaseUrl) {
  const url = new URL(apiBaseUrl);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const basePath = url.pathname.replace(/\/+$/, ''); // sin barra final
  return `${wsProtocol}//${url.host}${basePath}/ws`;
}
