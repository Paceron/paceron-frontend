import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockUpdateUser } from './__mocks__/user-mock.js';

// PUT /api/v1/users/{id} — UserUpdateRequest. Cambiar el email requiere el header
// X-Current-Password con la contraseña actual.
export async function updateUser(id, payload, currentPassword) {
  if (USE_MOCKS) return await mockUpdateUser(id, payload);
  const headers = currentPassword ? { 'X-Current-Password': currentPassword } : undefined;
  return await api.put(`/users/${id}`, payload, headers);
}
