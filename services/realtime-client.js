import { API_BASE_URL } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';
import { buildMessage, buildWsUrl, parseMessage } from '../utils/realtime-message.js';
import { computeBackoffMs } from '../utils/realtime-backoff.js';

// Cliente WS genérico, singleton a nivel módulo (spec 2026-09-28) -- un solo
// socket físico multiplexado por canales. Pensado para reusarse más allá de
// esta feature (notificaciones en vivo, etc.), no hardcodeado a sesiones.
const HEARTBEAT_MS = 25000;

let socket = null;
let status = 'closed';
const statusListeners = new Set();
const channelListeners = new Map(); // channel -> Set<callback>
const subscribedChannels = new Set();
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
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function dispatchMessage(raw) {
  const msg = parseMessage(raw);
  if (!msg || msg.type === 'pong') return;
  const listeners = channelListeners.get(msg.channel);
  if (!listeners) return;
  for (const listener of listeners) listener(msg);
}

export function connect() {
  if (socket && (socket.readyState === 0 || socket.readyState === 1)) return; // ya conectando/abierto
  explicitlyClosed = false;
  const { token } = useAuthStore.getState();
  const url = `${buildWsUrl(API_BASE_URL)}?token=${encodeURIComponent(token ?? '')}`;
  setStatus(reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
  socket = new WebSocket(url);

  socket.onopen = () => {
    reconnectAttempt = 0;
    setStatus('open');
    startHeartbeat();
    for (const channel of subscribedChannels) {
      socket.send(JSON.stringify(buildMessage({ channel, type: 'subscribe' })));
    }
  };

  socket.onmessage = (event) => dispatchMessage(event.data);

  socket.onclose = () => {
    stopHeartbeat();
    if (explicitlyClosed) {
      setStatus('closed');
      return;
    }
    setStatus('reconnecting');
    scheduleReconnect();
  };

  socket.onerror = () => {
    // el cierre real llega por onclose -- acá no hace falta lógica propia
  };
}

export function disconnect() {
  explicitlyClosed = true;
  clearReconnectTimer();
  stopHeartbeat();
  if (socket) socket.close();
  socket = null;
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
  if (!socket || socket.readyState !== 1) return; // efímero -- sin cola, se descarta si no hay conexión
  socket.send(JSON.stringify(buildMessage({ channel, type, payload, ...extra })));
}

export function on(channel, callback) {
  if (!channelListeners.has(channel)) channelListeners.set(channel, new Set());
  channelListeners.get(channel).add(callback);
}

export function off(channel, callback) {
  channelListeners.get(channel)?.delete(callback);
}
