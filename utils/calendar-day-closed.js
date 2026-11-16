// Réplica advisory de isCalendarDayClosed (backend,
// cmd/api/services/calendar_service.go): las fechas del calendario se
// interpretan en Argentina, sin depender de la zona horaria del dispositivo.
// Todo el día de hoy (presencial o async) está abierto hasta medianoche
// argentina; las fechas anteriores quedan cerradas y las futuras abiertas.
// El backend sigue siendo la fuente de verdad real.
//
// dateStr: 'YYYY-MM-DD'. presencialTimeFrom: 'HH:mm' o null/undefined.
// presencialTimeFrom se mantiene en la firma para compatibilidad con callers;
// ya no participa en el guard de escritura.
const ARGENTINA_TIME_ZONE = 'America/Argentina/Cordoba';

function todayInArgentina(now) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isCalendarDayClosed(dateStr, { isPresencial, presencialTimeFrom } = {}, now = new Date()) {
  // Evita warnings de lint mientras se conserva la firma pública compatible.
  void isPresencial;
  void presencialTimeFrom;
  return dateStr < todayInArgentina(now);
}
