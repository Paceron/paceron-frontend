import api from './api.js';
import { USE_MOCKS } from '../config/env.js';

// POST /api/v1/users/{id}/gamification/seen -- Gap 34. Único endpoint
// compartido entre rachas/logros/competencias para marcar una sección
// como vista; el resto del mecanismo son flags `has_unseen` embebidos en
// cada recurso (streaks: Gap 30, achievements: Gap 31, competitions: Gap
// 33). `teamId` solo aplica (y solo lo acepta el backend) con
// `section: 'competitions'` -- confirmado contra la implementación real,
// 2026-10-14: sin `team_id`, limpia TODAS las filas de competencias de
// todos los equipos, no solo una.
export async function ackGamificationSeen(userId, section, teamId) {
  if (USE_MOCKS) return;
  const body = teamId != null ? { section, team_id: teamId } : { section };
  return await api.post(`/users/${userId}/gamification/seen`, body);
}
