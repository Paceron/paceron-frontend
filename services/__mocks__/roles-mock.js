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

// POST /users/{id}/trainer-role — a diferencia de mockAssignRole (genérico,
// sin password), este simula la validación de contraseña que el endpoint
// real exige.
export async function mockActivateTrainerRole(userId, { password, bankAlias }) {
  if (!password) {
    const error = new Error('La contraseña es requerida.');
    error.status = 400;
    throw error;
  }
  if (!mockAssignedRoles.includes('entrenador')) {
    mockAssignedRoles.push('entrenador');
  }
  return {
    id: 1, user_id: userId, role_id: 2, tier_id: 1, status: 'active', assignment_date: new Date().toISOString(),
  };
}

// DELETE /users/{id}/trainer-role — el mock no simula el bloqueo por
// "lidera equipos activos" (409): no hay estado de equipos en este mock,
// se agrega si algún test lo llega a necesitar.
export async function mockDeactivateTrainerRole(_userId) {
  mockAssignedRoles = mockAssignedRoles.filter((name) => name !== 'entrenador');
  return { message: 'Rol entrenador desactivado.' };
}

export function __resetMockRoles() {
  mockAssignedRoles = ['corredor'];
}
