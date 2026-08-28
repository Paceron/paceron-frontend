import { create } from 'zustand';
import {
  listExercises as listExercisesService,
  createExercise as createExerciseService,
} from '../services/exercises.js';
import { toExerciseModel, toCreateExercisePayload } from '../services/normalizers.js';

// Catálogo de ejercicios del entrenador — ver enmienda 2026-08-26 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md. Solo
// list/create por ahora: el alta rápida (CreateExerciseModal, abierta
// desde adentro de armar una sesión) es todo lo que se pidió — editar/
// borrar un ejercicio suelto es una pantalla de catálogo aparte, "otro
// menú" a futuro, fuera de esta entrega.
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
}));
