// "Personalidad" visual del módulo de planes — cada tipo de ejercicio
// tiene su propio ícono y color (antes todo era gris neutro). El color no
// es decorativo nomás: comunica intensidad/tipo de esfuerzo de un
// vistazo, mismo criterio de "semáforo con intención" que ya usa el
// resto de la app (SUBSCRIPTION_META, TEAM_STATUS_META) pero acá el
// significado es el tipo de ejercicio, no un estado de urgencia.
// `gender` ('f'|'m') es el género gramatical del sustantivo del tipo
// (la caminata, el trote, el ritmo, la corrida) — lo usa buildExerciseName
// para concordar el adjetivo de intensidad ("Caminata moderada" vs
// "Trote moderado"). Elongación no lo necesita (no lleva intensidad).
export const EXERCISE_KIND_META = {
  walking: { label: 'Caminata', gender: 'f', icon: 'walk', iconColor: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  jogging: { label: 'Trote', gender: 'm', icon: 'run', iconColor: '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  elongation: { label: 'Elongación', icon: 'yoga', iconColor: '#9333ea', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  cruising: { label: 'Ritmo continuo', gender: 'm', icon: 'speedometer', iconColor: '#0d9488', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  running: { label: 'Corrida', gender: 'f', icon: 'run-fast', iconColor: '#ea580c', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
};

// Intensidad de esfuerzo — campo propio, independiente del tipo (antes
// jogging traía la intensidad pegada al label fijo, "Trote suave"). Solo
// aplica a los 4 tipos "cardio" (walking/jogging/cruising/running);
// elongation no tiene intensidad, se nombra por grupo muscular. `label`/
// `labelF` porque "moderado" concuerda en género con el tipo ("Trote
// moderado" vs "Caminata moderada") — "suave"/"fuerte" son invariables,
// por eso repiten el mismo valor en ambos campos.
export const INTENSITY_ORDER = ['light', 'moderate', 'vigorous'];

export const INTENSITY_META = {
  light: { label: 'Suave', labelF: 'Suave', icon: 'speedometer-slow', iconColor: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  moderate: { label: 'Moderado', labelF: 'Moderada', icon: 'speedometer-medium', iconColor: '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  vigorous: { label: 'Fuerte', labelF: 'Fuerte', icon: 'speedometer', iconColor: '#e11d48', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400' },
};

export const DAY_KIND_META = {
  rest: { label: 'Descanso', icon: 'sleep', iconColor: '#64748b', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
  other: { label: 'Otra actividad', icon: 'star-four-points-outline', iconColor: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  training: { label: 'Entrenamiento', icon: 'run-fast', iconColor: '#8cc63e', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
};

// Labels de grupo muscular — duplica a propósito los ids de
// MUSCLE_GROUP_OPTIONS (store/exercise-store.js, fuente real para el
// picker del form) en vez de importarlo: ese store arrastra la cadena
// services/exercises.js → services/api.js → store/auth-store.js →
// services/storage.js → expo-secure-store (solo nativo), que rompe bajo
// Jest — este archivo se importa desde tests puros de
// buildExerciseStatLine y necesita quedar sin esa dependencia. 8 pares
// id→label, bajo riesgo de desincronizarse.
const MUSCLE_GROUP_LABELS = {
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  gemelos: 'Gemelos (pantorrillas)',
  gluteos: 'Glúteos',
  aductores: 'Aductores',
  psoas: 'Psoas / flexores de cadera',
  lumbares: 'Zona lumbar / cadena posterior',
  core: 'Core / abdominales',
};

// Bajo 1000m se muestra en metros ("400m"), 1000 o más en km ("3km",
// "1.5km" si no es entero) — mismo umbral que ya usaban los nombres
// sembrados a mano ("Ritmo continuo 5K"), con la unidad en minúscula
// (consistente con "km/h" de la stat line) y sin espacio (igual que el
// ejemplo original del usuario, "3km").
function formatDistanceToken(distanceM) {
  if (distanceM < 1000) return `${distanceM}m`;
  const km = distanceM / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`;
}

// Qué dato numérico usa buildExerciseName como protagonista del nombre —
// walking/jogging prefieren distancia (nueva, opcional) y caen a minutos
// si no está cargada; cruising/running siempre usan distancia (nunca
// tuvieron minutos); elongation no tiene número, se nombra por grupo
// muscular. Compartida con buildExerciseStatLine para que la stat-line
// nunca repita el mismo dato que ya quedó en el nombre.
function nameNumericField(exercise) {
  if (exercise.kind === 'elongation') return null;
  if (exercise.distanceM != null) return 'distanceM';
  if ((exercise.kind === 'walking' || exercise.kind === 'jogging') && exercise.minutes != null) return 'minutes';
  return null;
}

// Nombre 100% derivado de las características del ejercicio — ya no es
// texto libre (ver enmienda 2026-09-06 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md). Frase
// natural, sin separadores, con concordancia de género del adjetivo de
// intensidad ("Caminata moderada" vs "Trote moderado"). Elongación se
// nombra por grupo muscular, sin intensidad ("Elongación de cuádriceps").
// Tolera datos faltantes (sin intensidad, sin número, sin grupo
// muscular): el nombre se degrada con gracia en vez de romperse.
export function buildExerciseName(exercise) {
  const kindMeta = EXERCISE_KIND_META[exercise.kind];
  if (!kindMeta) return '';

  if (exercise.kind === 'elongation') {
    const muscleLabel = exercise.muscleGroup && MUSCLE_GROUP_LABELS[exercise.muscleGroup];
    if (!muscleLabel) return kindMeta.label;
    return `${kindMeta.label} de ${muscleLabel.charAt(0).toLowerCase()}${muscleLabel.slice(1)}`;
  }

  const parts = [kindMeta.label];
  const intensityMeta = INTENSITY_META[exercise.intensity];
  // minúscula: solo la primera palabra (el tipo) va con mayúscula, mismo
  // estilo "oración" que ya usaban los nombres sembrados a mano ("Trote
  // suave", "Series 400m fuertes").
  if (intensityMeta) parts.push((kindMeta.gender === 'f' ? intensityMeta.labelF : intensityMeta.label).toLowerCase());

  const field = nameNumericField(exercise);
  if (field === 'distanceM') parts.push(formatDistanceToken(exercise.distanceM));
  else if (field === 'minutes') parts.push(`${exercise.minutes} min`);

  return parts.join(' ');
}

// Línea de "stat" de un ejercicio (debajo del nombre: minutos, ritmo,
// repeticiones) — ya no repite lo que buildExerciseName ya dijo:
// distancia nunca se muestra acá (siempre queda en el nombre cuando
// está), minutos solo si NO fue el protagonista del nombre, y grupo
// muscular se saca por completo (vive en el nombre de elongación).
// Compartida por ExercisesCatalogTab, TrainingPlanDetailScreen y
// TodaySessionCard (antes triplicada) — ver enmienda 2026-09-03 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md. Devuelve
// '' (falsy) si no hay nada para mostrar — cada caller decide su propio
// fallback (mostrar meta.label, u ocultar la línea entera).
export function buildExerciseStatLine(exercise, { repeatCount = 1, restMinutes = 0 } = {}) {
  const parts = [];
  if (exercise.minutes != null && nameNumericField(exercise) !== 'minutes') parts.push(`${exercise.minutes} min`);
  if (exercise.speedKph != null) parts.push(`${exercise.speedKph} km/h`);
  if (repeatCount > 1) parts.push(`descanso ${restMinutes} min entre series`);
  return parts.join(' · ');
}
