import { useRef, useState } from 'react';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from '../components/plans/exercise-kind-meta.js';
import { reorderList } from '../components/plans/session-drag-and-drop.jsx';

export function useSessionForm({ initial, ownerId, catalogExercises } = {}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [exercises, setExercises] = useState(
    initial?.exercises?.length ? initial.exercises.map((e) => ({ ...e })) : []
  );
  const [error, setError] = useState(null);
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

  const validate = () => {
    if (!name.trim() || exercises.length === 0) {
      setError('Completá el nombre y agregá al menos un ejercicio de cada tipo (entrada en calor, principal, vuelta a la calma).');
      return false;
    }
    if (exercises.some((e) => !e.exerciseId)) {
      setError('Completá o quitá los ejercicios sin seleccionar.');
      return false;
    }
    const missingRoles = SESSION_ROLE_ORDER.filter((role) => !exercises.some((e) => e.role === role));
    if (missingRoles.length > 0) {
      setError(`Falta al menos un ejercicio de: ${missingRoles.map((r) => SESSION_ROLE_META[r].label).join(', ')}.`);
      return false;
    }
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
    error, validate, getValues,
  };
}
