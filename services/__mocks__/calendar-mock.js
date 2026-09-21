// Mock stateful en memoria — mismo patrón que sessions-mock.js. Arranca
// vacío (tabla dispersa del backend real: sin fila = día vacío). Para
// simular la instanciación real (docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md
// §3.1bis) importa mockGetSession de sessions-mock.js — al guardar
// kind='training' con session_id, "instancia" copiando nombre/descripción
// de esa sesión del catálogo mock, siempre que llega session_id (nunca
// conserva la instancia vieja, mismo comportamiento que el backend real
// hoy — Gap 7 pendiente). Los ejercicios de la instancia usan un nombre
// sintético (Ejercicio <id>) en vez de resolver contra exercises-mock.js
// — simplificación aceptable para un mock.
import { mockGetSession } from './sessions-mock.js';

let mockCalendarDays = {};
let nextId = 1;
let nextInstanceId = 1000;

function keyFor(groupId, date) {
  return `${groupId}::${date}`;
}

async function instantiateSession(sessionId) {
  const catalogSession = await mockGetSession(sessionId);
  return {
    id: nextInstanceId++,
    name: catalogSession.name,
    description: catalogSession.description ?? null,
    exercises: catalogSession.exercises.map((e) => ({
      id: e.exercise_id,
      name: `Ejercicio ${e.exercise_id}`,
      role: e.role,
      repeat_count: e.repeat_count ?? 1,
      rest_minutes: e.rest_minutes ?? 0,
    })),
  };
}

export async function mockGetGroupCalendar(groupId, from, to) {
  return Object.values(mockCalendarDays).filter(
    (d) => String(d.group_id) === String(groupId) && d.date >= from && d.date <= to,
  );
}

export async function mockUpsertCalendarDay(groupId, date, payload) {
  const key = keyFor(groupId, date);
  const now = new Date().toISOString();
  const existing = mockCalendarDays[key];

  let sessionInstance = null;
  if (payload.kind === 'training' && payload.session_id != null) {
    sessionInstance = await instantiateSession(payload.session_id);
  } else if (payload.kind === 'cancelled') {
    sessionInstance = existing?.session_instance ?? null;
  }

  const day = {
    id: existing?.id ?? nextId++,
    group_id: Number(groupId),
    date,
    kind: payload.kind,
    other_name: payload.other_name ?? null,
    session_instance: sessionInstance,
    cancelled_reason: payload.cancelled_reason ?? null,
    is_presencial: payload.is_presencial ?? false,
    presencial_time_from: payload.presencial_time_from ?? null,
    presencial_time_to: payload.presencial_time_to ?? null,
    presencial_location: payload.presencial_location ?? null,
    source_plan_id: existing?.source_plan_id ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  mockCalendarDays[key] = day;
  return day;
}

export async function mockDeleteCalendarDay(groupId, date) {
  delete mockCalendarDays[keyFor(groupId, date)];
  return null;
}

export function __resetMockCalendar() {
  mockCalendarDays = {};
  nextId = 1;
  nextInstanceId = 1000;
}
