import { useCallback, useEffect, useRef, useState } from 'react';
import { connect, getStatus, off, on, onStatusChange, send as sendMessage, subscribe, unsubscribe } from '../services/realtime-client.js';

// Suscripción a un canal del bus de tiempo real genérico (spec 2026-09-28).
// El socket físico es un singleton compartido -- este hook solo administra
// la suscripción/desuscripción de ESTE canal en particular durante el ciclo
// de vida del componente que lo usa.
export function useRealtimeChannel(channel, { onMessage, enabled = true } = {}) {
  // Arranca en null (no "lo que el singleton tenía de antes") -- el
  // singleton persiste entre sesiones de la app (a propósito, ver spec), así
  // que sembrar con getStatus() acá podía mostrar por un instante el estado
  // de una sesión anterior. Se resincroniza con el valor real recién dentro
  // del efecto, después de conectar/suscribir ESTA instancia.
  const [status, setStatus] = useState(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !channel) {
      setStatus(null);
      return undefined;
    }
    connect();
    subscribe(channel);
    setStatus(getStatus());
    const handler = (msg) => onMessageRef.current?.(msg);
    on(channel, handler);
    const unsubscribeStatus = onStatusChange(setStatus);
    return () => {
      off(channel, handler);
      unsubscribe(channel);
      unsubscribeStatus();
    };
  }, [channel, enabled]);

  const send = useCallback(
    (type, payload, extra) => {
      if (!channel) return;
      sendMessage(channel, type, payload, extra);
    },
    [channel],
  );

  return { status, send };
}
