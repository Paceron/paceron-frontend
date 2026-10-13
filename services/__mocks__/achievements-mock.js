// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true (Gap 31). Un ítem de cada
// familia, con el `leveled` a mitad de camino entre nivel 2 y 3 para poder
// ver la barra de progreso sin levantar backend. `has_unseen: true` en el
// leveled, para poder probar el punto rojo (Gap 34) sin esperar un
// desbloqueo real.
const MOCK_CATALOG = [
  {
    id: 'first_training',
    family: 'once',
    name: 'Primera vez',
    description: 'Completaste tu primer entrenamiento.',
    icon_key: 'star-outline',
    once_threshold: 1,
  },
  {
    id: 'consecutive_trainings',
    family: 'leveled',
    name: 'Entrenamientos Consecutivos',
    description: 'Entrená días consecutivos sin cortar la racha.',
    icon_key: 'fire',
    levels: [
      { level: 1, name: 'Chispa', threshold: 5 },
      { level: 2, name: 'Fuego', threshold: 10 },
      { level: 3, name: 'Imparable', threshold: 20 },
      { level: 4, name: 'Máquina', threshold: 40 },
      { level: 5, name: 'Leyenda', threshold: 100 },
    ],
    counter_trophy_every: 25,
  },
  {
    id: 'total_trainings',
    family: 'counter',
    name: 'Entrenamientos totales',
    description: 'Cada entrenamiento completado suma una estampa.',
    icon_key: 'medal-outline',
    counter_trophy_every: 1,
  },
];

const MOCK_PROGRESS = [
  { achievement_id: 'first_training', count: 1, unlocked_at: '2026-09-01', last_unlocked_at: '2026-09-01', has_unseen: false },
  { achievement_id: 'consecutive_trainings', current_level: 2, count: 15, unlocked_at: '2026-09-15', last_unlocked_at: '2026-10-01', has_unseen: true },
  { achievement_id: 'total_trainings', count: 7, unlocked_at: '2026-09-01', last_unlocked_at: '2026-10-05', has_unseen: false },
];

const MOCK_STAMPS = [
  { id: 1, type: 'achievement_counter', source_id: 'total_trainings', source_name: 'Entrenamientos totales', icon_key: 'medal-outline', granted_at: '2026-10-05', count: 7 },
  { id: 2, type: 'competition', source_id: 'comp-42', source_name: 'Desafío de octubre', icon_key: 'trophy', granted_at: '2026-09-20', count: 1 },
  { id: 3, type: 'post_legend', source_id: 'consecutive_trainings', source_name: 'Entrenamientos Consecutivos — más allá de Leyenda', icon_key: 'crown', granted_at: '2026-10-10', count: 1 },
];

export async function mockGetAchievementsCatalog() {
  return MOCK_CATALOG;
}

export async function mockGetUserAchievements() {
  return MOCK_PROGRESS;
}

export async function mockGetStamps() {
  return MOCK_STAMPS;
}
