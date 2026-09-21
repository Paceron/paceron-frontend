import { create } from 'zustand';
import {
  getTrainingPlan as getTrainingPlanService,
  listRunnerPlanAssignments as listRunnerPlanAssignmentsService,
  listCurrentPlanMarks as listCurrentPlanMarksService,
  markPlanAsCurrent as markPlanAsCurrentService,
  unmarkPlanAsCurrent as unmarkPlanAsCurrentService,
} from '../services/trainingPlans.js';
import {
  toTrainingPlanModel,
  toRunnerPlanAssignmentModel, toCurrentPlanMarkModel,
} from '../services/normalizers.js';

// Arma dayCount días vacíos (todos "rest"), numerados 1..dayCount —
// punto de partida al crear un plan nuevo o al agregar/quitar días en
// el form. Sin día de la semana: el orden es puramente secuencial.
export function buildEmptyPlanDays(dayCount) {
  return Array.from({ length: dayCount }, (_, i) => ({
    sequenceNo: i + 1, kind: 'rest', otherName: null, sessionId: null,
    isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '',
  }));
}

// CRUD del catálogo de planes (list/get/create/update/delete/clone) vive
// en hooks/use-training-plans.js (TanStack Query, ver CLAUDE.md) — este
// store quedó solo con lo que NO es catálogo puro: asignación individual
// al corredor (vieja, mockeada, ver services/trainingPlans.js) y
// "plan actual". La asignación a un GRUPO (antes 100% local,
// groupTrainingPlanIds/assignToGroup, más la pantalla dedicada
// assign-training-plan-screen.jsx) se retiró 2026-09-21 — el mecanismo
// real ahora es el calendario de grupo (docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md).
export const useTrainingPlanStore = create((set) => ({
  // Planes que ve el corredor (Mis planes) — solo asignación individual
  // por ahora (ver comentario de arriba sobre la asignación a grupo).
  myPlans: [],
  // Hasta 2 ids de myPlans marcados como "actual" — ver
  // docs/superpowers/specs/2026-09-03-my-plans-today-session-design.md.
  myCurrentPlanIds: [],

  // Limpieza local tras borrar un plan (hooks/use-training-plans.js#useTrainingPlanMutations
  // llama a esto en el onSuccess de deletePlan) — el plan en sí ya lo
  // borró el service real, esto solo saca su entrada de myPlans si el
  // corredor lo tenía asignado.
  cleanupAfterPlanDeleted: (planId) => {
    set((state) => ({ myPlans: state.myPlans.filter((p) => p.id !== planId) }));
  },

  // "Mis planes" del corredor — asignación individual únicamente (ver
  // comentario de arriba). El plan por grupo se va a resolver contra el
  // calendario de grupo cuando se aborde la pieza 3 (vista del corredor).
  fetchMyPlans: async (userId) => {
    try {
      const individualDtos = await listRunnerPlanAssignmentsService({ userId });
      const individualPlanIds = individualDtos.map((dto) => toRunnerPlanAssignmentModel(dto).planId);

      const uniquePlanIds = [...new Set(individualPlanIds)];
      const plans = await Promise.all(uniquePlanIds.map(async (planId) => toTrainingPlanModel(await getTrainingPlanService(planId))));

      // Filtra contra uniquePlanIds — un plan marcado como actual que ya
      // no está asignado (desasignado del lado del entrenador) no debería
      // seguir apareciendo en el hero.
      const markDtos = await listCurrentPlanMarksService({ userId });
      const currentPlanIds = markDtos
        .map((dto) => toCurrentPlanMarkModel(dto).planId)
        .filter((planId) => uniquePlanIds.includes(planId));

      set({ myPlans: plans, myCurrentPlanIds: currentPlanIds });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Marcar/desmarcar un plan como "actual" — preferencia del corredor,
  // no una asignación nueva (ver spec). El tope de 2 lo hace cumplir el
  // servicio (mockMarkPlanAsCurrent tira si ya hay 2), acá solo se
  // propaga el error para que la UI lo muestre.
  markCurrentPlan: async (userId, planId) => {
    try {
      await markPlanAsCurrentService(userId, planId);
      set((state) => (state.myCurrentPlanIds.includes(planId) ? state : { myCurrentPlanIds: [...state.myCurrentPlanIds, planId] }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  unmarkCurrentPlan: async (userId, planId) => {
    try {
      await unmarkPlanAsCurrentService(userId, planId);
      set((state) => ({ myCurrentPlanIds: state.myCurrentPlanIds.filter((id) => id !== planId) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
