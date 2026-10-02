import {
  PARTICIPANT_STATUS,
  initParticipants,
  applyParticipantMessage,
  applyRunnerStatus,
  displayStatus,
} from '../utils/trainer-participant-state.js';

const ROSTER = [
  { userId: '12', name: 'Juan Pérez', photoUrl: 'https://x/12.jpg' },
  { userId: '13', name: 'Ana Gómez', photoUrl: null },
];

const EXERCISES = [
  { id: 500, name: 'Caminata', repeatCount: 1 },
  { id: 501, name: 'Sentadillas', repeatCount: 2 },
];

describe('initParticipants', () => {
  test('un participante por miembro del roster, todos not_joined', () => {
    const participants = initParticipants(ROSTER);
    expect(participants.size).toBe(2);
    expect(participants.get('12')).toEqual({
      userId: '12',
      name: 'Juan Pérez',
      photoUrl: 'https://x/12.jpg',
      joined: false,
      status: PARTICIPANT_STATUS.NOT_JOINED,
      runnerStatus: null,
      position: null,
      resolvedSetCount: 0,
      currentExerciseName: null,
      currentSetNumber: null,
    });
  });
});

describe('applyParticipantMessage', () => {
  test('presence joined marca joined=true y pasa a connected (todavía no arrancó ninguna serie)', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'joined', payload: {}, from: 12 };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('12').joined).toBe(true);
    expect(next.get('12').status).toBe(PARTICIPANT_STATUS.CONNECTED);
    // No muta el mapa original
    expect(initial.get('12').joined).toBe(false);
  });

  test('presence left marca joined=false sin tocar el status', () => {
    const initial = initParticipants(ROSTER);
    const joined = applyParticipantMessage(initial, { type: 'presence', event: 'joined', payload: {}, from: 12 }, EXERCISES);
    const left = applyParticipantMessage(joined, { type: 'presence', event: 'left', payload: {}, from: 12 }, EXERCISES);
    expect(left.get('12').joined).toBe(false);
    expect(left.get('12').status).toBe(PARTICIPANT_STATUS.CONNECTED);
  });

  test('presence position actualiza la posición', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'position', payload: { latitude: -34.6, longitude: -58.4 }, ts: 1000, from: 13 };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('13').position).toEqual({ latitude: -34.6, longitude: -58.4, ts: 1000 });
  });

  // El entrenador puede entrar al canal DESPUÉS de que el corredor ya mandó
  // su único `joined` (broadcast efímero, nadie lo repite) -- sin esto, un
  // corredor que llegó antes queda "No se unió" para siempre pese a que sus
  // posiciones/series sí llegan (bug real, 2026-10-03).
  test('position de alguien que nunca mandó joined explícito -- igual lo marca conectado', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'position', payload: { latitude: -34.6, longitude: -58.4 }, from: 13 };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('13').joined).toBe(true);
    expect(next.get('13').status).toBe(PARTICIPANT_STATUS.CONNECTED);
  });

  test('set_status de alguien que nunca mandó joined explícito -- igual lo marca conectado', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'set_status', payload: { status: 'started', exerciseInstanceId: 500, exerciseName: 'Caminata', setNumber: 1 }, from: 13 };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('13').joined).toBe(true);
    expect(next.get('13').status).toBe(PARTICIPANT_STATUS.IN_PROGRESS);
  });

  test('set_status started -> in_progress con exercise/set actual, paused -> paused sin perderlo', () => {
    const initial = initParticipants(ROSTER);
    const started = applyParticipantMessage(initial, { type: 'presence', event: 'set_status', payload: { setId: 1, status: 'started', exerciseInstanceId: 500, exerciseName: 'Caminata', setNumber: 1 }, from: 12 }, EXERCISES);
    expect(started.get('12').status).toBe(PARTICIPANT_STATUS.IN_PROGRESS);
    expect(started.get('12').currentExerciseName).toBe('Caminata');
    expect(started.get('12').currentSetNumber).toBe(1);
    const paused = applyParticipantMessage(started, { type: 'presence', event: 'set_status', payload: { setId: 1, status: 'paused' }, from: 12 }, EXERCISES);
    expect(paused.get('12').status).toBe(PARTICIPANT_STATUS.PAUSED);
    // paused no manda exerciseName/setNumber de nuevo -- se conserva lo último sabido
    expect(paused.get('12').currentExerciseName).toBe('Caminata');
    expect(paused.get('12').currentSetNumber).toBe(1);
  });

  test('set_status finished suma 1 al resolvedSetCount, completa si llega al total', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { setId: 1, status: 'finished' }, from: '12' }, EXERCISES);
    expect(participants.get('12').resolvedSetCount).toBe(1);
    expect(participants.get('12').status).toBe(PARTICIPANT_STATUS.IN_PROGRESS);
    // total de la sesión es 1 (Caminata) + 2 (Sentadillas) = 3 -- todavía no completó
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { setId: 2, status: 'finished' }, from: '12' }, EXERCISES);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { setId: 3, status: 'skipped' }, from: '12' }, EXERCISES);
    expect(participants.get('12').resolvedSetCount).toBe(3);
    expect(participants.get('12').status).toBe(PARTICIPANT_STATUS.COMPLETED);
  });

  test('set_status scope exercise suma TODAS las series de ese ejercicio de una vez', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'set_status', payload: { exerciseInstanceId: 501, status: 'skipped', scope: 'exercise' }, from: 13 };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('13').resolvedSetCount).toBe(2);
  });

  test('mensaje sin from -- devuelve el mapa sin cambios', () => {
    const initial = initParticipants(ROSTER);
    const next = applyParticipantMessage(initial, { type: 'presence', event: 'joined', payload: {} }, EXERCISES);
    expect(next).toBe(initial);
  });

  test('from de alguien fuera del roster -- se ignora (no agrega entradas nuevas)', () => {
    const initial = initParticipants(ROSTER);
    const next = applyParticipantMessage(initial, { type: 'presence', event: 'joined', payload: {}, from: 999 }, EXERCISES);
    expect(next.size).toBe(2);
  });

  test('mensaje que no es type presence -- devuelve el mapa sin cambios', () => {
    const initial = initParticipants(ROSTER);
    const next = applyParticipantMessage(initial, { type: 'control', event: 'session_finished', from: 12 }, EXERCISES);
    expect(next).toBe(initial);
  });
});

