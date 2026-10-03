import { API_BASE_URL } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';
import { buildMessage, buildWsUrl, parseMessage } from '../utils/realtime-message.js';
import { computeBackoffMs } from '../utils/realtime-backoff.js';
import { logDebug } from '../utils/debug-log.js';

// Cliente WS genérico, singleton a nivel módulo (spec 2026-09-28) -- un solo
// socket físico multiplexado por canales. Pensado para reusarse más allá de
// esta feature (notificaciones en vivo, etc.), no hardcodeado a sesiones.
const HEARTBEAT_MS = 25000;

let socket = null;
// userId con el que se abrió el socket actual -- ver el guard de connect()
// de abajo (bug real, 2026-10-03: un corredor que cierra sesión e inicia
// sesión con OTRA cuenta, SIN cerrar la app, seguía viendo al entrenador el
// corredor anterior hasta forzar el cierre de la app).
let connectedUserId = null;
let status = 'closed';
const statusListeners = new Set();
const channelListeners = new Map(); // channel -> Set<callback>
// Listeners del ACK `subscribed` del servidor, por canal -- ver onSubscribed()
// más abajo para el porqué (evita la carrera de "joined" perdido).
const subscribeAckListeners = new Map();
const subscribedChannels = new Set();
// Canales para los que ya se logueó la primera `presence:position` recibida --
// solo diagnóstico (ver dispatchMessage): confirma que AL MENOS una posición
// llegó, sin inundar el log con una línea por cada punto de GPS.
const loggedFirstPosition = new Set();
let reconnectAttempt = 0;
let reconnectTimer = null;
let heartbeatTimer = null;
let explicitlyClosed = false;

function setStatus(next) {
  status = next;
  for (const listener of statusListeners) listener(status);
}

export function getStatus() {
  return status;
}

export function onStatusChange(callback) {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(buildMessage({ channel: undefined, type: 'ping' })));
  }, HEARTBEAT_MS);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  const delay = computeBackoffMs(reconnectAttempt);
  logDebug(`[realtime] scheduleReconnect intento=${reconnectAttempt} delayMs=${delay}`);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// El relay de presence/control del backend ARMA el frame saliente con SOLO
// {type, from, payload} (confirmado leyendo
// cmd/api/realtime/connection.go#apply: `&outboundMessage{Type: msg.Type,
// From: sc.userID, Payload: msg.Payload}`, sin `Channel` nunca) -- a
// diferencia de `update:set_event`, que sí lo incluye. Con un único canal
// activo por conexión (el caso real de esta app: una sesión en vivo a la
// vez), la lista de canales suscriptos tiene un solo elemento -- se usa como
// fallback cuando el servidor no mandó `channel`. Con más de un canal activo
// a la vez, un mensaje sin `channel` queda sin destino resoluble (se
// descarta, no se adivina a cuál de varios pertenece) -- no es el caso de
// hoy, pero que quede explícito para cuando se agregue multi-canal real.
function soleSubscribedChannel() {
  if (subscribedChannels.size !== 1) return undefined;
  return subscribedChannels.values().next().value;
}

