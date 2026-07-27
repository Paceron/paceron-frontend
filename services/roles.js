import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetRoles, mockAssignRole, mockRemoveRole, mockGetPermissions } from './__mocks__/roles-mock.js';

// Catálogo estático del backend — se cachea en memoria de módulo (no en
// el store de Zustand, que es para estado de sesión) y se pide una sola
// vez, no en cada asignación de rol.
let rolesCache = null;

// GET /api/v1/roles (público)
export async function getRoles() {
  if (rolesCache) return rolesCache;
  rolesCache = USE_MOCKS ? await mockGetRoles() : await api.get('/roles');
  return rolesCache;
}

// Resuelve el role_id por nombre — evita hardcodear IDs numéricos en el
// resto del código.
export async function getRoleIdByName(name) {
  const roles = await getRoles();
  const role = roles.find((r) => r.name === name);
  if (!role) throw new Error(`Rol "${name}" no encontrado en el catálogo.`);
  return role.id;
}

// POST /api/v1/users/{id}/roles — tier_id se omite a propósito: el
// backend usa el tier "base" del rol por default. 409 = ya asignado, se
// trata como éxito (no-op), no como error.
export async function assignRole(userId, roleName) {
  const roleId = await getRoleIdByName(roleName);
  if (USE_MOCKS) return await mockAssignRole(userId, roleId);
  try {
    return await api.post(`/users/${userId}/roles`, { role_id: roleId });
  } catch (error) {
    if (error.status === 409) return { alreadyAssigned: true };
    throw error;
  }
}

// DELETE /api/v1/users/{id}/roles/{role_id} — no toca bank_alias, se
// mantiene guardado a propósito para una reactivación futura.
export async function removeRole(userId, roleName) {
  const roleId = await getRoleIdByName(roleName);
  if (USE_MOCKS) return await mockRemoveRole(userId, roleId);
  return await api.delete(`/users/${userId}/roles/${roleId}`);
}

// GET /api/v1/auth/permissions?user_id= — única fuente de verdad de qué
// roles tiene un usuario (no existe en /auth/user ni en UserResponse).
export async function getPermissions(userId) {
  if (USE_MOCKS) return await mockGetPermissions(userId);
  return await api.get(`/auth/permissions?user_id=${encodeURIComponent(userId)}`);
}