describe('displayStatus', () => {
  test('not_joined -- se muestra tal cual, no "desconectado"', () => {
    const initial = initParticipants(ROSTER);
    expect(displayStatus(initial.get('12'))).toBe(PARTICIPANT_STATUS.NOT_JOINED);
  });

  test('se unió y se fue sin arrancar nada -- desconectado', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'joined', payload: {}, from: 12 }, EXERCISES);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'left', payload: {}, from: 12 }, EXERCISES);
    expect(displayStatus(participants.get('12'))).toBe(PARTICIPANT_STATUS.DISCONNECTED);
  });

  test('se fue a mitad de una serie en curso -- desconectado, no "en curso"', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { status: 'started', exerciseInstanceId: 500, exerciseName: 'Caminata', setNumber: 1 }, from: 12 }, EXERCISES);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'left', payload: {}, from: 12 }, EXERCISES);
    expect(displayStatus(participants.get('12'))).toBe(PARTICIPANT_STATUS.DISCONNECTED);
  });

  test('completó todo y se fue -- sigue mostrando "completó todo", no desconectado', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { exerciseInstanceId: 500, status: 'skipped', scope: 'exercise' }, from: 13 }, EXERCISES);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { exerciseInstanceId: 501, status: 'skipped', scope: 'exercise' }, from: 13 }, EXERCISES);
    expect(participants.get('13').status).toBe(PARTICIPANT_STATUS.COMPLETED);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'left', payload: {}, from: 13 }, EXERCISES);
    expect(displayStatus(participants.get('13'))).toBe(PARTICIPANT_STATUS.COMPLETED);
  });

  test('todavía unido -- se muestra el status real sin importar cuál sea', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'joined', payload: {}, from: 12 }, EXERCISES);
    expect(displayStatus(participants.get('12'))).toBe(PARTICIPANT_STATUS.CONNECTED);
  });

  // Gap 19: runnerStatus (REST, autoritativo) manda por encima de lo que el
  // stream de WS haya inferido -- un corredor que canceló a mitad de camino
  // (última serie nunca completada/salteada) no debe mostrarse como
  // "Completó todo" solo porque resolvedSetCount llegó al total por error.
  test('runnerStatus interrupted manda por encima de in_progress', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { status: 'started', exerciseInstanceId: 500, exerciseName: 'Caminata', setNumber: 1 }, from: 12 }, EXERCISES);
    participants = applyRunnerStatus(participants, '12', 'interrupted');
    expect(displayStatus(participants.get('12'))).toBe(PARTICIPANT_STATUS.INTERRUPTED);
  });

  test('runnerStatus interrupted manda incluso si el reducer de WS ya lo había marcado COMPLETED por error', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { exerciseInstanceId: 500, status: 'skipped', scope: 'exercise' }, from: 13 }, EXERCISES);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { exerciseInstanceId: 501, status: 'skipped', scope: 'exercise' }, from: 13 }, EXERCISES);
    expect(participants.get('13').status).toBe(PARTICIPANT_STATUS.COMPLETED);
    participants = applyRunnerStatus(participants, '13', 'interrupted');
    expect(displayStatus(participants.get('13'))).toBe(PARTICIPANT_STATUS.INTERRUPTED);
  });

  test('runnerStatus finished manda COMPLETED incluso si joined volvió a false', () => {
    let participants = initParticipants(ROSTER);
    participants = applyRunnerStatus(participants, '12', 'finished');
    expect(displayStatus(participants.get('12'))).toBe(PARTICIPANT_STATUS.COMPLETED);
  });

  test('runnerStatus wip o null -- no cambia el comportamiento previo', () => {
    let participants = initParticipants(ROSTER);
    participants = applyRunnerStatus(participants, '12', 'wip');
    expect(displayStatus(participants.get('12'))).toBe(PARTICIPANT_STATUS.NOT_JOINED);
  });
});

describe('applyRunnerStatus', () => {
  test('setea runnerStatus del participante indicado', () => {
    const initial = initParticipants(ROSTER);
    const next = applyRunnerStatus(initial, '12', 'finished');
    expect(next.get('12').runnerStatus).toBe('finished');
    expect(initial.get('12').runnerStatus).toBeNull();
  });

  test('mismo valor -- devuelve el mismo mapa (identidad, sin re-render de más)', () => {
    const initial = initParticipants(ROSTER);
    const once = applyRunnerStatus(initial, '12', 'wip');
    const twice = applyRunnerStatus(once, '12', 'wip');
    expect(twice).toBe(once);
  });

  test('userId fuera del roster -- devuelve el mismo mapa sin agregar entradas', () => {
    const initial = initParticipants(ROSTER);
    const next = applyRunnerStatus(initial, '999', 'finished');
    expect(next).toBe(initial);
    expect(next.size).toBe(2);
  });
});
