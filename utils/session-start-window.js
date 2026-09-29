// Mismo criterio que isCalendarDayClosed (calendar-day-closed.js): wall-clock
// literal, now inyectable para tests en vez de fake timers.
const PRESENCIAL_WINDOW_MINUTES = 30;

function isSameDay(dateStr, now) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() === today.getTime();
}

export function canStartAsyncSession(day, now = new Date()) {
  return day.kind === 'training' && !day.isPresencial && isSameDay(day.date, now);
}

// Ventana de arranque: desde 30 min antes del horario de inicio hasta el
// horario de fin (`presencialTimeTo`) -- un corredor que llega tarde a una
// sesión larga tiene que poder sumarse igual, no solo dentro de los primeros
// 30 min. Si por algún motivo no hay `presencialTimeTo` cargado (no debería
// pasar, el form de armado de plan lo exige), cae al criterio anterior
// (±30 min alrededor del inicio) para no dejar el caso sin ventana alguna.
export function canStartPresencialSession(day, now = new Date()) {
  if (day.kind !== 'training' || !day.isPresencial || !day.presencialTimeFrom) return false;
  if (!isSameDay(day.date, now)) return false;
  const [fromHours, fromMinutes] = day.presencialTimeFrom.split(':').map(Number);
  const scheduledStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), fromHours, fromMinutes, 0, 0);
  const windowStart = new Date(scheduledStart.getTime() - PRESENCIAL_WINDOW_MINUTES * 60000);

  let windowEnd;
  if (day.presencialTimeTo) {
    const [toHours, toMinutes] = day.presencialTimeTo.split(':').map(Number);
    windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), toHours, toMinutes, 0, 0);
  } else {
    windowEnd = new Date(scheduledStart.getTime() + PRESENCIAL_WINDOW_MINUTES * 60000);
  }

  return now.getTime() >= windowStart.getTime() && now.getTime() <= windowEnd.getTime();
}

// Fecha ya pasada (cualquier kind que tenga `date`): toda sesión vencida
// entra al "Registro de Sesión" en vez del Play — ver
// docs/superpowers/specs/2026-09-24-session-registration-review-design.md.
export function isPastSessionDate(day, now = new Date()) {
  const [year, month, dayOfMonth] = day.date.split('-').map(Number);
  const target = new Date(year, month - 1, dayOfMonth);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() < today.getTime();
}
