// Estado in-memory para simular persistencia del alias entre updateUser y
// getUser durante una sesión mock — igual que roles-mock.js con
// mockAssignedRoles, necesario para probar de punta a punta el flujo de
// baja/reactivación de entrenador con EXPO_PUBLIC_USE_MOCKS=true (sin esto,
// refreshUser() pisaría el alias recién guardado con el null fijo de
// mockGetUser).
let mockBankAlias = null;

export function getMockBankAlias() {
  return mockBankAlias;
}

// Mock del update: devuelve el usuario con los cambios aplicados (shape UserUpdateResponse).
export async function mockUpdateUser(id, payload) {
  if ('bank_alias' in payload) mockBankAlias = payload.bank_alias;
  return {
    user_id: id,
    status: 'active',
    ...payload,
  };
}

// Mock del cambio de status: devuelve el usuario con el nuevo status (shape UserUpdateResponse).
export async function mockChangeStatus(id, status) {
  return {
    user_id: id,
    name: 'Demo',
    surname: 'User',
    email: 'demo@paceron.com',
    status,
  };
}
