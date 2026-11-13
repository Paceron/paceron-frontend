// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true (Gap 31). Un ítem de cada
// familia, con el `leveled` a mitad de camino entre nivel 2 y 3 para poder
// ver la barra de progreso sin levantar backend. `has_unseen: true` en el
// leveled, para poder probar el punto rojo (Gap 34) sin esperar un
// desbloqueo real.
//
// `icon_key === id` (2026-11-13, confirmado por backend): es la clave
// semántica del logro, NUNCA un nombre de ícono real -- antes este mock
// tenía `icon_key` con valores que CASUALMENTE eran glyphs válidos
// (`star-outline`, `fire`, `medal-outline`), lo que escondía el bug real
// del backend (ahí `icon_key` es algo como `streak_7`, nada parecido a un
// glyph). `icon_name` es el campo nuevo con el glyph real; `fire` para
// `consecutive_trainings` es el mismo ejemplo que dio el backend
// (`streak_7` → `fire`).
const MOCK_CATALOG = [
  {
    id: 'first_training',
    family: 'once',
    name: 'Primera vez',
    description: 'Completaste tu primer entrenamiento.',
    icon_key: 'first_training',
    icon_name: 'star-outline',
    threshold: 1,
    unit: 'sessions',
  },
  {
    id: 'consecutive_trainings',
    family: 'leveled',
    name: 'Entrenamientos Consecutivos',
    description: 'Entrená días consecutivos sin cortar la racha.',
    icon_key: 'consecutive_trainings',
    icon_name: 'fire',
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
    icon_key: 'total_trainings',
    icon_name: 'calendar-check',
    counter_trophy_every: 1,
  },
];

const PROGRESS_SEED = [
  { achievement_id: 'first_training', count: 1, unlocked_at: '2026-09-01', last_unlocked_at: '2026-09-01', has_unseen: false },
  { achievement_id: 'consecutive_trainings', current_level: 2, count: 15, unlocked_at: '2026-09-15', last_unlocked_at: '2026-10-01', has_unseen: true },
  { achievement_id: 'total_trainings', count: 7, unlocked_at: '2026-09-01', last_unlocked_at: '2026-10-05', has_unseen: false },
];

// Mutable (no un const plano) para poder apagar `has_unseen` desde
// `mockAckAchievements` -- bug real, 2026-10-14: el punto rojo nunca se
// apagaba en modo mock porque `services/gamification.js#ackGamificationSeen`
// hacía early-return sin tocar nada cuando `USE_MOCKS` (no había ningún
// estado mutable al que avisarle).
let MOCK_PROGRESS = PROGRESS_SEED.map((p) => ({ ...p }));

export function mockAckAchievements() {
  MOCK_PROGRESS = MOCK_PROGRESS.map((p) => ({ ...p, has_unseen: false }));
}

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
