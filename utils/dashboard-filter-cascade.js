// La cascada de filtros del dashboard: tipo → ejercicio → rangos. Acá vive la
// parte que se puede probar, que es la que decide qué ejercicios hay para elegir
// y qué pasa con el ejercicio que ya estaba elegido cuando el tipo cambia.
//
// Por qué es lógica pura y no JSX: el proyecto no testea render de componentes
// (CLAUDE.md, "Testing"), así que una condición mal puesta en un `onPress` no
// falla nunca. Estas dos funciones son el filtro de esa condición.

import { isSameId } from './id-match.js';

// Los TRES tipos con métrica. `liviano` y `elongacion` no se ofrecen: sus series
// son `warmup`/`cooldown` y nunca pasarían el filtro `role = 'main'` del
// backend, así que un filtro por ellos siempre devolvería vacío — peor que no
// ofrecerlo, porque el usuario elige algo y no entiende el vacío.
// El orden es el de utils/exercise-field-matrix.js (los dos de velocidad
// primero, el de ritmo último).
export const METRIC_KINDS = ['ritmo_continuo', 'velocidad_distancia', 'velocidad_tiempo'];

// Los ejercicios que se ofrecen para un tipo. Sin tipo elegido —el "todos",
// que es el valor vacío— ofrece los de los tres tipos métricos, nunca los cinco.
export function exercisesForKind(exercises, kind) {
  const allowed = kind ? [kind] : METRIC_KINDS;
  return (exercises ?? []).filter((exercise) => allowed.includes(exercise?.kind));
}

// El ejercicio que queda elegido después de cambiar el tipo: el mismo si sigue
// en la lista, `null` si no.
//
// El paso es obligatorio, no cosmético: `kind` y `exercise_id` son excluyentes
// en el backend (resolveExerciseFilter), y dejar "Velocidad en distancia" arriba
// con "Ritmo continuo 10 km" elegido es un estado imposible que además
// devuelve 400.
//
// La comparación va con `isSameId` y no con `===` por el motivo de siempre: el
// id viene de `/dashboard/filters` numérico y el elegido de la UI como string.
export function reconcileExercise(exercises, kind, currentExerciseId) {
  if (currentExerciseId === null || currentExerciseId === undefined || currentExerciseId === '') return null;
  const available = exercisesForKind(exercises, kind);
  const match = available.find((exercise) => isSameId(exercise.id, currentExerciseId));
  return match ? match.id : null;
}