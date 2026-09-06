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
// Nombre 100% derivado de tipo + intensidad + duración/distancia/grupo
// muscular — ya no es texto libre (ver enmienda 2026-09-06 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md). Copiado a
// propósito de buildExerciseName (components/plans/exercise-kind-meta.js)
// en vez de importarlo — mismo criterio ya usado acá para
// MUSCLE_GROUP_LABELS-equivalente: services/ (capa de datos) no depende
// de components/plans/ (capa de UI), aunque ese archivo no tenga imports
// propios y sea técnicamente seguro bajo Jest — es la dirección de
// dependencia inversa a la que tiene el resto del repo. Si la regla de
// composición cambia en exercise-kind-meta.js, actualizar en paralelo acá.
const SEED_KIND_LABELS = { walking: 'Caminata', jogging: 'Trote', elongation: 'Elongación', cruising: 'Ritmo continuo', running: 'Corrida' };
const SEED_KIND_GENDER = { walking: 'f', jogging: 'm', cruising: 'm', running: 'f' };
const SEED_INTENSITY_LABELS = { light: 'Suave', moderate: { f: 'Moderada', m: 'Moderado' }, vigorous: 'Fuerte' };
const SEED_MUSCLE_LABELS = {
  cuadriceps: 'Cuádriceps', isquiotibiales: 'Isquiotibiales', gemelos: 'Gemelos (pantorrillas)', gluteos: 'Glúteos',
  aductores: 'Aductores', psoas: 'Psoas / flexores de cadera', lumbares: 'Zona lumbar / cadena posterior', core: 'Core / abdominales',
};

function seedDistanceToken(distanceM) {
  if (distanceM < 1000) return `${distanceM}m`;
  const km = distanceM / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`;
}

function seedIntensityLabel(kind, intensity) {
  const entry = SEED_INTENSITY_LABELS[intensity];
  if (!entry) return null;
  return typeof entry === 'string' ? entry : entry[SEED_KIND_GENDER[kind]];
}

function buildSeedName({ kind, intensity, minutes, distanceM, muscleGroup }) {
  if (kind === 'elongation') {
    const muscleLabel = muscleGroup && SEED_MUSCLE_LABELS[muscleGroup];
    return muscleLabel ? `${SEED_KIND_LABELS[kind]} de ${muscleLabel.charAt(0).toLowerCase()}${muscleLabel.slice(1)}` : SEED_KIND_LABELS[kind];
  }
  const parts = [SEED_KIND_LABELS[kind]];
  const intensityLabel = seedIntensityLabel(kind, intensity);
  if (intensityLabel) parts.push(intensityLabel.toLowerCase());
  if (distanceM != null) parts.push(seedDistanceToken(distanceM));
  else if ((kind === 'walking' || kind === 'jogging') && minutes != null) parts.push(`${minutes} min`);
  return parts.join(' ');
}

// Nombres reales de estiramientos/ejercicios de running (no inventados) —
// ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md,
// sección "Datos de ejemplo más realistas". Fuentes: gymcompany.es "18
// estiramientos imprescindibles para después de correr", clinicaalbareda.cat
// "8 ejercicios de estiramientos para corredores", nike.com/vitonica.com
// sobre tipos de entrenamiento (fondo/rodaje, series, tempo run).
function buildSeedExercises() {
  const now = new Date().toISOString();
  const rows = [
    { id: 1, kind: 'walking', intensity: 'light', minutes: 5, distanceM: null, speedKph: null, muscleGroup: null },
    { id: 2, kind: 'walking', intensity: 'moderate', minutes: 8, distanceM: null, speedKph: null, muscleGroup: null },
    { id: 3, kind: 'jogging', intensity: 'light', minutes: 20, distanceM: null, speedKph: null, muscleGroup: null },
    { id: 4, kind: 'jogging', intensity: 'light', minutes: null, distanceM: 3000, speedKph: null, muscleGroup: null }, // "Trote suave 3km" — el ejemplo original del usuario
    { id: 5, kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'isquiotibiales' },
    { id: 6, kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'cuadriceps' },
    { id: 7, kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'gemelos' },
    { id: 8, kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'gluteos' },
    { id: 9, kind: 'cruising', intensity: 'moderate', minutes: null, distanceM: 3000, speedKph: 10, muscleGroup: null },
    { id: 10, kind: 'cruising', intensity: 'moderate', minutes: null, distanceM: 5000, speedKph: 10.5, muscleGroup: null },
    { id: 11, kind: 'cruising', intensity: 'light', minutes: null, distanceM: 8000, speedKph: 9.5, muscleGroup: null },
    { id: 12, kind: 'running', intensity: 'vigorous', minutes: null, distanceM: 400, speedKph: 14, muscleGroup: null },
    { id: 13, kind: 'running', intensity: 'vigorous', minutes: null, distanceM: 200, speedKph: 16, muscleGroup: null },
    { id: 14, kind: 'running', intensity: 'moderate', minutes: null, distanceM: 1000, speedKph: 13, muscleGroup: null },
  ];
  return rows.map((r) => ({
    id: r.id, owner_id: 1, name: buildSeedName(r), kind: r.kind, intensity: r.intensity,
    minutes: r.minutes, distance_m: r.distanceM, speed_kph: r.speedKph, muscle_group: r.muscleGroup,
    video_url: null, created_at: now, updated_at: now,
  }));
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
    intensity: payload.intensity ?? null,
    minutes: payload.minutes ?? null,
    distance_m: payload.distance_m ?? null,
    speed_kph: payload.speed_kph ?? null,
    muscle_group: payload.muscle_group ?? null,
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
