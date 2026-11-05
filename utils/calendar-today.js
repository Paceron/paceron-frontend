// Mismo criterio que utils/session-start-window.js: constructor local
// (y, m, d) + getters locales, nunca `toISOString()`/parsing de string --
// ese camino interpreta un string fecha-sola como medianoche UTC, que en
// cualquier huso negativo (ej. GMT-3) corre la celda "hoy" un día en las
// últimas horas del día local. Ver docs/superpowers/specs/2026-11-02-
// runner-competitions-widget-design.md sección C para el root cause
// completo (confirmado contra react-native-calendars/src/dateutils.js).

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function computeTodayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function isTodayDateString(dateString, now = new Date()) {
  return dateString === computeTodayIso(now);
}
