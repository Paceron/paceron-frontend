// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toGroupModel() funcione igual en ambas ramas) — mismo patrón que
// teams-mock.js. __seedDefaultGroup existe para que teams-mock.js pueda
// simular el efecto de create_default_group: true en POST /teams (el
// backend crea el grupo principal como side-effect de crear el equipo,
// este mock hace lo mismo).
let mockGroups = [];
let mockGroupUsers = {};
let nextGroupId = 1;

function findGroupOrThrow(groupId) {
  const group = mockGroups.find((g) => String(g.id) === String(groupId));
  if (!group) {
    const error = new Error('Grupo no encontrado.');
    error.status = 404;
    throw error;
  }
  return group;
}

// Helper síncrono compartido por __seedDefaultGroup y por teams-mock.js
// (siembra de "Runners Mendoza", el único equipo mock con roster de
// prueba) — mismo motivo que __seedDefaultGroup: setup de datos, no una
// llamada real a la API, así que no hace falta que sea async como el resto.
export function __seedGroup(teamId, name, { isMain = false, description = null } = {}) {
  const now = new Date().toISOString();
  const group = {
    id: nextGroupId++, team_id: Number(teamId), name, description, is_main: isMain,
    created_at: now, updated_at: now,
  };
  mockGroups.push(group);
  return group;
}

export function __seedDefaultGroup(teamId) {
  return __seedGroup(teamId, 'General', { isMain: true });
}

// Idem __seedGroup pero para la membresía — evita el Date.now() sin
// desambiguar de mockAddGroupUser, que colisiona si se siembran varios
// usuarios en el mismo tick.
export function __seedGroupUser(groupId, userId) {
  const entry = { id: Date.now() + userId, group_id: Number(groupId), user_id: userId, date_start: new Date().toISOString(), date_end: null };
  mockGroupUsers[groupId] = [...(mockGroupUsers[groupId] ?? []), entry];
  return entry;
}

export async function mockListGroups(teamId, _userId) {
  return mockGroups.filter((g) => String(g.team_id) === String(teamId));
}

export async function mockGetGroup(groupId) {
  return findGroupOrThrow(groupId);
}

export async function mockCreateGroup(payload) {
  const now = new Date().toISOString();
  const group = {
    id: nextGroupId++, team_id: payload.team_id, name: payload.name, description: payload.description ?? null,
    is_main: false, created_at: now, updated_at: now,
  };
  mockGroups.push(group);
  return group;
}

export async function mockUpdateGroup(groupId, updates) {
  const group = findGroupOrThrow(groupId);
  Object.assign(group, updates, { updated_at: new Date().toISOString() });
  return group;
}

export async function mockDeleteGroup(groupId) {
  mockGroups = mockGroups.filter((g) => String(g.id) !== String(groupId));
  return null;
}

export async function mockGetGroupUsers(groupId) {
  return mockGroupUsers[groupId] ?? [];
}

export async function mockAddGroupUser(teamId, groupId, userId) {
  const entry = { id: Date.now(), group_id: Number(groupId), user_id: userId, date_start: new Date().toISOString(), date_end: null };
  mockGroupUsers[groupId] = [...(mockGroupUsers[groupId] ?? []), entry];
  return entry;
}

export async function mockRemoveGroupUser(groupId, userId) {
  mockGroupUsers[groupId] = (mockGroupUsers[groupId] ?? []).filter((u) => u.user_id !== userId);
  return { message: 'Usuario quitado del grupo.' };
}

export function __resetMockGroups() {
  mockGroups = [];
  mockGroupUsers = {};
  nextGroupId = 1;
}