function dispatchMessage(raw) {
  const msg = parseMessage(raw);
  if (!msg) return;
  if (msg.type === 'pong' || msg.type === 'unsubscribed') return;
  if (msg.type === 'subscribed') {
    // Confirmación real de que el canal quedó suscripto DEL LADO DEL SERVIDOR
    // -- la señal que onSubscribed()/use-realtime-channel.js esperan antes de
    // anunciar `presence:joined`. Sin esto, "joined" se mandaba apenas se
    // LLAMABA a connect()+subscribe() en el mismo tick, sin importar si el
    // socket ya estaba abierto -- en una conexión fría (la primera del
    // proceso), el socket todavía está en CONNECTING y `send()` descarta el
    // frame en silencio (sin cola, "efímero" por diseño). El corredor/
    // entrenador quedaba sin anunciar su propio join la primera vez que abría
    // la sesión, y el otro lado nunca lo mostraba en el mapa/lista de
    // participantes -- bug real, 2026-10-01.
    const ackListeners = subscribeAckListeners.get(msg.channel);
    if (ackListeners) for (const listener of ackListeners) listener();
    return;
  }
  // El backend nunca corta la conexión por un canal ajeno/malformado -- solo
  // manda este error suelto. Sin loguearlo, un subscribe rechazado queda
  // completamente invisible (el status sigue "open", nada avisa que la
  // suscripción en particular falló).
  if (msg.type === 'error') {
    logDebug(`[realtime] error del servidor: ${msg.message ?? '(sin mensaje)'}`);
    return;
  }
  // `event` viaja DENTRO de `payload` para presence/control -- ver el
  // comentario en send() más abajo para el porqué (se pierde en el relay si
  // viaja a nivel raíz). Se resuelve acá UNA vez y se re-expone como
  // `msg.event` (con el payload real sin el campo event mezclado) para que el
  // resto del código (reducers, logs) pueda seguir leyendo `msg.event` como
  // si fuera parte nativa del protocolo.
  let resolvedChannel = msg.channel;
  if ((msg.type === 'presence' || msg.type === 'control') && msg.payload && typeof msg.payload === 'object') {
    const { event, ...restPayload } = msg.payload;
    msg.event = event;
    msg.payload = restPayload;
    if (resolvedChannel == null) resolvedChannel = soleSubscribedChannel();
  }

  // Traza de diagnóstico para presence/control -- joined/left/set_status (poco
  // frecuentes) siempre; position (cada ~1s por corredor) solo la primera vez
  // por canal, para confirmar que llega AL MENOS una sin inundar el log.
  if (msg.type === 'presence' || msg.type === 'control') {
    if (msg.event !== 'position') {
      logDebug(`[realtime] recibido canal=${resolvedChannel} type=${msg.type} event=${msg.event} from=${msg.from}`);
    } else if (!loggedFirstPosition.has(resolvedChannel)) {
      loggedFirstPosition.add(resolvedChannel);
      logDebug(`[realtime] primera position recibida canal=${resolvedChannel} from=${msg.from}`);
    }
  }
  const listeners = channelListeners.get(resolvedChannel);
  if (!listeners) return;
  for (const listener of listeners) listener(msg);
}

export function connect() {
  const { token, userId } = useAuthStore.getState();
  if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
    if (connectedUserId === userId) return; // ya conectando/abierto, mismo usuario
    // El usuario cambió (logout -> login de otra cuenta) con el socket
    // todavía vivo -- sin esto, el socket viejo seguía mandando `presence`
    // como el usuario ANTERIOR para siempre (ningún reconnect espontáneo lo
    // iba a notar, el logout no cierra el socket por su cuenta). Se cierra
    // acá antes de abrir el nuevo, mismo criterio que un cambio de cuenta
    // real -- nada de lo que traía ese canal sigue siendo válido.
    logDebug(`[realtime] connect() con usuario distinto (${connectedUserId} -> ${userId}) -- cerrando socket viejo`);
    disconnect();
  }
  explicitlyClosed = false;
  connectedUserId = userId;
  const wsUrl = buildWsUrl(API_BASE_URL);
  const url = `${wsUrl}?token=${encodeURIComponent(token ?? '')}`;
  logDebug(`[realtime] connect() intento=${reconnectAttempt} url=${wsUrl} token=${token ? 'presente' : 'AUSENTE'}`);
  setStatus(reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
  socket = new WebSocket(url);

  socket.onopen = () => {
    logDebug('[realtime] onopen -- conexión abierta');
    reconnectAttempt = 0;
    setStatus('open');
    startHeartbeat();
    for (const channel of subscribedChannels) {
      socket.send(JSON.stringify(buildMessage({ channel, type: 'subscribe' })));
    }
  };

  socket.onmessage = (event) => dispatchMessage(event.data);

  socket.onclose = (event) => {
    logDebug(`[realtime] onclose code=${event?.code} reason=${event?.reason || '(sin razón)'} explicitlyClosed=${explicitlyClosed}`);
    stopHeartbeat();
    if (explicitlyClosed) {
      setStatus('closed');
      return;
    }
    setStatus('reconnecting');
    scheduleReconnect();
  };

  socket.onerror = (event) => {
    // El cierre real llega por onclose -- esto es solo para tener visibilidad
    // en los logs de por qué falló (ej. host inalcanzable, TLS, etc.).
    logDebug(`[realtime] onerror ${event?.message ?? '(sin detalle -- revisar onclose)'}`);
  };
}

