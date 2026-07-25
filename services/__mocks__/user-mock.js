// Mock del update: devuelve el usuario con los cambios aplicados (shape UserUpdateResponse).
export async function mockUpdateUser(id, payload) {
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
