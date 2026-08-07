import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockUpdateUser, mockChangeStatus, mockSearchUsers } from './__mocks__/user-mock.js';

// PUT /api/v1/users/{id} — UserUpdateRequest. Cambiar el email requiere el header
// X-Current-Password con la contraseña actual.
export async function updateUser(id, payload, currentPassword) {
  if (USE_MOCKS) return await mockUpdateUser(id, payload);
  const headers = currentPassword ? { 'X-Current-Password': currentPassword } : undefined;
  return await api.put(`/users/${id}`, payload, headers);
}

// PATCH /api/v1/users/{id}/status — status: active|inactive|pause|blocked|suspended.
export async function changeStatus(id, status) {
  if (USE_MOCKS) return await mockChangeStatus(id, status);
  return await api.patch(`/users/${id}/status`, { status });
}

// GET /api/v1/users/search?q= — coincidencia parcial por nombre, apellido
// o email (autocompletar al invitar). Mínimo 3 caracteres, hasta 5
// resultados, según el backend. Devuelve el array directo (no el wrapper
// {results: [...]} de la respuesta cruda) para que el caller no tenga que
// desenvolverlo.
export async function searchUsers(query) {
  const dto = USE_MOCKS ? await mockSearchUsers(query) : await api.get(`/users/search?q=${encodeURIComponent(query)}`);
  return dto?.results ?? [];
}
