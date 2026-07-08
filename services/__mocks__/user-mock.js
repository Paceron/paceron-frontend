// Mock del update: devuelve el usuario con los cambios aplicados (shape UserUpdateResponse).
export async function mockUpdateUser(id, payload) {
  return {
    user_id: id,
    status: 'active',
    ...payload,
  };
}
