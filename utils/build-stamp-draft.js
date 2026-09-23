import { isCalendarDayClosed } from './calendar-day-closed.js';

// Suma días de calendario a una fecha ISO ('YYYY-MM-DD'), manejando
// cruce de mes/año — construye un Date real a partir de los componentes
// Y-M-D (no concatenación de strings) para que el cruce lo resuelva el
// motor de fechas de JS, no lógica escrita a mano.
export function addDaysISO(isoDate, daysToAdd) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysToAdd);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Arma el preview local de "estampar un plan a partir de tal fecha" —
// un draftDay por PlanDay del plan, con la fecha real calculada
// (día 1 del plan → startDate, día 2 → startDate + 1, etc, ver
// docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §4). `presencialLocation` se
// precarga desde el default del plan (el backend real exige ubicación en
// todo PlanDay presencial, ver docs/superpowers/specs/2026-09-21-calendar-plan-stamping-design.md
// §2, nota de actualización) — el entrenador puede ajustarla igual en el
// preview antes de guardar. `touched` arranca en false — se vuelve true
// cuando el entrenador edita ese día a mano en el preview
// (stamp-plan-modal.jsx), y decide qué días llevan un PUT extra después
// del stamp.
export function buildStampDraft(plan, startDate) {
  return plan.days.map((day) => ({
    date: addDaysISO(startDate, day.sequenceNo - 1),
    sequenceNo: day.sequenceNo,
    kind: day.kind,
    otherName: day.otherName,
    sessionId: day.sessionId,
    isPresencial: Boolean(day.isPresencial),
    presencialTimeFrom: day.presencialTimeFrom ?? null,
    presencialTimeTo: day.presencialTimeTo ?? null,
    presencialLocation: day.presencialLocation ?? null,
    touched: false,
  }));
}

// Qué fechas del preview quedarían cerradas (pasadas, o presencial de
// hoy ya arrancado) si se estampara ahora mismo — usa el isPresencial/
// horario propio de CADA draftDay, no un valor fijo, porque la única
// fecha donde eso importa es HOY (ver utils/calendar-day-closed.js): el
// resto del rango es simplemente pasado o futuro sin importar presencial.
export function findClosedDraftDates(draftDays, now = new Date()) {
  return draftDays
    .filter((d) => isCalendarDayClosed(d.date, { isPresencial: d.isPresencial, presencialTimeFrom: d.presencialTimeFrom }, now))
    .map((d) => d.date);
}
