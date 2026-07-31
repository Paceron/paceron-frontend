// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toGroupModel() funcione igual en ambas ramas) — mismo patrón que
// teams-mock.js. __seedDefaultGroup existe para que teams-mock.js pueda
// simular el efecto de create_default_group: true en POST /teams (el
// backend crea el grupo principal como side-effect de crear el equipo,
// este mock hace lo mismo).
let mockGroups = [];
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

export function __seedDefaultGroup(teamId) {
  const now = new Date().toISOString();
  const group = {
    id: nextGroupId++, team_id: Number(teamId), name: 'General', description: null, is_main: true,
    created_at: now, updated_at: now,
  };
  mockGroups.push(group);
  return group;
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

export async function mockGetGroupUsers(_groupId) {
  return [];
}

export function __resetMockGroups() {
  mockGroups = [];
  nextGroupId = 1;
}
