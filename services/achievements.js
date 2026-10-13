import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetAchievementsCatalog, mockGetUserAchievements, mockGetStamps } from './__mocks__/achievements-mock.js';

// Catálogo/stamps vienen envueltos en `{data: [...]}` (confirmado contra la
// implementación real, 2026-10-14); el endpoint de progreso no lo confirma
// explícito en el reporte de backend -- se desenvuelve igual acá, defensivo
// (si llega un array crudo, `?? response` lo deja pasar tal cual).
function unwrapList(response) {
  return response?.data ?? response;
}

// GET /api/v1/achievements/catalog -- Gap 31. Config estática, sin cambios
// por usuario.
export async function getAchievementsCatalog() {
  if (USE_MOCKS) return await mockGetAchievementsCatalog();
  return unwrapList(await api.get('/achievements/catalog'));
}

// GET /api/v1/users/{id}/achievements -- progreso real por logro.
export async function getUserAchievements(userId) {
  if (USE_MOCKS) return await mockGetUserAchievements();
  return unwrapList(await api.get(`/users/${userId}/achievements`));
}

// GET /api/v1/users/{id}/stamps -- estampas y trofeos emitidos (vitrina).
export async function getStamps(userId) {
  if (USE_MOCKS) return await mockGetStamps();
  return unwrapList(await api.get(`/users/${userId}/stamps`));
}
