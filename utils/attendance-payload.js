// Construcción PURA de los payloads de asistencia (carga masiva) y del
// porcentaje de la grilla. Sin fetch ni React a propósito — es la parte del
// dominio de asistencia testeable con Jest.
//
// El shape del body de POST /attendance/bulk está verificado contra el backend
// (paceron-backend, cmd/api/domains/attendance/session_attendance.go, tipo
// BulkSaveRequest): team_id y training_session_id en snake_case, y los
// corredores van ANIDADOS en `entries`, cada uno como { user_id } — no existe
// un `userIds` plano en el contrato.

// Descarta null/undefined/'' antes de castear, y no solo con Number.isFinite:
// Number(null) y Number('') dan 0, que es finito, así que sin este descarte
// "todavía no sé el valor" se convertiría en un 0 — el mismo bug que
// documenta utils/currency.js.
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Un id del roster normalizado llega como STRING a propósito (use-team-roster.js
// normaliza userId con String() porque se compara como string en el código), y
// el backend rechaza el body con "cuerpo de solicitud inválido" si user_id no
// es numérico. Es el mismo bug ya encontrado en services/groups.js#addGroupUser,
// e invisible con mocks porque no validan tipos.
const toBackendId = (id) => Number(id);

// Body de POST /api/v1/attendance/bulk.
//
// Los userIds no numéricos se DROPEAN en vez de mandarse como NaN:(Number(NaN)
// es finito en el filtro equivocado, y JSON.stringify(NaN) sale null, que el
// backend no puede distinguir de un id explícitamente nulo).
//
// team_id / training_session_id sí o sí se castean (vienen de query params y de
// las opciones del picker, ambos string), pero no se pueden dropear — no hay
// array del cual caer: si alguno viniera inválido sale null en el JSON y el
// backend rechaza el request con su "cuerpo de solicitud inválido" de siempre,
// que es el comportamiento deseado (fallar ruidoso es mejor que mandar un
// team_id equivocado).
export function toBulkAttendancePayload({ teamId, trainingSessionId, userIds }) {
  const entries = (Array.isArray(userIds) ? userIds : [])
    .map((userId) => toFiniteNumber(userId))
    .filter((userId) => userId !== null)
    .map((userId) => ({ user_id: userId }));

  return {
    team_id: toBackendId(teamId),
    training_session_id: toBackendId(trainingSessionId),
    entries,
  };
}

const round1 = (value) => Math.round(value * 10) / 10;

// Porcentaje de asistencias confirmadas, listo para pintar en la tarjeta de
// métricas.
//
// Roster vacío → 0, no null. El 0 acá es un valor VERDADERO, no un dato sin
// resolver: buildAttendanceSummary (paceron-backend, attendance_service.go)
// inicializa `rate := 0.0` y solo lo recalcula si RosterSize > 0, así que
// "0 de 0 corredores" llega como 0.0 desde el backend y el spec lo fija
// explícitamente ("cuando el grupo no tenga corredores, el porcentaje SHALL
// mostrarse como 0"). El null se reserva para el caso realmente desconocido:
// que no venga summary, o que roster_size sea null/undefined.
//
// Ojo con la regla de utils/currency.js ("sin dato no es 0"): esa aplica a
// valores sin resolver. Acá un roster de 0 es un estado conocido y hay que
// poder mostrar 0% sin mentir.
//
// Cuando attendance_rate_pct viene, se prefiere: el backend redondea a un
// decimal en Go y es el único que conoce la fecha de la sesión (el roster es
// date-aware). El cálculo local es solo el fallback para cuando no viene.
//
// Ojo: el backend puede mandar MÁS de 100. En buildAttendanceSummary,
// `attended` es el total de asistencias de la sesión sin filtrar por roster, así
// que si alguien que ya no está en el roster tiene asistencia cargada, el
// cociente se pasa. Acá no se clampea (el util no inventa datos); el clamp al
// 100 es de la capa de presentación, en el anillo SVG.
//
// Devuelve el número, no el string: el formateo ("50,0 %") y el clamp visual
// del anillo de progreso son de la pantalla, no de acá.
export function toAttendanceRate(summary) {
  const rosterSize = toFiniteNumber(summary?.roster_size);
  if (rosterSize === null) return null;
  if (rosterSize <= 0) return 0;

  const fromBackend = toFiniteNumber(summary.attendance_rate_pct);
  if (fromBackend !== null) return round1(fromBackend);

  const attended = toFiniteNumber(summary.attended);
  if (attended === null) return null;
  return round1((attended / rosterSize) * 100);
}
