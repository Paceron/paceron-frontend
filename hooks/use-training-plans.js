import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listTrainingPlans as listTrainingPlansService,
  getTrainingPlan as getTrainingPlanService,
  createTrainingPlan as createTrainingPlanService,
  updateTrainingPlan as updateTrainingPlanService,
  deleteTrainingPlan as deleteTrainingPlanService,
  cloneTrainingPlan as cloneTrainingPlanService,
} from '../services/trainingPlans.js';
import { toTrainingPlanModel, toCreateTrainingPlanPayload, toUpdateTrainingPlanPayload } from '../services/normalizers.js';
import { useTrainingPlanStore } from '../store/training-plan-store.js';

// Catálogo de planes de entrenamiento — TanStack Query, no Zustand (ver
// CLAUDE.md). Última pieza del catálogo (ejercicios/sesiones ya
// migrados) en pasar a Query, ahora que el diseño de TrainingPlan quedó
// estable (duración variable, sin caducidad) y el backend real está
// cableado (ver docs/BACKEND_API_GAPS.md gap 4). `store/training-plan-store.js`
// sigue existiendo para lo que NO es catálogo puro: `groupTrainingPlanIds`
// (100% local) y la asignación individual vieja (`assignToRunner`/
// `fetchMyPlans`/etc., mockeada, sin reemplazo real todavía — ver la
// nota de obsolescencia en docs/BACKEND_TRAINING_PLANS_SPEC.md §3.6).

export function useTrainingPlans(ownerId) {
  const query = useQuery({
    queryKey: ['training-plans', ownerId],
    queryFn: () => listTrainingPlansService({ ownerId }).then((dtos) => dtos.map(toTrainingPlanModel)),
    enabled: Boolean(ownerId),
  });
  return { plans: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Un plan puntual, para pantallas de detalle/edición con deep-link
// directo (sin haber pasado antes por la lista). `initialData` busca
// primero en cualquier lista de planes ya cacheada (`['training-plans', *]`,
// cualquier ownerId) — si el usuario llegó navegando desde la lista, el
// plan ya está en memoria y se muestra sin esperar un fetch nuevo.
export function useTrainingPlan(planId) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['training-plan', planId],
    queryFn: () => getTrainingPlanService(planId).then(toTrainingPlanModel),
    enabled: Boolean(planId),
    initialData: () => {
      const cachedLists = queryClient.getQueriesData({ queryKey: ['training-plans'] });
      for (const [, plans] of cachedLists) {
        const found = plans?.find((p) => p.id === planId);
        if (found) return found;
      }
      return undefined;
    },
  });
  return { plan: query.data ?? null, loading: query.isLoading, error: query.error };
}

export function useTrainingPlanMutations() {
  const queryClient = useQueryClient();

  const invalidate = (ownerId, planId) => {
    queryClient.invalidateQueries({ queryKey: ['training-plans', ownerId] });
    if (planId) queryClient.invalidateQueries({ queryKey: ['training-plan', planId] });
  };

  const createPlanMutation = useMutation({
    mutationFn: async ({ form }) => {
      try {
        const created = await createTrainingPlanService(toCreateTrainingPlanPayload(form));
        return { success: true, plan: toTrainingPlanModel(created) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) invalidate(variables.ownerId);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, form }) => {
      try {
        const updated = await updateTrainingPlanService(planId, toUpdateTrainingPlanPayload(form));
        return { success: true, plan: toTrainingPlanModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) invalidate(variables.ownerId, variables.planId);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async ({ planId }) => {
      try {
        await deleteTrainingPlanService(planId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        invalidate(variables.ownerId, variables.planId);
        useTrainingPlanStore.getState().cleanupAfterPlanDeleted(variables.planId);
      }
    },
  });

  const clonePlanMutation = useMutation({
    mutationFn: async ({ planId }) => {
      try {
        const cloned = await cloneTrainingPlanService(planId);
        return { success: true, plan: toTrainingPlanModel(cloned) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) invalidate(variables.ownerId);
    },
  });

  return {
    createPlan: createPlanMutation.mutateAsync,
    isCreating: createPlanMutation.isPending,
    updatePlan: updatePlanMutation.mutateAsync,
    isUpdating: updatePlanMutation.isPending,
    deletePlan: deletePlanMutation.mutateAsync,
    isDeleting: deletePlanMutation.isPending,
    clonePlan: clonePlanMutation.mutateAsync,
    isCloning: clonePlanMutation.isPending,
  };
}
