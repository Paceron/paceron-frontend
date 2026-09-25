import { pad2 } from './calendar-month-range.js';

// Ventana fija — mejora futura (no MVP): sin límite real, paginando hacia
// adelante si no alcanzan 5 resultados. Ver
// docs/superpowers/specs/2026-09-25-upcoming-trainings-grid-design.md.
const UPCOMING_WINDOW_DAYS = 90;

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function upcomingTrainingsRange(now = new Date()) {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + UPCOMING_WINDOW_DAYS);
  return { from: toISODate(now), to: toISODate(to) };
}

export function selectUpcomingTrainings(days, now = new Date()) {
  const todayISO = toISODate(now);
  return days
    .filter((day) => day.kind === 'training' && day.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date));
}
