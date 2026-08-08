import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockUpdateUser, mockChangeStatus, mockSearchUsers, mockBatchLookupUsers, mockChangePassword } from './__mocks__/user-mock.js';

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

// GET /api/v1/users?ids=1,2,3 — resuelve nombre/apellido/email para
// varios user_id de una sola consulta (hasta 50, según el backend).
// Reemplaza el fan-out N+1 que hacía hooks/use-team-roster.js contra
// GET /auth/user?id= uno por uno (ver docs/BACKEND_API_GAPS.md,
// gap ya resuelto).
export async function batchLookupUsers(ids) {
  if (ids.length === 0) return [];
  const dto = USE_MOCKS ? await mockBatchLookupUsers(ids) : await api.get(`/users?ids=${ids.join(',')}`);
  return dto?.results ?? [];
}

// PATCH /api/v1/users/{id}/password — distinto del flujo OTP de
// forgot/reset-password. skipAuthRefresh: un 401 acá es "contraseña actual
// incorrecta" (negocio), no "sesión vencida" — mismo caso que
// activateTrainerRole (services/roles.js).
export async function changePassword(id, { currentPassword, newPassword, confirmPassword }) {
  const payload = { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword };
  if (USE_MOCKS) return await mockChangePassword(id, payload);
  return await api.patch(`/users/${id}/password`, payload, { skipAuthRefresh: true });
}
