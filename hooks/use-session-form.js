import { useRef, useState } from 'react';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from '../components/plans/exercise-kind-meta.js';
import { reorderList } from '../components/plans/session-drag-and-drop.jsx';

export function useSessionForm({ initial, ownerId, catalogExercises } = {}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [exercises, setExercises] = useState(
    initial?.exercises?.length ? initial.exercises.map((e) => ({ ...e })) : []
  );
  // Derivado, no un segundo useState a mano -- así el borde rojo del campo
  // Nombre se apaga solo apenas se tipea algo, sin un setNameError(false)
  // que haya que recordar llamar en cada handler. `attempted` marca si ya
  // se intentó guardar al menos una vez (no mostrar el borde en un form
  // recién abierto, sin tocar).
  const [attempted, setAttempted] = useState(false);
  const nameError = attempted && !name.trim();
  const missingRoles = SESSION_ROLE_ORDER.filter((role) => !exercises.some((e) => e.role === role));
  // Mismo criterio que nameError -- cualquiera de las 3 condiciones que
  // validate() chequea sobre exercises (vacía, con filas sin elegir, o
  // sin algún rol obligatorio).
  const exercisesError = attempted && (
    exercises.length === 0
    || exercises.some((e) => !e.exerciseId)
    || missingRoles.length > 0
  );
  // `error` (el mensaje de texto) también derivado, por el mismo motivo
  // que nameError/exercisesError -- antes era un useState seteado solo en
  // las ramas de FALLO de validate(), nunca limpiado en la rama de éxito:
  // corregir el problema y reintentar un validate() exitoso dejaba el
  // mensaje de la falla anterior pegado en pantalla para siempre (bug
  // real, 2026-10-06, percibido como "el error no desaparece").
  const error = !attempted ? null
    : !name.trim() || exercises.length === 0
    ? 'Completá el nombre y agregá al menos un ejercicio de cada tipo (entrada en calor, principal, vuelta a la calma).'
    : exercises.some((e) => !e.exerciseId)
    ? 'Completá o quitá los ejercicios sin seleccionar.'
    : missingRoles.length > 0
    ? `Falta al menos un ejercicio de: ${missingRoles.map((r) => SESSION_ROLE_META[r].label).join(', ')}.`
    : null;
  const draftSeq = useRef(0);

  const makeBlankRow = (role) => ({
    localKey: `session-exercise-draft-${Date.now()}-${draftSeq.current++}`,
    exerciseId: '',
    role,
    repeatCount: 1,
    restMinutes: 0,
  });

  const onChangeExercise = (localKey, patch) => {
    setExercises((rows) => rows.map((r) => (r.localKey === localKey ? { ...r, ...patch } : r)));
  };

  const onChangeRole = (localKey, role) => {
    setExercises((rows) => rows.map((r) => {
      if (r.localKey !== localKey) return r;
      if (role !== 'main' && r.exerciseId) {
        const chosen = catalogExercises.find((e) => e.id === r.exerciseId);
        if (chosen && !WARMCOOL_KINDS.includes(chosen.kind)) return { ...r, role, exerciseId: '' };
      }
      return { ...r, role };
    }));
  };

  const onRemove = (localKey) => setExercises((rows) => rows.filter((r) => r.localKey !== localKey));

  const onReorder = (fromIndex, toIndex) => {
    setExercises((rows) => reorderList(rows, fromIndex, toIndex));
  };

  const onExerciseDropped = (exercise, insertIndex) => setExercises((rows) => {
    const next = [...rows];
    next.splice(Math.min(insertIndex, next.length), 0, { ...makeBlankRow('main'), exerciseId: exercise.id });
    return next;
  });

  // El mensaje (`error`, derivado más arriba) ya refleja estas mismas 3
  // condiciones -- acá solo se recalculan para el valor de retorno, ya
  // que `attempted` recién se vuelve true DESPUÉS de este render (el
  // setAttempted de arriba no se refleja en el `error` de este mismo
  // closure todavía).
  const validate = () => {
    setAttempted(true);
    if (!name.trim() || exercises.length === 0) return false;
    if (exercises.some((e) => !e.exerciseId)) return false;
    if (missingRoles.length > 0) return false;
    return true;
  };

  const getValues = () => ({
    ownerId,
    name: name.trim(),
    description: description.trim(),
    exercises,
  });

  return {
    name, setName,
    description, setDescription,
    exercises, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped,
    error, nameError, exercisesError, validate, getValues,
  };
}
