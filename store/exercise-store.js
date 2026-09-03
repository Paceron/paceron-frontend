import { create } from 'zustand';
import {
  listExercises as listExercisesService,
  createExercise as createExerciseService,
  updateExercise as updateExerciseService,
  deleteExercise as deleteExerciseService,
} from '../services/exercises.js';
import { toExerciseModel, toCreateExercisePayload } from '../services/normalizers.js';

// Catálogo de ejercicios del entrenador — ver enmienda 2026-08-26 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md y el ABM
// completo de docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md
// (pestaña "Ejercicios" en Planes de entrenamiento).
export const EXERCISE_KIND_OPTIONS = [
  { id: 'walking', name: 'Caminata' },
  { id: 'jogging', name: 'Trote suave' },
  { id: 'elongation', name: 'Elongación' },
  { id: 'cruising', name: 'Ritmo continuo' },
  { id: 'running', name: 'Corrida' },
];

export const useExerciseStore = create((set) => ({
  exercises: [],

  fetchExercises: async (ownerId) => {
    try {
      const dtos = await listExercisesService({ ownerId });
      set({ exercises: dtos.map(toExerciseModel) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  createExercise: async (form) => {
    try {
      const created = await createExerciseService(toCreateExercisePayload(form));
      const exercise = toExerciseModel(created);
      set((state) => ({ exercises: [...state.exercises, exercise] }));
      return { success: true, exercise };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updateExercise: async (exerciseId, form) => {
    try {
      const updated = await updateExerciseService(exerciseId, toCreateExercisePayload(form));
      const exercise = toExerciseModel(updated);
      set((state) => ({ exercises: state.exercises.map((e) => (e.id === exerciseId ? exercise : e)) }));
      return { success: true, exercise };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  deleteExercise: async (exerciseId) => {
    try {
      await deleteExerciseService(exerciseId);
      set((state) => ({ exercises: state.exercises.filter((e) => e.id !== exerciseId) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
