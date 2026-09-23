// Réplica del lado del frontend de isCalendarDayClosed (backend,
// cmd/api/services/calendar_service.go) — mismo criterio exacto: una
// fecha pasada siempre está cerrada; hoy está cerrado salvo que sea
// presencial y todavía no haya arrancado (antes de presencialTimeFrom);
// una fecha futura nunca está cerrada. Uso puramente advisory en el
// frontend (evitar mostrar una acción que el backend va a rechazar con
// 422) — el backend sigue siendo la fuente de verdad real.
//
// dateStr: 'YYYY-MM-DD'. presencialTimeFrom: 'HH:mm' o null/undefined.
// Ambos son wall-clock literal, sin conversión de huso horario (mismo
// criterio que TimeField/toCalendarDayPayload — nunca se convierte HH:mm
// entre zonas, viaja tal cual).
export function isCalendarDayClosed(dateStr, { isPresencial, presencialTimeFrom } = {}, now = new Date()) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dayDate = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dayDate < today) return true;
  if (dayDate > today) return false;
  if (!isPresencial) return true;
  if (!presencialTimeFrom) return false;

  const [hh, mm] = presencialTimeFrom.split(':').map(Number);
  const threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  return now >= threshold;
}
