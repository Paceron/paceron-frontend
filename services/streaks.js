import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetStreaks } from './__mocks__/streaks-mock.js';

// GET /api/v1/users/{id}/streaks?days= -- Gap 30. Cálculo 100% server-side,
// sin tabla de rachas del lado backend ni recálculo local del lado cliente
// -- esta función solo pide y devuelve el DTO crudo (snake_case).
export async function getStreaks(userId, days = 42) {
  if (USE_MOCKS) return await mockGetStreaks(days);
  return await api.get(`/users/${userId}/streaks?days=${days}`);
}
