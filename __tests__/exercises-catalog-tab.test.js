// exercises-catalog-tab.jsx es un componente de UI con una cadena larga
// de dependencias (react-native-toast-message, @expo/vector-icons,
// theme/colors.js -> nativewind, hooks de datos, modales hijos). Varias
// de esas dependencias publican ESM puro en su entry point y no están
// cubiertas por transformIgnorePatterns (jest.config.js) — y el proyecto
// no hace tests de render de componentes (ver CLAUDE.md), así que no
// vale la pena ampliar ese allowlist global solo para poder importar dos
// funciones puras. En cambio, se mockea cada dependencia de UI/datos del
// archivo sin tocar los exports reales bajo test: sessionsUsingExercise
// y exercisesWithUsage se siguen importando y ejecutando desde el
// archivo real de abajo, no de una copia.
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('../theme/colors.js', () => ({ useThemeColors: () => ({}) }));
jest.mock('../store/auth-store.js', () => ({ useAuthStore: () => null }));
jest.mock('../hooks/use-exercises.js', () => ({
  useExercises: () => ({ exercises: [], loading: false }),
  useExerciseMutations: () => ({ deleteExercise: jest.fn(), cloneExercise: jest.fn() }),
}));
jest.mock('../hooks/use-sessions.js', () => ({ useSessions: () => ({ sessions: [] }) }));
jest.mock('../components/forms/section-card.jsx', () => ({ SectionCard: 'SectionCard' }));
jest.mock('../components/shared/animated-dropdown.jsx', () => ({ AnimatedDropdown: 'AnimatedDropdown' }));
jest.mock('../components/plans/exercise-kind-meta.js', () => ({
  EXERCISE_KIND_META: {},
  buildExerciseStatLine: () => '',
}));
jest.mock('../components/plans/create-exercise-modal.jsx', () => ({ CreateExerciseModal: 'CreateExerciseModal' }));
jest.mock('../components/plans/delete-catalog-item-modal.jsx', () => ({ DeleteCatalogItemModal: 'DeleteCatalogItemModal' }));
jest.mock('../components/plans/bulk-delete-exercises-modal.jsx', () => ({ BulkDeleteExercisesModal: 'BulkDeleteExercisesModal' }));
jest.mock('../components/plans/usage-list-modal.jsx', () => ({ UsageListModal: 'UsageListModal' }));

import { sessionsUsingExercise, exercisesWithUsage } from '../components/plans/exercises-catalog-tab.jsx';

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
