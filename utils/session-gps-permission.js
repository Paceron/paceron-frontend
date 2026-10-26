import * as Location from 'expo-location';
import { logDebug } from './debug-log.js';

// Pide el permiso de ubicación foreground, con el mismo logging/guard de
// error en los dos callers reales de hoy (session-pre-start-screen.jsx y
// route-attempt-pre-start-screen.jsx) -- vivía inline y duplicado en
// potencia en el primero; con un 2do caller real la duplicación deja de
// ser hipotética. `logPrefix` solo cambia el texto del log, para poder
// distinguir de qué pantalla salió al grepear Metro.
export async function requestSessionGpsPermission(logPrefix = '[pre-start]') {
  const startedAt = Date.now();
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    logDebug(`${logPrefix} permiso GPS resuelto (${Date.now() - startedAt}ms) granted=${permission.granted}`);
    return Boolean(permission.granted);
  } catch (error) {
    logDebug(`${logPrefix} GPS ERROR (${Date.now() - startedAt}ms): ${error.message}`);
    return false;
  }
}
