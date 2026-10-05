// Ring buffer de debug para el registro en vivo — permite leer el estado de
// la sesión en un panel on-device (dev-only) en vez de depender de logcat o
// del inspector. Solo para diagnóstico; sin coste en release (no-op del
// console.log fuera de __DEV__ deja el buffer igual, útil si se quiere dumpiar
// por otra vía).
import { useAuthStore } from '../store/auth-store.js';

const MAX_LINES = 300;

const logLines = [];

function formatValue(value) {
  if (value instanceof Error) return `Error: ${value.message}`;
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// Rol activo con el que corre el dispositivo que emite esta línea -- a pedido
// del usuario, para distinguir de un vistazo los bloques de log pegados desde
// dos dispositivos distintos (entrenador supervisando + corredor en vivo) sin
// tener que threadear el rol a mano por cada call site.
export function logDebug(...args) {
  const line = args.map(formatValue).join(' ');
  const role = useAuthStore.getState().activeRole ?? '?';
  const taggedLine = `[${role}] ${line}`;
  const stamp = new Date().toISOString().slice(11, 23);
  const stamped = `[${stamp}] ${taggedLine}`;
  logLines.push(stamped);
  if (logLines.length > MAX_LINES) logLines.splice(0, logLines.length - MAX_LINES);
  if (__DEV__) console.log('[sesion]', taggedLine);
  return stamped;
}

export function getLogLines() {
  return [...logLines];
}

export function clearLog() {
  logLines.length = 0;
}