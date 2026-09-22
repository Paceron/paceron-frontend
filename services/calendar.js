import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockGetGroupCalendar,
  mockUpsertCalendarDay,
  mockDeleteCalendarDay,
  mockStampPlan,
  mockBulkAssignDays,
  mockBulkClearDays,
  mockShiftCalendar,
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

// POST /api/v1/groups/{id}/calendar/stamp. 409 con { dates: [...] } si
// hay conflictos y no se pasó force — se devuelve como { conflict: true,
// dates } en vez de lanzar, porque es un resultado esperado del flujo
// (el modal lo muestra, no es un error real). Cualquier otro status sigue
// lanzando normal.
export async function stampPlan(groupId, payload) {
  if (USE_MOCKS) return await mockStampPlan(groupId, payload);
  try {
    const days = await api.post(`/groups/${groupId}/calendar/stamp`, payload);
    return { conflict: false, days };
  } catch (error) {
    if (error.status === 409) return { conflict: true, dates: error.data?.dates ?? [] };
    throw error;
  }
}

// POST /api/v1/groups/{id}/calendar/bulk.
export async function bulkAssignDays(groupId, payload) {
  if (USE_MOCKS) return await mockBulkAssignDays(groupId, payload);
  return await api.post(`/groups/${groupId}/calendar/bulk`, payload);
}

// POST /api/v1/groups/{id}/calendar/bulk-clear.
export async function bulkClearDays(groupId, dates) {
  if (USE_MOCKS) return await mockBulkClearDays(groupId, dates);
  return await api.post(`/groups/${groupId}/calendar/bulk-clear`, { dates });
}

// POST /api/v1/groups/{id}/calendar/shift. 409 si el corrimiento choca
// contra una fecha ya ocupada — mismo criterio que stamp, se devuelve
// como { conflict: true } en vez de lanzar (resultado esperado del flujo).
export async function shiftCalendar(groupId, payload) {
  if (USE_MOCKS) return await mockShiftCalendar(groupId, payload);
  try {
    const days = await api.post(`/groups/${groupId}/calendar/shift`, payload);
    return { conflict: false, days };
  } catch (error) {
    if (error.status === 409) return { conflict: true };
    throw error;
  }
}
