import { getFieldRules } from '../../utils/exercise-field-matrix';

// "Personalidad" visual del módulo de planes — cada tipo de ejercicio tiene su
// propio ícono y color (antes todo era gris neutro). El color no es decorativo
// nomás: comunica el tipo de esfuerzo de un vistazo, mismo criterio de "semáforo
// con intención" que ya usa el resto de la app (SESSION_ROLE_META,
// DAY_KIND_META) pero acá el significado es el tipo de ejercicio, no un estado
// de urgencia.
//
// REEMPLAZA el enum anterior (`walking`/`jogging`/`elongation`/`cruising`/
// `running`), donde nada dependía del tipo y todos los campos eran opcionales
// para cualquiera. Ver utils/exercise-field-matrix.js para la matriz de campos.
export const EXERCISE_KIND_META = {
  // Calentamiento o recuperación. Tono frío: es esfuerzo bajo.
  liviano: { label: 'Liviano', hint: 'Calentamiento o recuperación', icon: 'walk', iconColor: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  // Estiramiento. Violeta, el color que ya tenía y que no colisiona con los
  // tonos de esfuerzo de los otros cuatro.
  elongacion: { label: 'Elongación', icon: 'yoga', iconColor: '#9333ea', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  // Ritmo continuo: effort sostenido. Ícono de cronómetro MEDIO — el de
  // velocidad_distancia es el rápido y el de velocidad_tiempo el lento, así que
  // los tres se distinguen de un vistazo sin leer el label.
  ritmo_continuo: { label: 'Ritmo continuo', icon: 'speedometer', iconColor: '#0d9488', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  // Velocidad en tiempo: esfuerzo definido por el reloj. Ícono lento.
  velocidad_tiempo: { label: 'Velocidad en tiempo', icon: 'speedometer-slow', iconColor: '#ca8a04', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  // Velocidad en distancia: esfuerzo definido por la recorrida. Ícono rápido.
  velocidad_distancia: { label: 'Velocidad en distancia', icon: 'speedometer-medium', iconColor: '#ea580c', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
};

// Kinds que pueden asignarse a un rol restringido (warmup/cooldown). Con el enum
// anterior eran `walking`/`jogging`/`elongation`; ahora es lo mismo que "calentamiento
// o recuperación", que es literalmente lo que define a `liviano` y `elongacion`.
// warmup/main/cooldown restringen QUÉ ejercicio se puede elegir, no cualquier
// EXERCISE_KIND_META sirve fuera del rol "main".
export const WARMCOOL_KINDS = ['liviano', 'elongacion'];

// Tipo de un DÍA del plan de entrenamiento. No tiene nada que ver con el enum de
// ejercicios (vive acá porque comparte archivo y pantalla), pero es el mismo
// patrón "cada valor tiene ícono y color con intención".
export const DAY_KIND_META = {
  rest: { label: 'Descanso', icon: 'sleep', iconColor: '#64748b', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
  other: { label: 'Otra actividad', icon: 'star-four-points-outline', iconColor: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  training: { label: 'Entrenamiento', icon: 'run-fast', iconColor: '#8cc63e', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
};

// Rol de un ejercicio DENTRO de una sesión — antes eran 3 columnas fijas
// (warmup/main/cooldown), ahora una sesión es una lista libre de ejercicios y
// cada uno lleva su propio rol (cualquiera admite más de uno) — ver enmienda
// 2026-09-05 de docs/superpowers/specs/2026-08-26-training-plans-design.md.
// SESSION_ROLE_ORDER es el orden de lectura (agrupado por rol) que usan todas
// las pantallas que muestran una sesión ya armada, sin importar el orden en el
// que se hayan cargado/agregado los ejercicios.
export const SESSION_ROLE_ORDER = ['warmup', 'main', 'cooldown'];

export const SESSION_ROLE_META = {
  warmup: { label: 'Entrada en calor', icon: 'fire', iconColor: '#e11d48', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400' },
  main: { label: 'Ejercicio Principal', icon: 'weight-lifter', iconColor: '#4f46e5', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
  cooldown: { label: 'Vuelta a la calma', icon: 'snowflake', iconColor: '#0891b2', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
};

// Labels de grupo muscular — duplica a propósito los ids de
// MUSCLE_GROUP_OPTIONS (hooks/use-exercises.js, fuente real para el picker del
// form) en vez de importarlo: ese módulo arrastra la cadena
// services/exercises.js → api.js → auth-store.js → storage.js →
// expo-secure-store (solo nativo), que rompe bajo Jest — este archivo se importa
// desde tests puros de buildExerciseStatLine y necesita quedar sin esa
// dependencia. 8 pares, bajo riesgo de desincronizarse.
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

// Línea de "stat" de un ejercicio (debajo del nombre: minutos, distancia, ritmo,
// grupo muscular) — cada campo se suma si está cargado, y solo los que el tipo
// puede tener (ej. elongacion nunca muestra distancia ni velocidad, porque la
// matriz no las permite). Devuelve '' (falsy) si no hay nada que mostrar — cada
// caller decide su propio fallback (mostrar meta.label, u ocultar la línea).
// Compartida por ExercisesCatalogTab, TrainingPlanDetailScreen y
// SessionExerciseRow — antes triplicada.
export function buildExerciseStatLine(exercise, { repeatCount = 1, restMinutes = 0 } = {}) {
  const rules = getFieldRules(exercise.kind);
  const parts = [];
  if (rules.showTime && exercise.minutes != null) parts.push(`${exercise.minutes} min`);
  if (rules.showDistance && exercise.distanceM != null) parts.push(`${exercise.distanceM} m`);
  if (rules.showSpeed && exercise.speedKph != null) parts.push(`${exercise.speedKph} km/h`);
  if (rules.showMuscleGroup && exercise.muscleGroup && MUSCLE_GROUP_LABELS[exercise.muscleGroup]) {
    parts.push(MUSCLE_GROUP_LABELS[exercise.muscleGroup]);
  }
  if (repeatCount > 1) parts.push(`descanso ${restMinutes} min entre series`);
  return parts.join(' · ');
}
