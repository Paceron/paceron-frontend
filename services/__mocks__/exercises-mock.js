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
// Nombre y descripción vuelven a ser texto libre (ver enmienda 2026-09-06,
// segunda vuelta, de docs/superpowers/specs/2026-08-26-training-plans-design.md
// — mapear qué característica aplica a qué tipo, y componer el nombre
// solo, terminó siendo más complejidad de la que valía dado lo variado
// que es un ejercicio real). `intensity`/`minutes`/`distance_m`/
// `speed_kph`/`muscle_group` son todos opcionales, sin atarlos a un tipo
// en particular — cualquier combinación es válida.
// Nombres reales de estiramientos/ejercicios de running (no inventados) —
// ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md,
// sección "Datos de ejemplo más realistas". Fuentes: gymcompany.es "18
// estiramientos imprescindibles para después de correr", clinicaalbareda.cat
// "8 ejercicios de estiramientos para corredores", nike.com/vitonica.com
// sobre tipos de entrenamiento (fondo/rodaje, series, tempo run).
function buildSeedExercises() {
  const now = new Date().toISOString();
  const rows = [
    { id: 1, name: 'Caminata regenerativa', description: 'Caminata suave para bajar pulsaciones después de una sesión fuerte.', kind: 'walking', intensity: 'light', minutes: 5, distanceM: null, speedKph: null, muscleGroup: null },
    { id: 2, name: 'Caminata rápida de entrada en calor', description: 'Caminata a paso vivo para activar antes de una sesión.', kind: 'walking', intensity: 'moderate', minutes: 8, distanceM: null, speedKph: null, muscleGroup: null },
    { id: 3, name: 'Trote suave', description: 'Trote a ritmo conversable, sin exigencia.', kind: 'jogging', intensity: 'light', minutes: 20, distanceM: null, speedKph: null, muscleGroup: null },
    { id: 4, name: 'Trote suave 3km', description: 'Trote continuo suave, distancia fija en vez de tiempo.', kind: 'jogging', intensity: 'light', minutes: null, distanceM: 3000, speedKph: null, muscleGroup: null },
    { id: 5, name: 'Elongación de isquiotibiales', description: 'Estiramiento estático de isquiotibiales post-entrenamiento.', kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'isquiotibiales' },
    { id: 6, name: 'Elongación de cuádriceps', description: 'Estiramiento estático de cuádriceps post-entrenamiento.', kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'cuadriceps' },
    { id: 7, name: 'Elongación de gemelos', description: 'Estiramiento estático de gemelos post-entrenamiento.', kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'gemelos' },
    { id: 8, name: 'Elongación de glúteos', description: 'Estiramiento estático de glúteos post-entrenamiento.', kind: 'elongation', intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'gluteos' },
    { id: 9, name: 'Ritmo continuo 3K', description: 'Fondo a ritmo moderado y sostenido.', kind: 'cruising', intensity: 'moderate', minutes: null, distanceM: 3000, speedKph: 10, muscleGroup: null },
    { id: 10, name: 'Ritmo continuo 5K', description: 'Fondo a ritmo moderado y sostenido.', kind: 'cruising', intensity: 'moderate', minutes: null, distanceM: 5000, speedKph: 10.5, muscleGroup: null },
    { id: 11, name: 'Rodaje suave 8K', description: 'Rodaje largo a ritmo cómodo, la sesión más larga de la semana.', kind: 'cruising', intensity: 'light', minutes: null, distanceM: 8000, speedKph: 9.5, muscleGroup: null },
    { id: 12, name: 'Series 400m fuertes', description: 'Repeticiones cortas a ritmo fuerte, con descanso entre cada una.', kind: 'running', intensity: 'vigorous', minutes: null, distanceM: 400, speedKph: 14, muscleGroup: null },
    { id: 13, name: 'Series 200m explosivas', description: 'Repeticiones muy cortas a máxima velocidad, foco en potencia.', kind: 'running', intensity: 'vigorous', minutes: null, distanceM: 200, speedKph: 16, muscleGroup: null },
    { id: 14, name: 'Series 1000m ritmo umbral', description: 'Repeticiones más largas, cerca del umbral anaeróbico.', kind: 'running', intensity: 'moderate', minutes: null, distanceM: 1000, speedKph: 13, muscleGroup: null },
  ];
  return rows.map((r) => ({
    id: r.id, owner_id: 1, name: r.name, description: r.description, kind: r.kind, intensity: r.intensity,
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
    description: payload.description ?? null,
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

// Copia con sufijo "(copia)" — mismo criterio que mockCloneTrainingPlan
// (services/__mocks__/training-plans-mock.js). No hereda uso en
// sesiones: una sesión existente sigue apuntando al exerciseId
// original, no al clon.
export async function mockCloneExercise(exerciseId) {
  const original = findExerciseOrThrow(exerciseId);
  const now = new Date().toISOString();
  const clone = {
    ...original,
    id: nextId++,
    name: `${original.name} (copia)`,
    created_at: now,
    updated_at: now,
  };
  mockExercises.push(clone);
  return clone;
}

export function __resetMockExercises() {
  mockExercises = buildSeedExercises();
  nextId = 15;
}
