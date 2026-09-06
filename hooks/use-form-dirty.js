import { useRef } from 'react';

// Detección genérica de "cambios sin guardar" sin librería de forms: cada
// pantalla arma su propio objeto plano con los campos que le importan y lo
// pasa acá en cada render — se compara contra un snapshot JSON tomado la
// primera vez (alta: vacío: edición: los valores ya cargados).
//
// `resetKey` es para forms que vuelven a "arrancar de cero" sin
// desmontarse — los modales de catálogo (CreateSessionModal,
// CreateExerciseModal) siguen montados con `visible=false` entre usos y
// recargan sus campos vía un efecto propio cuando se reabren; pasarles
// `session?.id ?? 'new'` (o equivalente) como resetKey hace que el
// snapshot base se recapture en ese momento, no solo en el mount inicial.
export function useFormDirty(values, resetKey) {
  const snapshot = JSON.stringify(values);
  const baselineRef = useRef(snapshot);
  const prevResetKeyRef = useRef(resetKey);

  // Si resetKey cambió, recapturar el baseline con el snapshot actual
  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey;
    baselineRef.current = snapshot;
  }

  return snapshot !== baselineRef.current;
}
