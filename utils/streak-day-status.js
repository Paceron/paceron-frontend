// Color/label por estado de día de racha (Gap 30) -- mismo espíritu que
// utils/calendar-kind-colors.js, pero con 4 estados propios de este módulo
// (no se reusa KIND_DOT_COLORS: son conceptos distintos aunque los dos
// sean "color de un día").
const STREAK_DAY_VISUALS = {
  completed: { color: '#22c55e', label: 'Completado' },
  failed: { color: '#ef4444', label: 'Fallido' },
  skipped: { color: '#94a3b8', label: 'Sin entrenamiento asignado' },
  pending: { color: '#cbd5e1', label: 'Pendiente' },
};

export function streakDayVisual(status) {
  return STREAK_DAY_VISUALS[status] ?? STREAK_DAY_VISUALS.pending;
}
