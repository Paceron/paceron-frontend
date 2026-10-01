import {
  PARTICIPANT_STATUS,
  initParticipants,
  applyParticipantMessage,
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
