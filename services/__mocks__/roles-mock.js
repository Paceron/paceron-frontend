const ROLES_CATALOG = [
  { id: 1, name: 'corredor', description: 'Rol de corredor' },
  { id: 2, name: 'entrenador', description: 'Rol de entrenador' },
];

// Estado in-memory para simular asignación durante una sesión mock — a
// diferencia de los demás mocks del proyecto (que son puros), este
// necesita estado para que el flujo de activación se pueda probar de
// punta a punta con EXPO_PUBLIC_USE_MOCKS=true.
let mockAssignedRoles = ['corredor'];

export async function mockGetRoles() {
  return ROLES_CATALOG;
}

export async function mockAssignRole(_userId, roleId) {
  const role = ROLES_CATALOG.find((r) => r.id === roleId);
  if (role && !mockAssignedRoles.includes(role.name)) {
    mockAssignedRoles.push(role.name);
  }
  return { id: roleId, assigned: true };
}

export async function mockRemoveRole(_userId, roleId) {
  const role = ROLES_CATALOG.find((r) => r.id === roleId);
  if (role) {
    mockAssignedRoles = mockAssignedRoles.filter((name) => name !== role.name);
  }
  return { message: 'Rol removido correctamente.' };
}

export async function mockGetPermissions(userId) {
  return {
    user_id: userId,
    roles: mockAssignedRoles.map((name) => ({
      id: ROLES_CATALOG.find((r) => r.name === name).id,
      name,
      tier: 'base',
      permissions: name === 'entrenador' ? ['crear_equipos'] : [],
    })),
  };
}

export function __resetMockRoles() {
  mockAssignedRoles = ['corredor'];
}
