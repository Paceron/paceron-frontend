import { useState } from 'react';
import { buildEmptyPlanDays } from '../store/training-plan-store.js';

// Estado + validación del formulario de crear/editar un plan de
// entrenamiento — mismo patrón que hooks/use-team-general-info-form.js
// (un hook compartido por CreateTrainingPlanScreen y
// EditTrainingPlanScreen, cada una con su propio `initial`).
export function useTrainingPlanForm({ initial, ownerId } = {}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [days, setDays] = useState(initial?.days ?? buildEmptyPlanDays(7));
  const [errors, setErrors] = useState({});

  const updateDay = (sequenceNo, updates) => {
    setDays((prev) => prev.map((day) => (day.sequenceNo === sequenceNo ? { ...day, ...updates } : day)));
  };

  // Sube o baja la cantidad de días — agrega/quita del final de la
  // lista para no reordenar los que ya están cargados. Clampeado a
  // [2, 31] acá mismo, no solo en el input que lo llama (defensa contra
  // un valor inválido que llegue por otro lado).
  const setDayCount = (nextCount) => {
    const clamped = Math.max(2, Math.min(31, nextCount));
    setDays((prev) => {
      if (clamped === prev.length) return prev;
      if (clamped < prev.length) return prev.slice(0, clamped);
      const extra = Array.from({ length: clamped - prev.length }, (_, i) => ({
        sequenceNo: prev.length + i + 1, kind: 'rest', otherName: null, sessionId: null,
      }));
      return [...prev, ...extra];
    });
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Ingresá un nombre para el plan.';

    if (days.length < 2 || days.length > 31) next.days = 'El plan tiene que tener entre 2 y 31 días.';

    const trainingDaysWithoutSession = days.some((d) => d.kind === 'training' && !d.sessionId);
    if (trainingDaysWithoutSession) next.days = 'Elegí una sesión para cada día de entrenamiento (o creá una nueva con el botón "Crear sesión").';

    const otherDaysWithoutName = days.some((d) => d.kind === 'other' && !d.otherName?.trim());
    if (otherDaysWithoutName) next.days = 'Ingresá el nombre de la actividad en los días marcados como "Otra actividad".';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const getValues = () => ({
    ownerId,
    name: name.trim(),
    description: description.trim(),
    days,
  });

  return {
    name, setName,
    description, setDescription,
    days, updateDay, setDayCount,
    errors,
    validate,
    getValues,
  };
}
