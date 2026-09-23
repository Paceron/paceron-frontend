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

export function canStartPresencialSession(day, now = new Date()) {
  if (day.kind !== 'training' || !day.isPresencial || !day.presencialTimeFrom) return false;
  if (!isSameDay(day.date, now)) return false;
  const [hours, minutes] = day.presencialTimeFrom.split(':').map(Number);
  const scheduledStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  const diffMinutes = (now.getTime() - scheduledStart.getTime()) / 60000;
  return diffMinutes >= -PRESENCIAL_WINDOW_MINUTES && diffMinutes <= PRESENCIAL_WINDOW_MINUTES;
}
