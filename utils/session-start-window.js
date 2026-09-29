// Mismo criterio que isCalendarDayClosed (calendar-day-closed.js): wall-clock
// literal, now inyectable para tests en vez de fake timers.
const PRESENCIAL_WINDOW_MINUTES = 30;

function isSameDay(dateStr, now) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() === today.getTime();
}

// ¿Se puede arrancar esta sesión ahora mismo?
//
// UNA sola regla para las dos modalidades: una sesión de entrenamiento se puede
// arrancar el día de su fecha, a cualquier hora. Ni el rol ni la presencialidad
// entran en la decisión.
//
// Antes esto se evaluaba sobre dos ejes que no se cruzaban. El call site
// ramificaba por rol (`role === 'runner' ? canStartAsyncSession :
// canStartPresencialSession`) y, como `canStartAsyncSession` excluye la
// presencial por definición, el corredor se quedaba SIN BOTÓN en toda sesión
// presencial mientras la pantalla de al lado le mostraba que era presencial.
//
// Por qué sin ventana horaria (±30 min alrededor de `presencial_time_from`): la
// ventana se medía contra el horario *planificado del gimnasio*, que es una hora
// local de otro lugar y no la del teléfono del corredor. Comparar dos relojes
// que no son el mismo trae más de lo que agrega —el botón aparece o no según
// la zona horaria del dispositivo—, y el costo real es que el corredor llega al
// gym y no puede empezar. La ventana queda documentada en
// `canStartPresencialSession` para reconsiderarla cuando el modelo de horarios
// esté firme.
export function canStartSession(day, now = new Date()) {
  return Boolean(day) && day.kind === 'training' && isSameDay(day.date, now);
}

// Presencial con ventana de ±30 min alrededor del horario planificado. PARKED:
// el calendario ya no la usa (ver `canStartSession`), queda como el predicado
// completo por si se retoma, con su constante y sus tests.
function isInPresencialWindow(day, now) {
  if (!day.presencialTimeFrom) return false;
  const [hours, minutes] = day.presencialTimeFrom.split(':').map(Number);
  const scheduledStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  const diffMinutes = (now.getTime() - scheduledStart.getTime()) / 60000;
  return diffMinutes >= -PRESENCIAL_WINDOW_MINUTES && diffMinutes <= PRESENCIAL_WINDOW_MINUTES;
}

export function canStartAsyncSession(day, now = new Date()) {
  return day.kind === 'training' && !day.isPresencial && isSameDay(day.date, now);
}

export function canStartPresencialSession(day, now = new Date()) {
  if (day.kind !== 'training' || !day.isPresencial) return false;
  return isSameDay(day.date, now) && isInPresencialWindow(day, now);
}

// Fecha ya pasada (cualquier kind que tenga `date`): toda sesión vencida
// entra al "Registro de Sesión" en vez del Play — ver
// docs/superpowers/specs/2026-09-24-session-registration-review-design.md.
export function isPastSessionDate(day, now = new Date()) {
  const [year, month, dayOfMonth] = day.date.split('-').map(Number);
  const target = new Date(year, month - 1, dayOfMonth);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() < today.getTime();
}
