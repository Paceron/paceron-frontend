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
// Nombres reales de estiramientos/ejercicios de running (no inventados) —
// ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md,
// sección "Datos de ejemplo más realistas". Fuentes: gymcompany.es "18
// estiramientos imprescindibles para después de correr", clinicaalbareda.cat
// "8 ejercicios de estiramientos para corredores", nike.com/vitonica.com
// sobre tipos de entrenamiento (fondo/rodaje, series, tempo run).
function buildSeedExercises() {
  const now = new Date().toISOString();
  return [
    { id: 1, owner_id: 1, name: 'Caminata regenerativa', kind: 'walking', minutes: 5, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 2, owner_id: 1, name: 'Caminata rápida de entrada en calor', kind: 'walking', minutes: 8, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 3, owner_id: 1, name: 'Trote suave', kind: 'jogging', minutes: 20, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 4, owner_id: 1, name: 'Trote de activación', kind: 'jogging', minutes: 10, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 5, owner_id: 1, name: 'Elongación de isquiotibiales', kind: 'elongation', minutes: null, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 6, owner_id: 1, name: 'Elongación de cuádriceps', kind: 'elongation', minutes: null, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 7, owner_id: 1, name: 'Elongación de gemelos', kind: 'elongation', minutes: null, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 8, owner_id: 1, name: 'Elongación de glúteos', kind: 'elongation', minutes: null, distance_m: null, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 9, owner_id: 1, name: 'Ritmo continuo 3K', kind: 'cruising', minutes: null, distance_m: 3000, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 10, owner_id: 1, name: 'Ritmo continuo 5K', kind: 'cruising', minutes: null, distance_m: 5000, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 11, owner_id: 1, name: 'Rodaje suave 8K', kind: 'cruising', minutes: null, distance_m: 8000, speed_kph: null, video_url: null, created_at: now, updated_at: now },
    { id: 12, owner_id: 1, name: 'Series 400m fuertes', kind: 'running', minutes: null, distance_m: 400, speed_kph: 14, video_url: null, created_at: now, updated_at: now },
    { id: 13, owner_id: 1, name: 'Series 200m explosivas', kind: 'running', minutes: null, distance_m: 200, speed_kph: 16, video_url: null, created_at: now, updated_at: now },
    { id: 14, owner_id: 1, name: 'Series 1000m ritmo umbral', kind: 'running', minutes: null, distance_m: 1000, speed_kph: 13, video_url: null, created_at: now, updated_at: now },
  ];
}

let mockExercises = buildSeedExercises();
let nextId = 15;

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
  nextId = 15;
}
