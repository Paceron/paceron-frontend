// Catálogo de sesiones del entrenador — una sesión es una lista libre de
// ejercicios (`exercises`), cada uno con su propio `role`
// ('warmup'|'main'|'cooldown') en vez de 3 columnas fijas — cualquier rol
// admite más de un ejercicio (ver enmienda 2026-09-05 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md).
// `repeat_count`/`rest_minutes` son por ejercicio, no solo del bloque
// principal como antes — repeatCount 1 + restMinutes 0 = "una sola vez".
// Terminología real de entrenamiento de running (fondo/rodaje continuo,
// series, tempo run) — ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md.
// Los ids 1/2/3 se mantienen (mismo nombre) porque
// training-plans-mock.js los referencia por id en el plan sembrado.
function buildSeedSessions() {
  const now = new Date().toISOString();
  return [
    {
      id: 1, owner_id: 1, name: 'Fondo suave', description: 'Trote continuo a ritmo conversable.',
      exercises: [
        { exercise_id: 1, role: 'warmup', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 3, role: 'main', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 5, role: 'cooldown', repeat_count: 1, rest_minutes: 0 },
      ],
      created_at: now, updated_at: now,
    },
    {
      id: 2, owner_id: 1, name: 'Series de velocidad', description: 'Intervalos cortos a ritmo fuerte, con descanso entre cada uno.',
      exercises: [
        { exercise_id: 2, role: 'warmup', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 12, role: 'main', repeat_count: 4, rest_minutes: 2 },
        { exercise_id: 6, role: 'cooldown', repeat_count: 1, rest_minutes: 0 },
      ],
      created_at: now, updated_at: now,
    },
    {
      id: 3, owner_id: 1, name: 'Rodaje largo', description: 'Ritmo continuo sostenido, la sesión más larga de la semana.',
      exercises: [
        { exercise_id: 1, role: 'warmup', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 11, role: 'main', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 7, role: 'cooldown', repeat_count: 1, rest_minutes: 0 },
      ],
      created_at: now, updated_at: now,
    },
    {
      id: 4, owner_id: 1, name: 'Tempo run', description: 'Ritmo sostenido, cerca del umbral anaeróbico.',
      exercises: [
        { exercise_id: 4, role: 'warmup', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 10, role: 'main', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 8, role: 'cooldown', repeat_count: 1, rest_minutes: 0 },
      ],
      created_at: now, updated_at: now,
    },
    {
      // Único seed con 2 ejercicios "main" — ejercita a propósito el caso
      // de varios ejercicios en un mismo rol.
      id: 5, owner_id: 1, name: 'Series explosivas', description: 'Series cortas a máxima velocidad, foco en potencia.',
      exercises: [
        { exercise_id: 2, role: 'warmup', repeat_count: 1, rest_minutes: 0 },
        { exercise_id: 13, role: 'main', repeat_count: 6, rest_minutes: 3 },
        { exercise_id: 14, role: 'main', repeat_count: 4, rest_minutes: 2 },
        { exercise_id: 5, role: 'cooldown', repeat_count: 1, rest_minutes: 0 },
      ],
      created_at: now, updated_at: now,
    },
  ];
}

let mockSessions = buildSeedSessions();
let nextId = 6;

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
    exercises: (payload.exercises ?? []).map((e) => ({
      exercise_id: e.exercise_id,
      role: e.role,
      repeat_count: e.repeat_count ?? 1,
      rest_minutes: e.rest_minutes ?? 0,
    })),
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
  nextId = 6;
}
