// Color/label por estado de día de racha (Gap 30) -- mismo espíritu que
// utils/calendar-kind-colors.js, pero con 4 estados propios de este módulo
// (no se reusa KIND_DOT_COLORS: son conceptos distintos aunque los dos
// sean "color de un día"). `textColor` es para el número de día que
// streaks-tab.jsx dibuja ADENTRO de la celda (grilla grande, 2026-10-14) --
// blanco sobre los fondos oscuros, slate oscuro sobre el fondo claro de
// 'pending' (blanco ahí sería casi ilegible).
// `completed` reusa el verde de marca (`primary` en tailwind.config.js/
// theme/colors.js, mismo tono que el hero de next-training-banner.jsx).
// `failed` reusa el rojo ya establecido para "mal" en los charts del
// dashboard (`COMPLIANCE_TONE_FILL.low`, components/comparison/compliance-
// badge.jsx) en vez de un rojo genérico suelto. `skipped` bajó un escalón
// en la escala slate (400→500) para distinguirse mejor de `pending`.
const STREAK_DAY_VISUALS = {
  completed: { color: '#8cc63e', textColor: '#ffffff', label: 'Completado' },
  failed: { color: '#f43f5e', textColor: '#ffffff', label: 'Fallido' },
  skipped: { color: '#64748b', textColor: '#ffffff', label: 'Sin entrenamiento asignado' },
  pending: { color: '#cbd5e1', textColor: '#475569', label: 'Pendiente' },
};

export function streakDayVisual(status) {
  return STREAK_DAY_VISUALS[status] ?? STREAK_DAY_VISUALS.pending;
}
