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
  mockGetAdministeredCalendar,
  mockGetMemberCalendar,
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

// POST /api/v1/groups/{id}/calendar/stamp. Responde { days, same_team_warnings }
// (Gap 9) en vez del array crudo. Dos causas distintas de 409, distinguidas
// por el shape del body: { dates: [...] } es el conflicto de contenido
// existente de siempre (se devuelve como { conflict: true, dates } — un
// resultado esperado del flujo, el modal lo muestra); { conflicts: [...] }
// es la colisión presencial cross-equipo de Gap 9, sin force que la salve
// (se devuelve como { conflict: true, presencialCollision: true, message,
// conflicts }). Cualquier otro status sigue lanzando normal.
export async function stampPlan(groupId, payload) {
  if (USE_MOCKS) return await mockStampPlan(groupId, payload);
  try {
    const response = await api.post(`/groups/${groupId}/calendar/stamp`, payload);
    return { conflict: false, days: response.days, sameTeamWarnings: response.same_team_warnings ?? [] };
  } catch (error) {
    if (error.status === 409 && error.data?.dates) return { conflict: true, dates: error.data.dates };
    if (error.status === 409 && error.data?.conflicts) {
      return { conflict: true, presencialCollision: true, message: error.data.message, conflicts: error.data.conflicts };
    }
    throw error;
  }
}

// POST /api/v1/groups/{id}/calendar/bulk. Responde { days, same_team_warnings }
// (Gap 9) en vez del array crudo. Sin conflicto de contenido existente
// (bulk siempre pisa) — el único 409 posible es la colisión presencial
// cross-equipo de Gap 9, que se deja lanzar (el mensaje del backend ya es
// legible, el caller lo muestra genérico).
export async function bulkAssignDays(groupId, payload) {
  if (USE_MOCKS) return await mockBulkAssignDays(groupId, payload);
  const response = await api.post(`/groups/${groupId}/calendar/bulk`, payload);
  return { days: response.days, sameTeamWarnings: response.same_team_warnings ?? [] };
}

// POST /api/v1/groups/{id}/calendar/bulk-clear.
export async function bulkClearDays(groupId, dates) {
  if (USE_MOCKS) return await mockBulkClearDays(groupId, dates);
  return await api.post(`/groups/${groupId}/calendar/bulk-clear`, { dates });
}

// POST /api/v1/groups/{id}/calendar/shift. Responde { days, same_team_warnings }
// (Gap 9) en vez del array crudo. Dos causas distintas de 409, ambas sin
// `conflicts` estructurado salvo la de colisión presencial — se devuelve
// siempre { conflict: true, message } con el texto real del backend
// (distingue "corrimiento choca fechas existentes" de "colisión presencial
// con otro equipo" sin necesidad de un texto hardcodeado por el caller).
export async function shiftCalendar(groupId, payload) {
  if (USE_MOCKS) return await mockShiftCalendar(groupId, payload);
  try {
    const response = await api.post(`/groups/${groupId}/calendar/shift`, payload);
    return { conflict: false, days: response.days, sameTeamWarnings: response.same_team_warnings ?? [] };
  } catch (error) {
    if (error.status === 409) {
      return { conflict: true, presencialCollision: Boolean(error.data?.conflicts), message: error.data?.message };
    }
    throw error;
  }
}

// GET /api/v1/users/{id}/member-calendar?from=&to= (Gap 11) — días de
// TODOS los grupos de los que el usuario es miembro, taggeados con
// group_name/team_id/team_name server-side.
export async function getMemberCalendar(userId, from, to) {
  if (USE_MOCKS) return await mockGetMemberCalendar(userId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/users/${userId}/member-calendar?${params.toString()}`);
}

// GET /api/v1/users/{id}/administered-calendar?from=&to= (Gap 11) — días
// de TODOS los grupos que el usuario administra, con presencial_collision
// en los días presenciales que colisionan (ver Gap 9/11).
export async function getAdministeredCalendar(userId, from, to) {
  if (USE_MOCKS) return await mockGetAdministeredCalendar(userId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/users/${userId}/administered-calendar?${params.toString()}`);
}
