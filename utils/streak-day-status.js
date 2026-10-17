// Color/label por estado de día de racha (Gap 30) -- mismo espíritu que
// utils/calendar-kind-colors.js, pero con 4 estados propios de este módulo
// (no se reusa KIND_DOT_COLORS: son conceptos distintos aunque los dos
// sean "color de un día"). `textColor` es para el número de día que
// streaks-tab.jsx dibuja ADENTRO de la celda (grilla grande, 2026-10-14) --
// blanco sobre los fondos oscuros, slate oscuro sobre el fondo claro de
// 'pending' (blanco ahí sería casi ilegible).
const STREAK_DAY_VISUALS = {
  completed: { color: '#22c55e', textColor: '#ffffff', label: 'Completado' },
  failed: { color: '#ef4444', textColor: '#ffffff', label: 'Fallido' },
  skipped: { color: '#94a3b8', textColor: '#ffffff', label: 'Sin entrenamiento asignado' },
  pending: { color: '#cbd5e1', textColor: '#475569', label: 'Pendiente' },
};

export function streakDayVisual(status) {
  return STREAK_DAY_VISUALS[status] ?? STREAK_DAY_VISUALS.pending;
}
