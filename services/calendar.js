import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockGetGroupCalendar,
  mockUpsertCalendarDay,
  mockDeleteCalendarDay,
} from './__mocks__/calendar-mock.js';

// Calendario de un grupo (GroupCalendarDay) — backend real desde
// 2026-09-19 (Gap 6 resuelto, ver docs/BACKEND_API_GAPS.md). Solo los 3
// endpoints de esta pieza (listar rango, upsert de un día, borrar un
// día) — stamp/bulk/bulk-clear/shift son de la pieza 2.

// GET /api/v1/groups/{id}/calendar?from=&to=.
export async function getGroupCalendar(groupId, from, to) {
  if (USE_MOCKS) return await mockGetGroupCalendar(groupId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/groups/${groupId}/calendar?${params.toString()}`);
}

// PUT /api/v1/groups/{id}/calendar/{date}.
export async function upsertCalendarDay(groupId, date, payload) {
  if (USE_MOCKS) return await mockUpsertCalendarDay(groupId, date, payload);
  return await api.put(`/groups/${groupId}/calendar/${date}`, payload);
}

// DELETE /api/v1/groups/{id}/calendar/{date}.
export async function deleteCalendarDay(groupId, date) {
  if (USE_MOCKS) return await mockDeleteCalendarDay(groupId, date);
  return await api.delete(`/groups/${groupId}/calendar/${date}`);
}
