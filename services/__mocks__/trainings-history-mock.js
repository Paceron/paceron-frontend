const BASE_ITEMS = [
  {
    id: '9101',
    athlete_user_id: 1,
    athlete_name: 'Demo',
    team_id: 5,
    team_name: 'Atletas del Río',
    group_id: 1,
    group_name: 'Grupo A',
    session_instance_id: 9100,
    session_name: 'Fondo progresivo',
    exercise_id: 91001,
    exercise_name: 'Trote continuo',
    catalog_exercise_id: 101,
    set_number: 1,
    completion_status: 'completed',
    duration_ms: 1_320_000,
    active_duration_ms: 1_260_000,
    distance_meters: 4200,
    started_at: '2026-11-18T10:00:00Z',
    ended_at: '2026-11-18T10:22:00Z',
    is_presencial: false,
    date: '2026-11-18',
  },
  {
    id: '9102',
    athlete_user_id: 1,
    athlete_name: 'Demo',
    team_id: 5,
    team_name: 'Atletas del Río',
    group_id: 1,
    group_name: 'Grupo A',
    session_instance_id: 9101,
    session_name: 'Series cortas',
    exercise_id: 91002,
    exercise_name: 'Series 400 m',
    catalog_exercise_id: 102,
    set_number: 2,
    completion_status: 'completed',
    duration_ms: 540_000,
    active_duration_ms: 510_000,
    distance_meters: 1600,
    started_at: '2026-11-15T09:30:00Z',
    ended_at: '2026-11-15T09:39:00Z',
    is_presencial: true,
    date: '2026-11-15',
  },
  {
    id: '9103',
    athlete_user_id: 1,
    athlete_name: 'Demo',
    team_id: 5,
    team_name: 'Atletas del Río',
    group_id: 1,
    group_name: 'Grupo A',
    session_instance_id: 9102,
    session_name: 'Rodaje suave',
    exercise_id: 91003,
    exercise_name: 'Rodaje regenerativo',
    catalog_exercise_id: 103,
    set_number: 1,
    completion_status: 'completed',
    duration_ms: 1_800_000,
    active_duration_ms: 1_740_000,
    distance_meters: 5000,
    started_at: '2026-11-10T18:00:00Z',
    ended_at: '2026-11-10T18:30:00Z',
    is_presencial: false,
    date: '2026-11-10',
  },
  {
    id: '9104',
    athlete_user_id: 1,
    athlete_name: 'Demo',
    team_id: 5,
    team_name: 'Atletas del Río',
    group_id: 1,
    group_name: 'Grupo A',
    session_instance_id: 9103,
    session_name: 'Fartlek',
    exercise_id: 91004,
    exercise_name: 'Fartlek 6x1 min',
    catalog_exercise_id: 104,
    set_number: 1,
    completion_status: 'skipped',
    duration_ms: null,
    active_duration_ms: null,
    distance_meters: null,
    started_at: null,
    ended_at: null,
    is_presencial: false,
    date: '2026-10-28',
  },
  {
    id: '9105',
    athlete_user_id: 101,
    athlete_name: 'Lucía Fernández',
    team_id: 5,
    team_name: 'Atletas del Río',
    group_id: 1,
    group_name: 'Grupo A',
    session_instance_id: 9100,
    session_name: 'Fondo progresivo',
    exercise_id: 91001,
    exercise_name: 'Trote continuo',
    catalog_exercise_id: 101,
    set_number: 1,
    completion_status: 'completed',
    duration_ms: 1_440_000,
    active_duration_ms: 1_380_000,
    distance_meters: 4500,
    started_at: '2026-11-18T10:00:00Z',
    ended_at: '2026-11-18T10:24:00Z',
    is_presencial: false,
    date: '2026-11-18',
  },
  {
    id: '9106',
    athlete_user_id: 101,
    athlete_name: 'Lucía Fernández',
    team_id: 5,
    team_name: 'Atletas del Río',
    group_id: 1,
    group_name: 'Grupo A',
    session_instance_id: 9102,
    session_name: 'Rodaje suave',
    exercise_id: 91003,
    exercise_name: 'Rodaje regenerativo',
    catalog_exercise_id: 103,
    set_number: 1,
    completion_status: 'completed',
    duration_ms: 1_680_000,
    active_duration_ms: 1_620_000,
    distance_meters: 4800,
    started_at: '2026-11-10T18:00:00Z',
    ended_at: '2026-11-10T18:28:00Z',
    is_presencial: false,
    date: '2026-11-10',
  },
];

let items = BASE_ITEMS.map((item) => ({ ...item }));

export function __resetTrainingsHistoryMock() {
  items = BASE_ITEMS.map((item) => ({ ...item }));
}

export function __getMockTrainingsHistory() {
  return items.map((item) => ({ ...item }));
}

function toIsoDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
  const [day, month, year] = String(value).split('/');
  if (!day || !month || !year) return String(value);
  return `${year}-${month}-${day}`;
}

function matchesFilters(item, filters) {
  if (filters.teamId && String(item.team_id) !== String(filters.teamId)) return false;
  if (filters.groupId && String(item.group_id) !== String(filters.groupId)) return false;
  if (filters.exerciseId && String(item.catalog_exercise_id ?? item.exercise_id) !== String(filters.exerciseId)) return false;
  if (filters.setNumber && String(item.set_number) !== String(filters.setNumber)) return false;
  if (filters.athleteUserId && String(item.athlete_user_id) !== String(filters.athleteUserId)) return false;
  const from = toIsoDate(filters.dateFrom);
  const to = toIsoDate(filters.dateTo);
  if (from && item.date < from) return false;
  if (to && item.date > to) return false;
  return true;
}

function sortItems(list, filters) {
  const direction = filters.order === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const aKey = `${a.date}T${a.started_at ?? ''}`;
    const bKey = `${b.date}T${b.started_at ?? ''}`;
    return aKey.localeCompare(bKey) * direction;
  });
}

function buildResponse(scope, filters) {
  const pageSize = Number(filters.pageSize ?? 20);
  const page = Number(filters.page ?? 1);
  const sorted = sortItems(scope, filters);
  const start = (page - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);
  const athletes = new Map();
  const exercises = new Map();
  scope.forEach((item) => {
    athletes.set(String(item.athlete_user_id), { id: item.athlete_user_id, name: item.athlete_name });
    exercises.set(String(item.catalog_exercise_id ?? item.exercise_id), {
      id: item.catalog_exercise_id ?? item.exercise_id,
      name: item.exercise_name,
    });
  });
  return {
    items: pageItems,
    total: sorted.length,
    page,
    page_size: pageSize,
    available_athletes: Array.from(athletes.values()),
    available_exercises: Array.from(exercises.values()),
  };
}

export async function mockGetWorkoutFeedbackHistory(userId, filters = {}) {
  const scope = items.filter(
    (item) => String(item.athlete_user_id) === String(userId) && matchesFilters(item, filters),
  );
  return buildResponse(scope, filters);
}

export async function mockGetAdministeredWorkoutFeedbackHistory(userId, filters = {}) {
  const scope = items.filter((item) => matchesFilters(item, filters));
  return buildResponse(scope, filters);
}

export async function mockDeleteWorkoutFeedback(feedbackId) {
  items = items.filter((item) => String(item.id) !== String(feedbackId));
  return { success: true };
}
