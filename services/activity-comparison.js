import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetComparisons, mockGetSessionComparison } from './__mocks__/activity-comparison-mock.js';

// Comparación planificado vs realizado (Gap 35). Contrato del change de
// OpenSpec comparacion-planificado-realizado del backend; ver
// docs/superpowers/specs/2026-10-13-training-comparison-design.md.
// Sin athleteUserId compara al usuario autenticado (sale del token).

function toQueryString(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.append(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// GET /api/v1/activities/comparison/:sessionInstanceId?athlete_user_id —
// comparison.SessionComparisonResponse.
export async function getSessionComparison({ sessionInstanceId, athleteUserId } = {}) {
  if (USE_MOCKS) return await mockGetSessionComparison({ sessionInstanceId, athleteUserId });
  return await api.get(`/activities/comparison/${sessionInstanceId}${toQueryString({ athlete_user_id: athleteUserId })}`);
}

// GET /api/v1/activities/comparison?date_from&date_to&team_id&group_id&kind&athlete_user_id —
// comparison.ComparisonListResponse. Las fechas van en YYYY-MM-DD y son
// obligatorias (máximo 366 días, sin pasar de hoy).
export async function getComparisons({ dateFrom, dateTo, teamId, groupId, kind, athleteUserId } = {}) {
  if (USE_MOCKS) return await mockGetComparisons({ dateFrom, dateTo, teamId, groupId, kind, athleteUserId });
  return await api.get(`/activities/comparison${toQueryString({
    date_from: dateFrom, date_to: dateTo, team_id: teamId, group_id: groupId, kind, athlete_user_id: athleteUserId,
  })}`);
}
