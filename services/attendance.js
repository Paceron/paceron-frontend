import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListAttendanceSessions,
  mockGetSessionAttendance,
  mockBulkSaveAttendance,
  mockGetAttendanceQr,
  mockDeleteAttendance,
  mockRegisterCheckin,
} from './__mocks__/attendance-mock.js';
import { toBulkAttendancePayload } from '../utils/attendance-payload.js';

// Gestión de asistencia desde el panel del entrenador (Etapa 2 del change
// OpenSpec `gestion-asistencia-entrenador`). 4 endpoints nuevos + el
// `GET /attendance/qr`, que ya existía para el camino del corredor.
//
// Contrato verificado contra paceron-backend (rama homónima): las rutas en
// cmd/api/app/url_mappings.go y los DTOs en
// cmd/api/domains/attendance/session_attendance.go. `api` ya antepone
// `/api/v1`, así que las rutas de abajo van sin ese prefijo (el comentario
// lleva el path completo, la llamada no).

// GET /api/v1/groups/{id}/attendance-sessions?team_id=
// El param de ruta se llama `id` y no `group_id` — es la convención que ya
// siguen las demás rutas de grupos, y gin no permite mezclar nombres distintos
// en un mismo segmento. `team_id` es obligatorio: sin él el backend responde
// 400 antes de llegar al service.
export async function listAttendanceSessions(groupId, teamId) {
  if (USE_MOCKS) return await mockListAttendanceSessions(groupId, teamId);
  const params = new URLSearchParams({ team_id: teamId });
  return await api.get(`/groups/${groupId}/attendance-sessions?${params.toString()}`);
}

// GET /api/v1/attendance/session/{session_instance_id}?team_id=&group_id=
// Los dos query params son obligatorios (400 sin cualquiera de los dos). El
// roster es el de los miembros con membresía activa en la FECHA DE LA SESIÓN, no
// en la de hoy, así que la grilla no se puede derivar de use-team-roster.js.
export async function getSessionAttendance(sessionInstanceId, teamId, groupId) {
  if (USE_MOCKS) return await mockGetSessionAttendance(sessionInstanceId, teamId, groupId);
  const params = new URLSearchParams({ team_id: teamId, group_id: groupId });
  return await api.get(`/attendance/session/${sessionInstanceId}?${params.toString()}`);
}

// POST /api/v1/attendance/bulk — carga masiva (idempotente, todo-o-nada:
// si algún corredor no era miembro del grupo en la fecha de la sesión no se
// escribe ninguna fila y responde 422 con `details.invalid_user_ids`).
//
// El body NO es un `user_ids` plano: es `{ team_id, training_session_id,
// entries: [{ user_id }] }`. El armado (y el `Number()` de los userIds, que
// llegan como string del roster normalizado) lo hace toBulkAttendancePayload
// — no duplicarlo acá.
//
// OJO con el nombre: `training_session_id` es el id de la INSTANCIA de sesión,
// el mismo `session_instance_id` que devuelve el listado y la grilla (el
// service lo pasa a resolveAttendanceSession, que busca por session_instance_id
// y valida presencial + equipo). Es el mismo valor que hay que mandarle.
export async function bulkSaveAttendance({ teamId, trainingSessionId, userIds }) {
  if (USE_MOCKS) return await mockBulkSaveAttendance({ teamId, trainingSessionId, userIds });
  return await api.post('/attendance/bulk', toBulkAttendancePayload({ teamId, trainingSessionId, userIds }));
}

// GET /api/v1/attendance/qr?team_id=&training_session_id=
// Endpoint preexistente del camino del corredor, reusado por el entrenador para
// reemitir el mismo QR de una sesión. No filtra por fecha: el QR de una sesión
// próxima es el caso normal (se emite antes de la clase). `training_session_id`
// es el id de instancia, igual que en el bulk.
export async function getAttendanceQr(teamId, trainingSessionId) {
  if (USE_MOCKS) return await mockGetAttendanceQr(teamId, trainingSessionId);
  const params = new URLSearchParams({ team_id: teamId, training_session_id: trainingSessionId });
  return await api.get(`/attendance/qr?${params.toString()}`);
}

// POST /api/v1/attendance/team/:team_id/session/:training_session_id — el
// registro del CORREDOR (el del entrenador es `bulkSaveAttendance`).
//
// Es el otro lado del QR: el endpoint ya existía para que el corredor se
// auto-registrara, y hasta ahora no tenía consumidor en el front.
//
// `Number()` en los dos ids porque llegan como string del parser del QR
// (utils/checkin-qr-url.js) y el backend rechaza el body con "cuerpo de
// solicitud inválido" si no son numéricos — misma regla que ya aplica
// bulkSaveAttendance.
//
// El 200 no es un error: es el caso idempotente de "ya estaba registrada", y el
// service devuelve la respuesta tal cual para que la pantalla distinga 201 de
// 200 con `error.status` (D7). El mensaje del backend no se usa para decidir.
export async function registerCheckin({ teamId, sessionInstanceId }) {
  if (USE_MOCKS) return await mockRegisterCheckin({ teamId, sessionInstanceId });
  return await api.post(`/attendance/team/${Number(teamId)}/session/${Number(sessionInstanceId)}`);
}

// DELETE /api/v1/attendance/{attendance_id}?team_id=
// `team_id` es obligatorio y va en el query porque `api.delete` no acepta body
// (services/api.js): es contra ese equipo que se autoriza el borrado, y sin él
// no hay forma de decidir entre 403 y 404. El 204 no trae cuerpo, así que esto
// resuelve en null.
//
// El `attendance_id` se valida ACÁ y no se deja que llegue al backend. Con
// `undefined` la URL queda `/attendance/undefined` y la respuesta es un 400
// genérico ("debe ser un número entero mayor a 0") que no dice que el problema
// es del caller — que es exactamente cómo se coló el bug del 2026-09-28: el hook
// desestructuraba `{ attendanceId }` de un argumento posicional, y sin esta
// guarda el error le llega al usuario como si fuera del servidor.
export async function deleteAttendance(attendanceId, teamId) {
  if (!Number.isInteger(attendanceId) || attendanceId <= 0) {
    throw new Error(
      `deleteAttendance: attendance_id inválido (${JSON.stringify(attendanceId)}). `
      + 'Se espera el id numérico de la fila de la grilla.',
    );
  }
  if (USE_MOCKS) return await mockDeleteAttendance(attendanceId, teamId);
  return await api.delete(`/attendance/${attendanceId}?team_id=${encodeURIComponent(teamId)}`);
}
