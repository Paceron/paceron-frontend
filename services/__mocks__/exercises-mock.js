// Catálogo de ejercicios del entrenador — mismo patrón stateful in-memory
// que el resto de los mocks (teams-mock.js, training-plans-mock.js). Sin
// backend real todavía (ver docs/BACKEND_API_GAPS.md gap 4, ampliado en la
// enmienda 2026-08-26 de la spec de planes de entrenamiento).
//
// `kind` es uno de los 5 tipos hoja del schema SQL de referencia
// (walking/jogging/elongation/cruising/running) — "set" ya no es un kind
// de ejercicio, es una propiedad de cómo una `Session` usa el ejercicio
// del bloque principal (repeatCount/restMinutes), ver sessions-mock.js.
// `video_url` existe desde ya (siempre null) para no migrar el shape el
// día que se implemente.
function buildSeedExercises() {
  const now = new Date().toISOString();
  return [
    { id: 1, owner_id: 1, name: 'Caminata regenerativa', kind: 'walking', minutes: 5, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 2, owner_id: 1, name: 'Trote suave', kind: 'jogging', minutes: 20, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 3, owner_id: 1, name: 'Elongación general', kind: 'elongation', minutes: null, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 4, owner_id: 1, name: 'Ritmo continuo 3K', kind: 'cruising', minutes: null, distance_m: 3000, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 5, owner_id: 1, name: 'Series 400m fuertes', kind: 'running', minutes: null, distance_m: 400, speed_kph: 14, video_url: null, created_at: now, updated_at: now },
  ];
}

let mockExercises = buildSeedExercises();
let nextId = 6;

function findExerciseOrThrow(exerciseId) {
  const exercise = mockExercises.find((e) => String(e.id) === String(exerciseId));
  if (!exercise) {
    const error = new Error('Ejercicio no encontrado.');
    error.status = 404;
    throw error;
  }
  return exercise;
}

export async function mockListExercises({ ownerId } = {}) {
  let result = mockExercises;
  if (ownerId != null) result = result.filter((e) => e.owner_id === Number(ownerId));
  return [...result];
}

export async function mockGetExercise(exerciseId) {
  return findExerciseOrThrow(exerciseId);
}

export async function mockCreateExercise(payload) {
  const now = new Date().toISOString();
  const exercise = {
    id: nextId++,
    owner_id: payload.owner_id,
    name: payload.name,
    kind: payload.kind,
    minutes: payload.minutes ?? null,
    distance_m: payload.distance_m ?? null,
    speed_kph: payload.speed_kph ?? null,
    video_url: null,
    created_at: now,
    updated_at: now,
  };
  mockExercises.push(exercise);
  return exercise;
}

export async function mockUpdateExercise(exerciseId, updates) {
  const exercise = findExerciseOrThrow(exerciseId);
  Object.assign(exercise, updates, { updated_at: new Date().toISOString() });
  return exercise;
}

export async function mockDeleteExercise(exerciseId) {
  mockExercises = mockExercises.filter((e) => String(e.id) !== String(exerciseId));
  return null;
}

export function __resetMockExercises() {
  mockExercises = buildSeedExercises();
  nextId = 6;
}
