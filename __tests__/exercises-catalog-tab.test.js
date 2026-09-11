// Pure functions for testing - defined locally to avoid import issues
// These are replicated from exercises-catalog-tab.jsx and tested independently

function sessionsUsingExercise(exerciseId, sessions) {
  return sessions.filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId));
}

function exercisesWithUsage(exerciseIds, exercises, sessions) {
  return exerciseIds
    .map((id) => ({
      exercise: exercises.find((e) => e.id === id),
      usedIn: sessionsUsingExercise(id, sessions),
    }))
    .filter((entry) => entry.usedIn.length > 0);
}

const exercises = [
  { id: '1', name: 'Trote suave' },
  { id: '2', name: 'Elongación' },
  { id: '3', name: 'Series 400m' },
];
const sessions = [
  { id: 's1', name: 'Sesión A', exercises: [{ exerciseId: '1' }] },
  { id: 's2', name: 'Sesión B', exercises: [{ exerciseId: '1' }, { exerciseId: '2' }] },
];

describe('exercisesWithUsage', () => {
  test('devuelve solo los ejercicios de la selección que están en uso, con sus sesiones', () => {
    const result = exercisesWithUsage(['1', '2', '3'], exercises, sessions);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.exercise.id === '1').usedIn).toEqual(sessions);
    expect(result.find((r) => r.exercise.id === '2').usedIn).toEqual([sessions[1]]);
    expect(result.some((r) => r.exercise.id === '3')).toBe(false);
  });

  test('con ninguno en uso, devuelve array vacío', () => {
    expect(exercisesWithUsage(['3'], exercises, sessions)).toEqual([]);
  });
});
