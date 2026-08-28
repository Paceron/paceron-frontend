// Catálogo de sesiones del entrenador — una sesión arma los 3 bloques
// fijos (warmup/main/cooldown) referenciando ejercicios ya creados
// (exercises-mock.js), no construyéndolos de cero. `main_repeat_count`/
// `main_rest_minutes` envuelven el ejercicio del bloque principal — es lo
// que antes era `main.kind === 'set'` en el schema original, ahora es una
// propiedad de la sesión (cualquier ejercicio del bloque principal puede
// repetirse N veces con descanso, no hace falta un "kind" de ejercicio
// aparte para eso). repeatCount 1 + restMinutes 0 = "una sola vez".
function buildSeedSessions() {
  const now = new Date().toISOString();
  return [
    {
      id: 1, owner_id: 1, name: 'Fondo suave', description: 'Trote continuo a ritmo conversable.',
      warmup_exercise_id: 1, main_exercise_id: 2, main_repeat_count: 1, main_rest_minutes: 0, cooldown_exercise_id: 3,
      created_at: now, updated_at: now,
    },
    {
      id: 2, owner_id: 1, name: 'Series de velocidad', description: 'Intervalos cortos a ritmo fuerte, con descanso entre cada uno.',
      warmup_exercise_id: 1, main_exercise_id: 5, main_repeat_count: 4, main_rest_minutes: 2, cooldown_exercise_id: 3,
      created_at: now, updated_at: now,
    },
    {
      id: 3, owner_id: 1, name: 'Rodaje largo', description: 'Ritmo continuo sostenido, la sesión más larga de la semana.',
      warmup_exercise_id: 1, main_exercise_id: 4, main_repeat_count: 1, main_rest_minutes: 0, cooldown_exercise_id: 3,
      created_at: now, updated_at: now,
    },
  ];
}

let mockSessions = buildSeedSessions();
let nextId = 4;

function findSessionOrThrow(sessionId) {
  const session = mockSessions.find((s) => String(s.id) === String(sessionId));
  if (!session) {
    const error = new Error('Sesión no encontrada.');
    error.status = 404;
    throw error;
  }
  return session;
}

export async function mockListSessions({ ownerId } = {}) {
  let result = mockSessions;
  if (ownerId != null) result = result.filter((s) => s.owner_id === Number(ownerId));
  return [...result];
}

export async function mockGetSession(sessionId) {
  return findSessionOrThrow(sessionId);
}

export async function mockCreateSession(payload) {
  const now = new Date().toISOString();
  const session = {
    id: nextId++,
    owner_id: payload.owner_id,
    name: payload.name,
    description: payload.description ?? null,
    warmup_exercise_id: payload.warmup_exercise_id,
    main_exercise_id: payload.main_exercise_id,
    main_repeat_count: payload.main_repeat_count ?? 1,
    main_rest_minutes: payload.main_rest_minutes ?? 0,
    cooldown_exercise_id: payload.cooldown_exercise_id,
    created_at: now,
    updated_at: now,
  };
  mockSessions.push(session);
  return session;
}

export async function mockUpdateSession(sessionId, updates) {
  const session = findSessionOrThrow(sessionId);
  Object.assign(session, updates, { updated_at: new Date().toISOString() });
  return session;
}

export async function mockDeleteSession(sessionId) {
  mockSessions = mockSessions.filter((s) => String(s.id) !== String(sessionId));
  return null;
}

export function __resetMockSessions() {
  mockSessions = buildSeedSessions();
  nextId = 4;
}
