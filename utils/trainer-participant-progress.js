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

// Próximo ejercicio/serie a realizar, derivado de resolvedSetCount asumiendo
// que los ejercicios se hacen en el orden de la sesión -- es lo que permite
// mostrar "Sentadillas · Serie 1" en el detalle de un participante que está
// CONNECTED (se unió, todavía no arrancó nada) o entre series, sin esperar a
// que mande su propio `started` para saber qué viene. `null` si ya resolvió
// todo (resolvedSetCount cubre el total de la sesión).
export function nextExercise(exercises, resolvedSetCount) {
  let consumed = 0;
  for (const exercise of exercises ?? []) {
    const count = Math.max(1, exercise.repeatCount ?? 1);
    if (resolvedSetCount < consumed + count) {
      return { exerciseName: exercise.name, setNumber: resolvedSetCount - consumed + 1 };
    }
    consumed += count;
  }
  return null;
}
