// "Personalidad" visual del módulo de planes — cada tipo de ejercicio
// tiene su propio ícono y color (antes todo era gris neutro). El color no
// es decorativo nomás: comunica intensidad/tipo de esfuerzo de un
// vistazo, mismo criterio de "semáforo con intención" que ya usa el
// resto de la app (SUBSCRIPTION_META, TEAM_STATUS_META) pero acá el
// significado es el tipo de ejercicio, no un estado de urgencia.
export const EXERCISE_KIND_META = {
  walking: { label: 'Caminata', icon: 'walk', iconColor: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  jogging: { label: 'Trote suave', icon: 'run', iconColor: '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  elongation: { label: 'Elongación', icon: 'yoga', iconColor: '#9333ea', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  cruising: { label: 'Ritmo continuo', icon: 'speedometer', iconColor: '#0d9488', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  running: { label: 'Corrida', icon: 'run-fast', iconColor: '#ea580c', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
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

// Línea de "stat" de un ejercicio (debajo del nombre: minutos, distancia,
// ritmo, grupo muscular, repeticiones) — un dato por kind, el que
// corresponda tenerlo seteado. Compartida por ExercisesCatalogTab,
// TrainingPlanDetailScreen y TodaySessionCard (antes triplicada) — ver
// enmienda 2026-09-03 de docs/superpowers/specs/2026-08-26-training-plans-design.md.
// Devuelve '' (falsy) si no hay nada para mostrar — cada caller decide su
// propio fallback (mostrar meta.label, u ocultar la línea entera).
export function buildExerciseStatLine(exercise, { repeatCount = 1, restMinutes = 0 } = {}) {
  const parts = [];
  if (exercise.minutes != null) parts.push(`${exercise.minutes} min`);
  if (exercise.distanceM != null) parts.push(`${exercise.distanceM} m`);
  if (exercise.speedKph != null) parts.push(`${exercise.speedKph} km/h`);
  if (exercise.muscleGroup && MUSCLE_GROUP_LABELS[exercise.muscleGroup]) {
    parts.push(MUSCLE_GROUP_LABELS[exercise.muscleGroup]);
  }
  if (repeatCount > 1) parts.push(`descanso ${restMinutes} min entre series`);
  return parts.join(' · ');
}
