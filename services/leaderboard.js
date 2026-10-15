import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetTeamLeaderboard } from './__mocks__/leaderboard-mock.js';

// GET /api/v1/teams/{id}/leaderboard -- Gap 32. `from`/`to` solo se mandan
// si vienen (period=custom); el resto de los períodos los resuelve el
// backend.
export async function getTeamLeaderboard(teamId, { metric, period, from, to } = {}) {
  if (USE_MOCKS) return await mockGetTeamLeaderboard(metric);
  const params = new URLSearchParams({ metric, period });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return await api.get(`/teams/${teamId}/leaderboard?${params.toString()}`);
}
