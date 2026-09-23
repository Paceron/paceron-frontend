// Mock stateful en memoria — mismo patrón que sessions-mock.js. Arranca
// vacío (tabla dispersa del backend real: sin fila = día vacío). Para
// simular la instanciación real (docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md
// §3.1bis) importa mockGetSession de sessions-mock.js — al guardar
// kind='training' con session_id, "instancia" copiando nombre/descripción
// de esa sesión del catálogo mock. Si session_id viene omitido (Gap 7,
// resuelto) y ya hay una instancia, se conserva tal cual, sin reinstanciar
// — mismo criterio que ya aplicaba a kind='cancelled'. Los ejercicios de
// la instancia usan un nombre sintético (Ejercicio <id>) en vez de
// resolver contra exercises-mock.js — simplificación aceptable para un
// mock. session_id/exercise_id (origen de catálogo, Gap 7) sí se guardan
// reales, para poder probar sourceSessionId/sourceExerciseId localmente.
import { mockGetSession } from './sessions-mock.js';
import { mockGetTrainingPlan } from './training-plans-mock.js';
import { addDaysISO } from '../../utils/build-stamp-draft.js';
import { __getAllMockTeams } from './teams-mock.js';
import { mockListGroups, mockGetGroupUsers } from './groups-mock.js';

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
    session_id: catalogSession.id,
    exercises: catalogSession.exercises.map((e) => ({
      id: e.exercise_id,
      name: `Ejercicio ${e.exercise_id}`,
      role: e.role,
      repeat_count: e.repeat_count ?? 1,
      rest_minutes: e.rest_minutes ?? 0,
      exercise_id: e.exercise_id,
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
  if (payload.kind === 'training') {
    sessionInstance = payload.session_id != null
      ? await instantiateSession(payload.session_id)
      : (existing?.session_instance ?? null);
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

export async function mockStampPlan(groupId, { plan_id, start_date, force, exclude_dates }) {
  const plan = await mockGetTrainingPlan(plan_id);
  const dates = plan.days.map((_, i) => addDaysISO(start_date, i));
  const excluded = new Set(exclude_dates ?? []);

  const conflicts = dates.filter((date) => !excluded.has(date) && Boolean(mockCalendarDays[keyFor(groupId, date)]));
  if (conflicts.length > 0 && !force) {
    return { conflict: true, dates: conflicts };
  }

  const created = [];
  for (let i = 0; i < plan.days.length; i++) {
    if (excluded.has(dates[i])) continue;
    const planDay = plan.days[i];
    const presencial = planDay.kind === 'training' && Boolean(planDay.default_presencial);
    const payload = {
      kind: planDay.kind,
      other_name: planDay.other_name,
      session_id: planDay.kind === 'training' ? planDay.session_id : undefined,
      is_presencial: presencial,
      presencial_time_from: presencial ? planDay.default_time_from : null,
      presencial_time_to: presencial ? planDay.default_time_to : null,
      presencial_location: presencial ? planDay.default_location : null,
    };
    const savedDay = await mockUpsertCalendarDay(groupId, dates[i], payload);
    savedDay.source_plan_id = Number(plan_id);
    created.push(savedDay);
  }
  return { conflict: false, days: created, sameTeamWarnings: [] };
}

// Mock no simula colisión presencial cross-grupo (Gap 9) — requeriría
// modelar equipos/owner_id acá, sin valor real para un mock local.
// sameTeamWarnings queda siempre vacío, mismo shape que el service real.
export async function mockBulkAssignDays(groupId, { dates, ...payload }) {
  const results = [];
  for (const date of dates) {
    results.push(await mockUpsertCalendarDay(groupId, date, payload));
  }
  return { days: results, sameTeamWarnings: [] };
}

export async function mockBulkClearDays(groupId, dates) {
  for (const date of dates) {
    await mockDeleteCalendarDay(groupId, date);
  }
  return null;
}

export async function mockShiftCalendar(groupId, { from_date, days }) {
  // Corrimiento hacia adelante de TODO lo que sigue desde from_date — no
  // puede chocar contra ningún día existente (todo lo que hay >= from_date
  // se mueve junto, en el mismo orden relativo), mismo motivo por el que
  // el backend documenta el 409 como defensivo ("no debería pasar corriendo
  // hacia adelante, pero se valida igual"). El mock no simula ese caso
  // imposible — siempre resuelve el corrimiento.
  const affected = Object.values(mockCalendarDays)
    .filter((d) => String(d.group_id) === String(groupId) && d.date >= from_date)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // desc — mover de atrás hacia adelante evita pisarse a sí mismo

  const shifted = [];
  for (const day of affected) {
    const oldKey = keyFor(groupId, day.date);
    const newDate = addDaysISO(day.date, days);
    delete mockCalendarDays[oldKey];
    const moved = { ...day, date: newDate, updated_at: new Date().toISOString() };
    mockCalendarDays[keyFor(groupId, newDate)] = moved;
    shifted.push(moved);
  }
  return { conflict: false, days: shifted, sameTeamWarnings: [] };
}

export async function mockDeleteCalendarDay(groupId, date) {
  delete mockCalendarDays[keyFor(groupId, date)];
  return null;
}

async function groupsAdministeredBy(userId) {
  const teams = __getAllMockTeams().filter((t) => String(t.owner_id) === String(userId));
  const result = [];
  for (const team of teams) {
    const groups = await mockListGroups(team.id);
    for (const group of groups) result.push({ group, team });
  }
  return result;
}

async function groupsWhereMember(userId) {
  const teams = __getAllMockTeams();
  const result = [];
  for (const team of teams) {
    const groups = await mockListGroups(team.id);
    for (const group of groups) {
      const members = await mockGetGroupUsers(group.id);
      if (members.some((m) => String(m.user_id) === String(userId))) result.push({ group, team });
    }
  }
  return result;
}

// administered-calendar (Gap 11) — no simula presencial_collision (mismo
// criterio que same_team_warnings en los mocks de escritura: requeriría
// modelar el algoritmo de colisión acá, sin valor real para un mock local).
export async function mockGetAdministeredCalendar(userId, from, to) {
  const administered = await groupsAdministeredBy(userId);
  const results = [];
  for (const { group, team } of administered) {
    const days = await mockGetGroupCalendar(group.id, from, to);
    for (const day of days) results.push({ ...day, group_name: group.name, team_id: team.id, team_name: team.name });
  }
  return results;
}

export async function mockGetMemberCalendar(userId, from, to) {
  const memberships = await groupsWhereMember(userId);
  const results = [];
  for (const { group, team } of memberships) {
    const days = await mockGetGroupCalendar(group.id, from, to);
    for (const day of days) results.push({ ...day, group_name: group.name, team_id: team.id, team_name: team.name });
  }
  return results;
}

export function __resetMockCalendar() {
  mockCalendarDays = {};
  nextId = 1;
  nextInstanceId = 1000;
}
