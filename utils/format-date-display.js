import { LocaleConfig } from 'react-native-calendars';

// Convierte YYYY-MM-DD (formato interno que usa toda la lógica de
// calendario) a DD-MM-YYYY para mostrar en UI.
export function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

function parseISODate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Nombre del día de la semana en español — reusa el mismo array que
// config/calendarLocale.js ya carga para react-native-calendars, sin
// duplicar la lista.
export function formatWeekdayLabel(isoDate, { short = false } = {}) {
  if (!isoDate) return '';
  const names = short ? LocaleConfig.locales.es.dayNamesShort : LocaleConfig.locales.es.dayNames;
  return names[parseISODate(isoDate).getDay()];
}
