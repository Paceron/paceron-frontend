import { countSetsForExercise, totalSetsForSession } from './trainer-participant-progress.js';

// Estado por participante que ve la pantalla en vivo del entrenador,
// reconstruido PURAMENTE a partir del stream de mensajes WS -- el entrenador
// no tiene SQLite propio de otro atleta, así que esto es la única fuente de
// verdad mientras la pantalla está montada (el bootstrap por REST, Task 7,
// llena resolvedSetCount al abrir; de ahí en más este reducer sigue solo).
export const PARTICIPANT_STATUS = {
  NOT_JOINED: 'not_joined',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

function emptyParticipant(userId, member) {
  return {
    userId,
    name: member?.name ?? null,
    photoUrl: member?.photoUrl ?? null,
    joined: false,
    status: PARTICIPANT_STATUS.NOT_JOINED,
    position: null,
    resolvedSetCount: 0,
  };
}

// `rosterMembers` -- mismo shape que useTeamRoster().members (Task 5: userId
// ya viene como string ahí). Un participante por miembro, todos "sin unirse".
export function initParticipants(rosterMembers) {
  const map = new Map();
  for (const member of rosterMembers ?? []) {
    map.set(String(member.userId), emptyParticipant(String(member.userId), member));
  }
  return map;
}

// Nunca muta `participants` -- devuelve el MISMO mapa (misma referencia) si el
// mensaje no aporta nada nuevo (no es `presence`, no trae `from.userId`, o ese
// userId no está en el roster), para que el caller pueda comparar por
// identidad y evitar un re-render de más.
export function applyParticipantMessage(participants, msg, exercises) {
  if (msg?.type !== 'presence') return participants;
  // `from` es el userID emisor, un número plano puesto por el servidor --
  // NUNCA un objeto `{userId}` (Gap 20, confirmado contra
  // cmd/api/realtime/protocol.go#outboundMessage y docs/REALTIME_WS.md del
  // backend: `{"type":"presence","from":12,"payload":{...}}`). Asumir
  // `msg.from.userId` dejaba este reducer sin atribuir NINGÚN mensaje a
  // nadie -- el bug real detrás de "No se unió" para un corredor que sí
  // estaba en vivo.
  const userId = msg.from != null ? String(msg.from) : null;
  if (!userId) return participants;

  const current = participants.get(userId);
  if (!current) return participants; // alguien fuera del roster de esta sesión -- se ignora

  const next = new Map(participants);

  if (msg.event === 'joined') {
    next.set(userId, {
      ...current,
      joined: true,
      status: current.status === PARTICIPANT_STATUS.NOT_JOINED ? PARTICIPANT_STATUS.IN_PROGRESS : current.status,
    });
    return next;
  }

  if (msg.event === 'left') {
    next.set(userId, { ...current, joined: false });
    return next;
  }

  if (msg.event === 'position') {
    next.set(userId, {
      ...current,
      position: { latitude: msg.payload?.latitude, longitude: msg.payload?.longitude, ts: msg.ts ?? Date.now() },
    });
    return next;
  }

  if (msg.event === 'set_status') {
    const { status, scope, exerciseInstanceId } = msg.payload ?? {};
    const addedSets = scope === 'exercise' ? countSetsForExercise(exercises, exerciseInstanceId) : (status === 'finished' || status === 'skipped') ? 1 : 0;
    const resolvedSetCount = current.resolvedSetCount + addedSets;
    const total = totalSetsForSession(exercises);

    let nextStatus = current.status;
    if (status === 'started') nextStatus = PARTICIPANT_STATUS.IN_PROGRESS;
    else if (status === 'paused') nextStatus = PARTICIPANT_STATUS.PAUSED;
    else if (addedSets > 0) nextStatus = total > 0 && resolvedSetCount >= total ? PARTICIPANT_STATUS.COMPLETED : PARTICIPANT_STATUS.IN_PROGRESS;

    next.set(userId, { ...current, resolvedSetCount, status: nextStatus });
    return next;
  }

  return participants;
}
