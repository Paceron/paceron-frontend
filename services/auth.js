import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockLogin, mockRegister, mockGetUser, mockRefresh, mockLogout } from './__mocks__/auth-mock.js';

// POST /api/v1/auth/login → { user, authorization }
export async function login(email, password) {
  if (USE_MOCKS) return await mockLogin(email, password);
  return await api.post('/auth/login', { email, password });
}

// POST /api/v1/auth/register → RegisterResponse (sin token). 409 si email duplicado.
export async function register(payload) {
  if (USE_MOCKS) return await mockRegister(payload);
  return await api.post('/auth/register', payload);
}

// GET /api/v1/auth/user?id=|email= → RegisterResponse (DTO crudo, sin auth).
export async function getUser({ id, email }) {
  if (USE_MOCKS) return await mockGetUser({ id, email });
  const query = id != null && id !== '' ? `id=${encodeURIComponent(id)}` : `email=${encodeURIComponent(email)}`;
  return await api.get(`/auth/user?${query}`);
}

// POST /api/v1/auth/refresh — auth.RefreshRequest {refresh_token} →
// auth.RefreshResponse {access_token, refresh_token, expires_in}. Rota el
// refresh token: el que se manda queda revocado, el que vuelve es el
// vigente a partir de ahora.
// skipAuthRefresh obligatorio acá: este mismo endpoint es el que llama el
// interceptor de 401 de services/api.js cuando CUALQUIER OTRA request
// vence. Si /auth/refresh devuelve 401 (refresh token vencido/revocado,
// ej. tras un reset de backend) y este call NO pasa skipAuthRefresh, esa
// respuesta vuelve a entrar al MISMO interceptor -- que ve el
// `refreshPromise` module-level ya seteado (es justo la llamada en curso
// que disparó este request) y se queda esperando esa misma promesa
// resolver a sí misma: deadlock real, la app queda colgada sin loguear
// nunca el error ni cerrar sesión (bug real reportado, 2026-10-08, "el
// sistema me dejaba en un limbo" -- requería cerrar sesión a mano porque
// ningún código después de ese await llegaba a correr nunca).
export async function refresh(refreshToken) {
  if (USE_MOCKS) return await mockRefresh(refreshToken);
  return await api.post('/auth/refresh', { refresh_token: refreshToken }, { skipAuthRefresh: true });
}

// POST /api/v1/auth/logout — auth.LogoutRequest {refresh_token}. Revoca el
// refresh token; el access token sigue válido hasta su expiración natural
// (según el swagger), no hay forma de invalidarlo antes desde el cliente.
export async function logout(refreshToken) {
  if (USE_MOCKS) return await mockLogout(refreshToken);
  return await api.post('/auth/logout', { refresh_token: refreshToken });
}
