import { filterUpcomingTrainingsByStatus } from './upcoming-trainings.js';

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

export function selectNextTrainingCandidates(days, { presencialOnly = false } = {}, now = new Date()) {
  return days
    .filter((day) => day.kind === 'training' && (!presencialOnly || day.isPresencial) && isStillUpcoming(day, now))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function selectNextTraining(days, { presencialOnly = false } = {}, now = new Date()) {
  return selectNextTrainingCandidates(days, { presencialOnly }, now)[0] ?? null;
}

export function selectNextPendingTraining(days, statusBySessionId, options = {}, now = new Date()) {
  return selectNextPendingTrainings(days, statusBySessionId, options, now)[0] ?? null;
}

// Devuelve todas las sesiones pendientes de la fecha más próxima. La Home
// puede mostrarlas como un carrusel sin mezclar entrenamientos de otros días.
export function selectNextPendingTrainings(days, statusBySessionId = {}, options = {}, now = new Date()) {
  const candidates = selectNextTrainingCandidates(days, options, now);
  return selectNextTrainingGroup(candidates, statusBySessionId);
}

// candidates ya es la lista válida y ordenada calculada para el instante de
// este render; separar el filtro de estado evita recalcular "hoy" dos veces.
export function selectNextTrainingGroup(candidates, statusBySessionId = {}) {
  const pending = filterUpcomingTrainingsByStatus(candidates, statusBySessionId);
  if (pending.length === 0) return [];
  const firstDate = pending[0].date;
  return pending.filter((training) => training.date === firstDate);
}

export function selectCancelledBefore(days, beforeDate, now = new Date()) {
  const todayISO = toISODate(now);
  return days
    .filter((day) => day.kind === 'cancelled' && day.date >= todayISO && day.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
