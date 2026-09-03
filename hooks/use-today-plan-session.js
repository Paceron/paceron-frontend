import { useEffect, useState } from 'react';
import { getSession } from '../services/sessions.js';
import { getExercise } from '../services/exercises.js';
import { toSessionModel, toExerciseModel } from '../services/normalizers.js';
import { getTodayDayOfWeek } from '../store/training-plan-store.js';

// Resuelve el día de HOY de un plan puntual — y, si es de entrenamiento,
// la sesión + sus 3 ejercicios. A propósito NO usa useSessionStore/
// useExerciseStore (esos guardan un array plano por owner y lo pisan en
// cada fetch) — acá puede haber hasta 2 planes de 2 entrenadores
// distintos resolviéndose en paralelo (uno por card del hero), así que
// se pide cada cosa por id puntual vía los servicios singulares. Ver
// docs/superpowers/specs/2026-09-03-my-plans-today-session-design.md.
export function useTodayPlanSession(plan) {
  const [state, setState] = useState({ loading: true, day: null, session: null, warmupExercise: null, mainExercise: null, cooldownExercise: null });

  useEffect(() => {
    if (!plan) {
      setState({ loading: false, day: null, session: null, warmupExercise: null, mainExercise: null, cooldownExercise: null });
      return undefined;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    const today = getTodayDayOfWeek();
    const day = plan.days.find((d) => d.dayOfWeek === today) ?? null;

    if (!day || day.kind !== 'training' || !day.sessionId) {
      if (!cancelled) setState({ loading: false, day, session: null, warmupExercise: null, mainExercise: null, cooldownExercise: null });
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const sessionDto = await getSession(day.sessionId);
        const session = toSessionModel(sessionDto);
        const [warmupDto, mainDto, cooldownDto] = await Promise.all([
          getExercise(session.warmupExerciseId),
          getExercise(session.mainExerciseId),
          getExercise(session.cooldownExerciseId),
        ]);
        if (cancelled) return;
        setState({
          loading: false,
          day,
          session,
          warmupExercise: toExerciseModel(warmupDto),
          mainExercise: toExerciseModel(mainDto),
          cooldownExercise: toExerciseModel(cooldownDto),
        });
      } catch {
        // Sesión referenciada que ya no existe, o falló el fetch — el
        // card cae al estado "sin sesión resuelta" en vez de romper.
        if (!cancelled) setState({ loading: false, day, session: null, warmupExercise: null, mainExercise: null, cooldownExercise: null });
      }
    })();

    return () => { cancelled = true; };
  }, [plan]);

  return state;
}
