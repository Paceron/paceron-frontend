// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toTeamModel() funcione igual en ambas ramas) — mismo patrón stateful
// que roles-mock.js, necesario para probar crear→listar→editar de punta a
// punta con EXPO_PUBLIC_USE_MOCKS=true. owner_id: 1 en el primer equipo
// coincide con el user_id que devuelve auth-mock.js#mockLogin, para que el
// filtro de "mis equipos" (store/team-store.js#selectAdministeredTeams)
// tenga algo que mostrar contra el usuario demo.
function buildSeedTeams() {
  const now = new Date().toISOString();
  return [
    {
      id: 1, name: 'Corredores del Sur', description: 'Equipo de running enfocado en fondo y medio fondo, entrenamos 3 veces por semana.',
      level: 'amateur', max_members: 20, owner_id: 1, requirements: 'Compromiso de asistencia y ritmo base de 6 min/km.',
      status: 'activo', country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      created_at: now, updated_at: now,
    },
    {
      id: 2, name: 'Running Cordoba Norte', description: 'Grupo competitivo orientado a carreras de calle de 10K y 21K.',
      level: 'semi-profesional', max_members: 20, owner_id: 99, requirements: 'Experiencia previa en carreras de calle.',
      status: 'activo', country: 'ARG', province: 'CD', city: 'Córdoba Capital', street: null, number: null,
      created_at: now, updated_at: now,
    },
    {
      id: 3, name: 'Maraton Runners', description: 'Preparación específica para maratón y ultramaratón.',
      level: 'profesional', max_members: 20, owner_id: 99, requirements: 'Base aeróbica mínima de 60km semanales.',
      status: 'activo', country: 'ARG', province: 'SF', city: 'Rosario', street: null, number: null,
      created_at: now, updated_at: now,
    },
  ];
}

let mockTeams = buildSeedTeams();
let mockTeamUsers = {};
let nextId = 4;

function findTeamOrThrow(teamId) {
  const team = mockTeams.find((t) => String(t.id) === String(teamId));
  if (!team) {
    const error = new Error('Equipo no encontrado.');
    error.status = 404;
    throw error;
  }
  return team;
}

export async function mockCreateTeam(payload) {
  const now = new Date().toISOString();
  const team = {
    id: nextId++,
    name: payload.name,
    description: payload.description ?? null,
    level: payload.level ?? null,
    max_members: payload.max_members,
    owner_id: payload.owner_id,
    requirements: payload.requirements ?? null,
    status: 'activo',
    country: null,
    province: null,
    city: null,
    street: null,
    number: null,
    created_at: now,
    updated_at: now,
  };
  mockTeams.push(team);
  return team;
}

export async function mockGetTeam(teamId) {
  return findTeamOrThrow(teamId);
}

export async function mockListTeams() {
  return [...mockTeams];
}

export async function mockUpdateTeam(teamId, updates) {
  const team = findTeamOrThrow(teamId);
  Object.assign(team, updates, { updated_at: new Date().toISOString() });
  return team;
}

export async function mockUpdateTeamAddress(teamId, address) {
  const team = findTeamOrThrow(teamId);
  Object.assign(team, address, { updated_at: new Date().toISOString() });
  return team;
}

export async function mockDeleteTeam(teamId, _userId) {
  mockTeams = mockTeams.filter((t) => String(t.id) !== String(teamId));
  return null;
}

export async function mockGetTeamUsers(teamId) {
  return mockTeamUsers[teamId] ?? [];
}

export async function mockAddTeamUser(teamId, userId, roleInTeam) {
  const entry = {
    id: Date.now(),
    user_id: userId,
    team_id: Number(teamId),
    role_in_team: roleInTeam,
    status: 'active',
    assignment_date: new Date().toISOString(),
  };
  mockTeamUsers[teamId] = [...(mockTeamUsers[teamId] ?? []), entry];
  return entry;
}

export async function mockRemoveTeamUser(teamId, userId) {
  mockTeamUsers[teamId] = (mockTeamUsers[teamId] ?? []).filter((u) => u.user_id !== userId);
  return null;
}

export function __resetMockTeams() {
  mockTeams = buildSeedTeams();
  mockTeamUsers = {};
  nextId = 4;
}
