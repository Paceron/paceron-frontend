import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockRegisterPushToken } from './__mocks__/notifications-mock.js';

// POST /api/v1/push-tokens — self-only (el user_id sale del JWT). Upsert
// por token: re-registrar el mismo token con otra sesión reasigna el
// dueño solo, no hace falta desvincular en logout (ver
// docs/BACKEND_NOTIFICATIONS_REQUIREMENTS.md).
export async function registerPushToken(token, platform) {
  if (USE_MOCKS) return await mockRegisterPushToken(token, platform);
  return await api.post('/push-tokens', { token, platform });
}
