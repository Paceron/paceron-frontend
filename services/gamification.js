import api from './api.js';
import { USE_MOCKS } from '../config/env.js';

// POST /api/v1/users/{id}/gamification/seen -- Gap 34. Único endpoint
// compartido entre rachas/logros/competencias para marcar una sección
// como vista; el resto del mecanismo son flags `has_unseen` embebidos en
// cada recurso (streaks: Gap 30, achievements: Gap 31).
export async function ackGamificationSeen(userId, section) {
  if (USE_MOCKS) return;
  return await api.post(`/users/${userId}/gamification/seen`, { section });
}
