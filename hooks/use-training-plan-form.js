import { useState } from 'react';
import { buildEmptyPlanDays } from '../store/training-plan-store.js';

// Estado + validación del formulario de crear/editar un plan de
// entrenamiento — mismo patrón que hooks/use-team-general-info-form.js
// (un hook compartido por CreateTrainingPlanScreen y
// EditTrainingPlanScreen, cada una con su propio `initial`).
export function useTrainingPlanForm({ initial, ownerId } = {}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [durationDays, setDurationDays] = useState(initial?.durationDays ?? 7);
  const [days, setDays] = useState(initial?.days ?? buildEmptyPlanDays());
  const [errors, setErrors] = useState({});

  const updateDay = (sequenceNo, updates) => {
    setDays((prev) => prev.map((day) => (day.sequenceNo === sequenceNo ? { ...day, ...updates } : day)));
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Ingresá un nombre para el plan.';

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
    durationDays,
    days,
  });

  return {
    name, setName,
    description, setDescription,
    durationDays, setDurationDays,
    days, updateDay,
    errors,
    validate,
    getValues,
  };
}
