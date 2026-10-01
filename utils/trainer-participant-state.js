import { countSetsForExercise, totalSetsForSession } from './trainer-participant-progress.js';

// Estado por participante que ve la pantalla en vivo del entrenador,
// reconstruido PURAMENTE a partir del stream de mensajes WS -- el entrenador
// no tiene SQLite propio de otro atleta, así que esto es la única fuente de
// verdad mientras la pantalla está montada (el bootstrap por REST, Task 7,
// llena resolvedSetCount al abrir; de ahí en más este reducer sigue solo).
export const PARTICIPANT_STATUS = {
  NOT_JOINED: 'not_joined',
  // Se unió al canal pero todavía no arrancó ninguna serie (recién entró, o
  // está entre series) -- antes esto se mostraba igual que IN_PROGRESS ("En
  // curso"), confundiendo "está conectado" con "está corriendo ahora mismo".
  CONNECTED: 'connected',
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
    // Último ejercicio/serie conocido -- solo tiene sentido mientras
    // IN_PROGRESS/PAUSED (ver UI); null el resto del tiempo.
    currentExerciseName: null,
    currentSetNumber: null,
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
      status: current.status === PARTICIPANT_STATUS.NOT_JOINED ? PARTICIPANT_STATUS.CONNECTED : current.status,
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
    // exerciseName/setNumber viajan desde Task del corredor que enriquece
    // broadcastSetStatus (use-live-session-runtime.js) -- antes solo mandaba
    // un `setId` local (un id de SQLite del corredor, sin significado acá), y
    // el entrenador no tenía forma de mostrar QUÉ está hacienda cada uno.
    const { status, scope, exerciseInstanceId, exerciseName, setNumber } = msg.payload ?? {};
    const addedSets = scope === 'exercise' ? countSetsForExercise(exercises, exerciseInstanceId) : (status === 'finished' || status === 'skipped') ? 1 : 0;
    const resolvedSetCount = current.resolvedSetCount + addedSets;
    const total = totalSetsForSession(exercises);

    let nextStatus = current.status;
    let currentExerciseName = current.currentExerciseName;
    let currentSetNumber = current.currentSetNumber;
    if (status === 'started') {
      nextStatus = PARTICIPANT_STATUS.IN_PROGRESS;
      currentExerciseName = exerciseName ?? current.currentExerciseName;
      currentSetNumber = setNumber ?? current.currentSetNumber;
    } else if (status === 'paused') {
      nextStatus = PARTICIPANT_STATUS.PAUSED;
      // mantiene currentExerciseName/currentSetNumber -- sigue siendo lo
      // último que estaba haciendo, solo cambia el estado.
    } else if (addedSets > 0) {
      nextStatus = total > 0 && resolvedSetCount >= total ? PARTICIPANT_STATUS.COMPLETED : PARTICIPANT_STATUS.IN_PROGRESS;
      // finished/skipped: esa serie ya no es "lo que está haciendo ahora" --
      // se limpia hasta que llegue el próximo `started`, para no mostrar la
      // serie anterior como si siguiera en curso en el hueco entre series.
      currentExerciseName = null;
      currentSetNumber = null;
    }

    next.set(userId, { ...current, resolvedSetCount, status: nextStatus, currentExerciseName, currentSetNumber });
    return next;
  }

  return participants;
}
