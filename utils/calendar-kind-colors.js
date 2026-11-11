// Color por kind de día de calendario — compartido entre la pantalla de
// un grupo puntual (group-calendar-screen.jsx) y la vista agregada
// (components/calendar/aggregated-month-view.jsx).
export const KIND_DOT_COLORS = { rest: '#94a3b8', other: '#f59e0b', training: '#22c55e', cancelled: '#ef4444' };

// Mismas labels que ya usa el resto de las pantallas de calendario
// (calendar-day-fields.jsx, day-detail-modal.jsx) -- no se inventa
// vocabulario nuevo. Orden fijo: es el orden en que se muestran en la
// leyenda (components/calendar/calendar-kind-legend.jsx).
export const KIND_LABELS = { training: 'Entrenamiento', rest: 'Descanso', other: 'Otra actividad', cancelled: 'Cancelado' };
export const KIND_ORDER = ['training', 'rest', 'other', 'cancelled'];

// Fondo de tarjeta suave por kind -- distinto de KIND_FILLED_CLASS de
// group-calendar-screen.jsx (sólido/alto contraste, para una celda de
// 56px): acá hay texto largo encima (GroupDayContentModal,
// day-detail-modal.jsx). Única fuente -- antes group-day-content-modal.jsx
// tenía su propia copia sin 'rest' (no la necesitaba, un día de descanso
// nunca abre ese modal); day-detail-modal.jsx sí muestra días de descanso
// como fila real (la vista agregada no trata descanso como vacío, a
// diferencia del calendario de un grupo), de ahí la entrada extra.
export const KIND_CARD_CLASS = {
  training: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  rest: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40',
  other: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30',
  cancelled: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30',
};
