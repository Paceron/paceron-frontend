import { useCallback, useEffect, useRef, useState } from 'react';
import { connect, getStatus, off, offSubscribed, on, onStatusChange, onSubscribed as onSubscribedAck, send as sendMessage, subscribe, unsubscribe } from '../services/realtime-client.js';

// Suscripción a un canal del bus de tiempo real genérico (spec 2026-09-28).
// El socket físico es un singleton compartido -- este hook solo administra
// la suscripción/desuscripción de ESTE canal en particular durante el ciclo
// de vida del componente que lo usa.
export function useRealtimeChannel(channel, { onMessage, enabled = true, onSubscribed, onBeforeUnsubscribe } = {}) {
  // Arranca en null (no "lo que el singleton tenía de antes") -- el
  // singleton persiste entre sesiones de la app (a propósito, ver spec), así
  // que sembrar con getStatus() acá podía mostrar por un instante el estado
  // de una sesión anterior. Se resincroniza con el valor real recién dentro
  // del efecto, después de conectar/suscribir ESTA instancia.
  const [status, setStatus] = useState(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onSubscribedRef = useRef(onSubscribed);
  onSubscribedRef.current = onSubscribed;
  const onBeforeUnsubscribeRef = useRef(onBeforeUnsubscribe);
  onBeforeUnsubscribeRef.current = onBeforeUnsubscribe;

  useEffect(() => {
    if (!enabled || !channel) {
      setStatus(null);
      return undefined;
    }
    connect();
    // onSubscribed (el callback del caller, ej. anunciar presence:joined) NO
    // se dispara acá sincrónico -- se espera el ACK real del servidor
    // (`{"type":"subscribed"}`). Antes se llamaba apenas se pedía la
    // suscripción, sin importar si el socket ya estaba abierto: en una
    // conexión fría (la primera del proceso), el socket sigue en CONNECTING
    // en este punto y el envío de "joined" se descartaba en silencio (sin
    // cola -- `send()` es efímero por diseño). El otro lado nunca se enteraba
    // de que alguien se había unido (bug real, 2026-10-01). El ACK también
    // llega de nuevo en cada reconexión (resubscribe), así que esto además
    // re-anuncia "joined" después de una caída de conexión, que es lo
    // correcto (el servidor limpia las suscripciones viejas al desconectar).
    const handleAck = () => onSubscribedRef.current?.();
    onSubscribedAck(channel, handleAck);
    subscribe(channel);
    setStatus(getStatus());
    const handler = (msg) => onMessageRef.current?.(msg);
    on(channel, handler);
    const unsubscribeStatus = onStatusChange(setStatus);
    return () => {
      onBeforeUnsubscribeRef.current?.();
      off(channel, handler);
      offSubscribed(channel, handleAck);
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