export function disconnect() {
  explicitlyClosed = true;
  clearReconnectTimer();
  stopHeartbeat();
  if (socket) socket.close();
  socket = null;
  connectedUserId = null;
  setStatus('closed');
}

export function subscribe(channel) {
  subscribedChannels.add(channel);
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify(buildMessage({ channel, type: 'subscribe' })));
  }
}

export function unsubscribe(channel) {
  subscribedChannels.delete(channel);
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify(buildMessage({ channel, type: 'unsubscribe' })));
  }
}

export function send(channel, type, payload, extra = {}) {
  if (!socket || socket.readyState !== 1) {
    // Antes se descartaba en total silencio -- diagnóstico del bug de
    // 2026-10-01 (presence:joined perdido en conexión fría) recién fue posible
    // después de agregar esta línea. event !== 'position' para no inundar si
    // esto empieza a pasar seguido con el GPS continuo.
    if (extra?.event !== 'position') {
      logDebug(`[realtime] send() DESCARTADO (socket no abierto) canal=${channel} type=${type} event=${extra?.event}`);
    }
    return; // efímero -- sin cola, se descarta si no hay conexión
  }
  // `event` (y `ts`) viajaban a nivel raíz del frame -- confirmado leyendo
  // cmd/api/realtime/protocol.go#clientMessage (backend) que SOLO decodifica
  // `type`/`channel`/`payload`; cualquier otro campo de nivel raíz lo
  // descarta el propio json.Unmarshal de Go al ingresar, y ADEMÁS el relay
  // server→cliente arma el frame saliente con solo {type, from, payload}
  // (connection.go#apply) -- `event` nunca sobrevivía el viaje de ida y
  // vuelta. `payload` es el ÚNICO campo opaco que el backend retransmite
  // intacto, así que `event` tiene que viajar ADENTRO de él. Bug real,
  // 2026-10-02: "No se unió" persistía para TODOS los corredores incluso
  // después de corregir el parseo de `from` -- el mensaje nunca traía nada
  // de información del otro lado en absoluto.
  const realPayload = payload ?? extra.payload;
  const wirePayload = extra.event !== undefined ? { event: extra.event, ...(realPayload ?? {}) } : realPayload;
  if (extra?.event !== 'position') {
    logDebug(`[realtime] send() canal=${channel} type=${type} event=${extra?.event}`);
  }
  socket.send(JSON.stringify(buildMessage({ channel, type, payload: wirePayload, to: extra.to })));
}

export function on(channel, callback) {
  if (!channelListeners.has(channel)) channelListeners.set(channel, new Set());
  channelListeners.get(channel).add(callback);
}

export function off(channel, callback) {
  channelListeners.get(channel)?.delete(callback);
}

// Avisa cuando el servidor confirma (`{"type":"subscribed"}`) que ESTE canal
// quedó suscripto -- dispara también en cada resubscribe (el backend responde
// `subscribed` de nuevo cada vez, incluso idempotente), que es justo lo que
// hace falta para re-anunciar `presence:joined` después de una reconexión
// (el servidor limpia las suscripciones viejas al caer la conexión).
export function onSubscribed(channel, callback) {
  if (!subscribeAckListeners.has(channel)) subscribeAckListeners.set(channel, new Set());
  subscribeAckListeners.get(channel).add(callback);
}

export function offSubscribed(channel, callback) {
  subscribeAckListeners.get(channel)?.delete(callback);
}
