import { useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useTeam } from '../../hooks/use-teams.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useSessionMessages } from '../../hooks/use-session-messages.js';
import { deliveryFor, pickUndeliveredMessages } from '../../utils/session-message-delivery.js';
import { notifyAviso, notifyAlerta } from '../../utils/haptics.js';
import { playAlertSound } from '../../utils/session-alert-sound.js';
import { DeliverySeverityModal } from './session-messages-modal.jsx';

// Entrega de mensajes de sesión en vivo (toast/modal/haptics/sonido) a nivel
// de TODA la app, no solo dentro de trainer-session-live-screen.jsx /
// training-session-live-screen.jsx -- bug real reportado: un aviso/alerta
// solo se notaba si estabas parado justo en esa pantalla; navegar a otra
// vista DENTRO de la sesión (ej. el escáner de asistencia, que es una ruta
// aparte, no un modal) desmontaba el efecto de entrega al desmontar esa
// pantalla. Montado una sola vez en providers/app-providers.jsx -- vive
// mientras la pestaña/app esté abierta, sin importar qué pantalla esté
// activa. Sigue sin cubrir backgrounding real del celular (push nativo,
// fuera de alcance -- ver docs/BACKEND_API_GAPS.md Gap 27).
function SessionMessagesDeliveryContent({ sessionInstanceId, teamId, myUserId }) {
  const { team } = useTeam(teamId);
  const { members: rosterMembers } = useTeamRoster(teamId);
  const { messages, isLoading: messagesLoading } = useSessionMessages(sessionInstanceId);
  const trainerUserId = team?.ownerId ?? null;
  const otherMembers = rosterMembers.filter((m) => String(m.userId) !== String(myUserId));
  const trainerName = otherMembers.find((m) => String(m.userId) === String(trainerUserId))?.name ?? null;

  const deliveredMessageIdsRef = useRef(new Set());
  const messagesSeededRef = useRef(false);
  const [deliveryQueue, setDeliveryQueue] = useState([]);

  // Mismo criterio que antes vivía en cada pantalla: esperar a que el
  // primer fetch REAL resuelva (`!messagesLoading`) antes de sembrar, para
  // no tratar todo el historial como "nuevo" y reproducir cada alerta de la
  // sesión entera cada vez que esto se monta (ej. al abrir la app con una
  // sesión ya en curso).
  useEffect(() => {
    if (messagesLoading) return;
    if (!messagesSeededRef.current) {
      for (const message of messages) deliveredMessageIdsRef.current.add(message.id);
      messagesSeededRef.current = true;
      return;
    }
    const toDeliver = pickUndeliveredMessages(messages, deliveredMessageIdsRef.current, myUserId);
    if (toDeliver.length === 0) return;
    for (const message of toDeliver) {
      deliveredMessageIdsRef.current.add(message.id);
      const delivery = deliveryFor(message.type);
      const senderName = message.senderUserId === String(trainerUserId)
        ? (trainerName ?? 'Entrenador')
        : (otherMembers.find((m) => String(m.userId) === message.senderUserId)?.name ?? 'Corredor');
      if (delivery.toast) Toast.show({ type: 'info', text1: senderName, text2: message.body });
      if (delivery.modal) setDeliveryQueue((current) => [...current, message]);
      if (delivery.haptics === 'medium') notifyAviso();
      if (delivery.haptics === 'heavy') notifyAlerta();
      if (delivery.sound) playAlertSound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, messagesLoading, myUserId, trainerUserId, trainerName]);

  return (
    <DeliverySeverityModal
      idPrefix="session-messages-delivery-modal"
      message={deliveryQueue[0] ?? null}
      onClose={() => setDeliveryQueue((q) => q.slice(1))}
      visible={deliveryQueue.length > 0}
    />
  );
}

export function SessionMessagesDelivery() {
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const myUserId = useAuthStore((s) => s.userId);
  const sessionInstanceId = pendingSession?.sessionInstance?.id ?? null;
  const teamId = pendingSession?.teamId ?? null;

  if (!sessionInstanceId || !myUserId) return null;
  return <SessionMessagesDeliveryContent myUserId={myUserId} sessionInstanceId={sessionInstanceId} teamId={teamId} />;
}
