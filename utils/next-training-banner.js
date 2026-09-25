function toISODate(date) {
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function selectNextTraining(days, { presencialOnly = false } = {}, now = new Date()) {
  const todayISO = toISODate(now);
  const candidates = days
    .filter((day) => day.kind === 'training' && day.date >= todayISO && (!presencialOnly || day.isPresencial))
    .sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0] ?? null;
}

export function selectCancelledBefore(days, beforeDate, now = new Date()) {
  const todayISO = toISODate(now);
  return days
    .filter((day) => day.kind === 'cancelled' && day.date >= todayISO && day.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
