export function hasCalendarDayContent(day) {
  return Boolean(day) && day.kind !== 'rest';
}
