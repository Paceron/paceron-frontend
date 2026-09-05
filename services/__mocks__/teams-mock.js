import { __seedDefaultGroup, __seedGroup, __seedGroupUser, __resetMockGroups } from './groups-mock.js';

// user_id del catálogo fijo de autocomplete (services/__mocks__/user-mock.js
// #SEARCH_CATALOG) — reusarlos acá hace que el roster sembrado resuelva
// nombre/email de verdad vía batchLookupUsers, en vez del placeholder
// genérico ("Corredor" + id) que usa mockBatchLookupUsers para ids
// desconocidos.
const FICTITIOUS_RUNNER_IDS = [101, 102, 103, 104, 105, 106];

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toTeamModel() funcione igual en ambas ramas) — mismo patrón stateful
// que roles-mock.js, necesario para probar crear→listar→editar de punta a
// punta con EXPO_PUBLIC_USE_MOCKS=true. owner_id: 1 en el primer equipo
// coincide con el user_id que devuelve auth-mock.js#mockLogin, para que el
// filtro de "mis equipos" (store/team-store.js#selectAdministeredTeams)
// tenga algo que mostrar contra el usuario demo.
//
// "Runners Mendoza" (id 4) es el único de los cuatro con roster sembrado —
// los otros tres (incluido "Corredores del Sur") quedan sin corredores a
// propósito, para poder probar el estado "¡Aún no hay corredores!" de la
// pestaña Corredores sin tener que vaciar nada a mano. Los 6 corredores
// ficticios quedan repartidos entre el grupo default ("General", 4) y uno
// extra ("Avanzado", 2) para poder probar el filtro de grupo también, con
// antigüedad escalonada (30 días de diferencia entre uno y el siguiente)
// para que no se vea la misma fecha en todas las filas.
function buildSeedTeams() {
  const now = new Date().toISOString();
  const teams = [
    {
      id: 1, name: 'Corredores del Sur', description: 'Equipo de running enfocado en fondo y medio fondo, entrenamos 3 veces por semana.',
      level: 'amateur', max_members: 20, owner_id: 1, requirements: 'Compromiso de asistencia y ritmo base de 6 min/km.',
      status: 'activo', visible: true, is_public: true, country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      created_at: now, updated_at: now,
    },
    {
      id: 2, name: 'Running Cordoba Norte', description: 'Grupo competitivo orientado a carreras de calle de 10K y 21K.',
      level: 'semi-profesional', max_members: 20, owner_id: 99, requirements: 'Experiencia previa en carreras de calle.',
      status: 'activo', visible: true, is_public: true, country: 'ARG', province: 'CD', city: 'Córdoba Capital', street: null, number: null,
      created_at: now, updated_at: now,
    },
    {
      id: 3, name: 'Maraton Runners', description: 'Preparación específica para maratón y ultramaratón.',
      level: 'profesional', max_members: 20, owner_id: 99, requirements: 'Base aeróbica mínima de 60km semanales.',
      status: 'activo', visible: true, is_public: true, country: 'ARG', province: 'SF', city: 'Rosario', street: null, number: null,
      created_at: now, updated_at: now,
    },
    {
      id: 4, name: 'Runners Mendoza', description: 'Grupo social de running para todos los niveles — salidas los martes y jueves a la tarde.',
      level: 'amateur', max_members: 20, owner_id: 1, requirements: 'Ganas de correr, no hace falta experiencia previa.',
      status: 'activo', visible: true, is_public: true, country: 'ARG', province: 'MZ', city: 'Mendoza Capital', street: null, number: null,
      created_at: now, updated_at: now,
    },
  ];

  const defaultGroupByTeamId = new Map(teams.map((t) => [t.id, __seedDefaultGroup(t.id)]));

  const advancedGroup = __seedGroup(4, 'Avanzado', { description: 'Corredores con mayor volumen y ritmo.' });
  const generalGroupId = defaultGroupByTeamId.get(4).id;
  const teamUsers = {
    4: FICTITIOUS_RUNNER_IDS.map((userId, i) => ({
      id: 1000 + userId,
      user_id: userId,
      team_id: 4,
      role_in_team: 'corredor',
      status: 'active',
      assignment_date: daysAgoIso((i + 1) * 30),
    })),
  };
  FICTITIOUS_RUNNER_IDS.forEach((userId, i) => {
    __seedGroupUser(i < 4 ? generalGroupId : advancedGroup.id, userId);
  });

  return { teams, teamUsers };
}

let { teams: mockTeams, teamUsers: mockTeamUsers } = buildSeedTeams();
let nextId = 5;

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
  if (payload.create_default_group) __seedDefaultGroup(team.id);
  return team;
}

export async function mockGetTeam(teamId) {
  return findTeamOrThrow(teamId);
}

export async function mockListTeams({ ownerId, memberId } = {}) {
  let result = mockTeams;
  if (ownerId != null) result = result.filter((t) => t.owner_id === ownerId);
  if (memberId != null) result = result.filter((t) => (mockTeamUsers[t.id] ?? []).some((u) => u.user_id === memberId));
  return [...result];
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
  __resetMockGroups();
  ({ teams: mockTeams, teamUsers: mockTeamUsers } = buildSeedTeams());
  nextId = 5;
}

export function __getMockTeamName(teamId) {
  return mockTeams.find((t) => String(t.id) === String(teamId))?.name ?? null;
}

export function __getMockTeamOwnerId(teamId) {
  return mockTeams.find((t) => String(t.id) === String(teamId))?.owner_id ?? null;
}

// Getter de solo lectura sobre el array completo — usado por
// join-requests-mock.js para simular GET /teams/search sin duplicar el
// seed de equipos. Devuelve una copia (no la referencia) para que un
// caller no pueda mutar mockTeams por accidente vía este atajo.
export function __getAllMockTeams() {
  return [...mockTeams];
}

// Mismo criterio que mockUploadUserPhoto (user-mock.js) — el mock "hace
// como que subió", devolviendo el URI local recibido como si fuera la
// URL ya subida. A diferencia de la foto de usuario (un solo estado
// global), el ícono se guarda directo en el objeto del equipo dentro de
// mockTeams (ya es stateful in-memory, mismo patrón que mockUpdateTeam).
export async function mockUploadTeamIcon(teamId, uri) {
  const team = findTeamOrThrow(teamId);
  team.icon_url = uri;
  return { icon_url: uri };
}

export async function mockDeleteTeamIcon(teamId) {
  const team = findTeamOrThrow(teamId);
  team.icon_url = null;
  return null;
}
