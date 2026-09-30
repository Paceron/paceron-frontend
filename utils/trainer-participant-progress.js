// Cuántas series tiene un ejercicio de la sesión -- mismo criterio que
// session-db.js#createRun (repeatCount ?? 1, mínimo 1). Se usa para derivar
// cuántas series resuelve un update de "saltear ejercicio completo" (que llega
// como UN mensaje, no una serie a la vez), y para saber cuándo un atleta
// terminó TODO.
export function countSetsForExercise(exercises, exerciseInstanceId) {
  const exercise = (exercises ?? []).find((e) => String(e.id) === String(exerciseInstanceId));
  if (!exercise) return 0;
  return Math.max(1, exercise.repeatCount ?? 1);
}

export function totalSetsForSession(exercises) {
  return (exercises ?? []).reduce((sum, exercise) => sum + Math.max(1, exercise.repeatCount ?? 1), 0);
}
