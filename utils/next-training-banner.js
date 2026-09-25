function toISODate(date) {
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Una presencial de hoy cuyo horario ya terminó no es "el próximo
// entrenamiento" — ya pasó, aunque la fecha siga siendo hoy. Un
// asincrónico no tiene horario de cierre (se puede hacer en cualquier
// momento del día, mismo criterio que canStartAsyncSession), así que solo
// se filtra por fecha.
function isStillUpcoming(day, now) {
  const todayISO = toISODate(now);
  if (day.date > todayISO) return true;
  if (day.date < todayISO) return false;
  if (!day.isPresencial || !day.presencialTimeTo) return true;
  const [hours, minutes] = day.presencialTimeTo.split(':').map(Number);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  return now.getTime() <= end.getTime();
}

export function selectNextTraining(days, { presencialOnly = false } = {}, now = new Date()) {
  const candidates = days
    .filter((day) => day.kind === 'training' && (!presencialOnly || day.isPresencial) && isStillUpcoming(day, now))
    .sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0] ?? null;
}

export function selectCancelledBefore(days, beforeDate, now = new Date()) {
  const todayISO = toISODate(now);
  return days
    .filter((day) => day.kind === 'cancelled' && day.date >= todayISO && day.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
