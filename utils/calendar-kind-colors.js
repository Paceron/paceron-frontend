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
