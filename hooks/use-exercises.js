import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listExercises as listExercisesService,
  createExercise as createExerciseService,
  updateExercise as updateExerciseService,
  deleteExercise as deleteExerciseService,
} from '../services/exercises.js';
import { toExerciseModel, toCreateExercisePayload } from '../services/normalizers.js';

// Catálogo de ejercicios del entrenador — TanStack Query, no Zustand (ver
// CLAUDE.md). Sin backend real todavía (services/exercises.js tiene
// FORCE_MOCKS=true, ver docs/BACKEND_API_GAPS.md gap 4) — esta migración
// no cambia esa capa, solo el estado que la envuelve.
export const EXERCISE_KIND_OPTIONS = [
  { id: 'walking', name: 'Caminata' },
  { id: 'jogging', name: 'Trote' },
  { id: 'elongation', name: 'Elongación' },
  { id: 'cruising', name: 'Ritmo continuo' },
  { id: 'running', name: 'Corrida' },
];

export const MUSCLE_GROUP_OPTIONS = [
  { id: 'cuadriceps', name: 'Cuádriceps' },
  { id: 'isquiotibiales', name: 'Isquiotibiales' },
  { id: 'gemelos', name: 'Gemelos (pantorrillas)' },
  { id: 'gluteos', name: 'Glúteos' },
  { id: 'aductores', name: 'Aductores' },
  { id: 'psoas', name: 'Psoas / flexores de cadera' },
  { id: 'lumbares', name: 'Zona lumbar / cadena posterior' },
  { id: 'core', name: 'Core / abdominales' },
];

export function useExercises(ownerId) {
  const query = useQuery({
    queryKey: ['exercises', ownerId],
    queryFn: () => listExercisesService({ ownerId }).then((dtos) => dtos.map(toExerciseModel)),
    enabled: Boolean(ownerId),
  });
  return { exercises: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useExerciseMutations() {
  const queryClient = useQueryClient();

  const createExerciseMutation = useMutation({
    mutationFn: async ({ form }) => {
      try {
        const created = await createExerciseService(toCreateExercisePayload(form));
        return { success: true, exercise: toExerciseModel(created) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['exercises', variables.ownerId] });
    },
  });

  const updateExerciseMutation = useMutation({
    mutationFn: async ({ exerciseId, form }) => {
      try {
        const updated = await updateExerciseService(exerciseId, toCreateExercisePayload(form));
        return { success: true, exercise: toExerciseModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['exercises', variables.ownerId] });
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async ({ exerciseId }) => {
      try {
        await deleteExerciseService(exerciseId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['exercises', variables.ownerId] });
    },
  });

  return {
    createExercise: createExerciseMutation.mutateAsync,
    isCreating: createExerciseMutation.isPending,
    updateExercise: updateExerciseMutation.mutateAsync,
    isUpdating: updateExerciseMutation.isPending,
    deleteExercise: deleteExerciseMutation.mutateAsync,
    isDeleting: deleteExerciseMutation.isPending,
  };
}
