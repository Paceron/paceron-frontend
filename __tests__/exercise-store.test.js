import { useExerciseStore, EXERCISE_KIND_OPTIONS } from '../store/exercise-store.js';

jest.mock('../services/exercises.js', () => ({
  listExercises: jest.fn(),
  createExercise: jest.fn(),
}));

import { listExercises as listExercisesService, createExercise as createExerciseService } from '../services/exercises.js';

const EXERCISE_DTO = { id: 1, owner_id: 7, name: 'Trote suave', kind: 'jogging', minutes: 20, distance_m: null, speed_kph: null, video_url: null, created_at: '', updated_at: '' };

beforeEach(() => {
  jest.clearAllMocks();
  useExerciseStore.setState({ exercises: [] });
});

describe('exercise store', () => {
  test('EXERCISE_KIND_OPTIONS cubre los 5 tipos hoja', () => {
    expect(EXERCISE_KIND_OPTIONS.map((o) => o.id).sort()).toEqual(['cruising', 'elongation', 'jogging', 'running', 'walking']);
  });

  test('fetchExercises trae y normaliza el catálogo', async () => {
    listExercisesService.mockResolvedValue([EXERCISE_DTO]);
    const result = await useExerciseStore.getState().fetchExercises(7);
    expect(listExercisesService).toHaveBeenCalledWith({ ownerId: 7 });
    expect(result.success).toBe(true);
    const { exercises } = useExerciseStore.getState();
    expect(exercises).toHaveLength(1);
    expect(exercises[0].id).toBe('1');
    expect(exercises[0].minutes).toBe(20);
  });

  test('createExercise agrega el ejercicio creado a la lista', async () => {
    createExerciseService.mockResolvedValue(EXERCISE_DTO);
    const result = await useExerciseStore.getState().createExercise({ ownerId: 7, name: 'Trote suave', kind: 'jogging', minutes: 20 });
    expect(result.success).toBe(true);
    expect(useExerciseStore.getState().exercises).toContainEqual(result.exercise);
  });

  test('fetchExercises devuelve error legible si el servicio falla', async () => {
    listExercisesService.mockRejectedValue(new Error('falló'));
    const result = await useExerciseStore.getState().fetchExercises(7);
    expect(result).toEqual({ success: false, error: 'falló' });
  });
});
