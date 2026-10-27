import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockAckStreaks } from './__mocks__/streaks-mock.js';
import { mockAckAchievements } from './__mocks__/achievements-mock.js';

// POST /api/v1/users/{id}/gamification/seen -- Gap 34. Único endpoint
// compartido entre rachas/logros/competencias para marcar una sección
// como vista; el resto del mecanismo son flags `has_unseen` embebidos en
// cada recurso (streaks: Gap 30, achievements: Gap 31, competitions: Gap
// 33). `teamId` solo aplica (y solo lo acepta el backend) con
// `section: 'competitions'` -- confirmado contra la implementación real,
// 2026-10-14: sin `team_id`, limpia TODAS las filas de competencias de
// todos los equipos, no solo una.
//
// En modo mock, antes era un no-op puro (`if (USE_MOCKS) return`) -- bug
// real reportado 2026-10-14: el punto rojo nunca se apagaba, porque no
// había ningún estado mutable al que avisarle. `competitions` no suma nada
// acá a propósito: su `has_unseen` sale 100% de datos (hay o no una fila
// `pending_approval`), acusar la sección no cambia ese estado ni en mock ni
// contra el backend real.
export async function ackGamificationSeen(userId, section, teamId) {
  if (USE_MOCKS) {
    if (section === 'streaks') mockAckStreaks();
    if (section === 'achievements') mockAckAchievements();
    return;
  }
  // `teamId` llega como string (toTeamModel normaliza `id: String(dto.id)`)
  // -- el backend rechaza `team_id` no numérico en el body ("cannot
  // unmarshal string into... int64"), bug real 2026-10-24, mismo patrón ya
  // documentado en CLAUDE.md para `addGroupUser`.
  const body = teamId != null ? { section, team_id: Number(teamId) } : { section };
  return await api.post(`/users/${userId}/gamification/seen`, body);
}
