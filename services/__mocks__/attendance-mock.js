// Estado in-memory de la asistencia, con la MISMA shape snake_case que el
// backend real (cmd/api/domains/attendance/session_attendance.go) para que la
// pantalla se pueda developar contra mocks sin una capa de normalización de por
// medio — mismo criterio que el resto de services/__mocks__.
//
// Statefulness a propósito (como en workoutFeedback-mock.js): el bulk y el
// borrado escriben en el MISMO estado que leen el listado y la grilla, así que
// marcar 3 corredores → guardar → verlos en la grilla → borrar uno con
// confirmación funciona de punta a punta con USE_MOCKS.
//
// Fixture: equipo 4 ("Runners Mendoza") y su grupo 4 ("General") — los mismos
// ids de teams-mock.js/groups-mock.js, el único equipo con corredores
// sembrados y el grupo que la cascada preselecciona. Los 6 corredores son los
// del catálogo fijo de user-mock.js (SEARCH_CATALOG), con su nombre real y sus
// acentos: son justo lo que tiene que poder filtrar la búsqueda de la pantalla.
// Para cualquier otro par equipo/grupo la lista viene vacía a propósito — es el
// estado vacío real de la pantalla, no un mock roto.

const TEAM = { team_id: 4, team_name: 'Runners Mendoza' };
const GROUP = { group_id: 4, group_name: 'General' };

function daysAgoIso(days, hour = 19) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

// Orden alfabético por nombre, igual que buildRosterRows del service (que
// ordena por strings.ToLower(name) para que "díaz" caiga junto a "díaz" y no
// después de todos los que empiezan con Mayúscula).
const ROSTER = [
  { user_id: 101, name: 'Lucía Fernández', email: 'lucia.fernandez@mail.com' },
  { user_id: 102, name: 'Martín Gómez', email: 'martin.gomez@mail.com' },
  { user_id: 103, name: 'Sofía Rodríguez', email: 'sofia.rodriguez@mail.com' },
  { user_id: 104, name: 'Nicolás López', email: 'nicolas.lopez@mail.com' },
  { user_id: 105, name: 'Valentina Díaz', email: 'valentina.diaz@mail.com' },
  { user_id: 106, name: 'Tomás Martínez', email: 'tomas.martinez@mail.com' },
].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

// Sesiones del grupo, de la más reciente a la más antigua (el backend ordena
// por date DESC).
//
// 503 llega sin ninguna asistencia cargada a propósito: es el caso "el QR
// sigue disponible aunque no haya asistencias" y el de una grilla 0 %.
//
// Ojo con 502: `is_presencial` es un booleano del DÍA, independiente de que
// tenga horario — un día presencial puede no tener presencial_time_from/to (por
// eso el DAO de calendario contempla explícitamente el `presencial_time_from IS
// NULL`). El listado solo filtra por is_presencial, así que una sesión con los
// horarios en null aparece igual y la pantalla tiene que poder pintar ese caso.
const SESSIONS = [
  {
    session_instance_id: 503,
    name: 'Fondo suave',
    date: daysAgoIso(1, 19),
    presencial_time_from: '19:00',
    presencial_time_to: '20:15',
    presencial_location: { lat: -32.8895, lng: -68.8458, label: 'Parque General San Martín' },
  },
  {
    session_instance_id: 502,
    name: 'Rodaje largo',
    date: daysAgoIso(3, 8),
    presencial_time_from: null,
    presencial_time_to: null,
    presencial_location: null,
  },
  {
    session_instance_id: 501,
    name: 'Series de velocidad',
    date: daysAgoIso(7, 18),
    presencial_time_from: '18:30',
    presencial_time_to: '20:00',
    presencial_location: { lat: -32.8895, lng: -68.8458, label: 'Parque General San Martín' },
  },
];

// `source` solo puede ser 'qr' o 'manual' (dominio cerrado en el backend) y es
// NOT NULL en la tabla: la grilla lo devuelve null solo para las filas sin
// asistencia. Las asistencias se siembran mezcladas a propósito (3 por QR + 1
// cargada por el entrenador) porque es el caso real de la grilla.
function buildSeedAttendances() {
  return [
    { id: 9001, team_id: TEAM.team_id, training_session_id: 501, user_id: 101, source: 'qr', registered_at: daysAgoIso(7, 18) },
    { id: 9002, team_id: TEAM.team_id, training_session_id: 501, user_id: 102, source: 'qr', registered_at: daysAgoIso(7, 18) },
    { id: 9003, team_id: TEAM.team_id, training_session_id: 501, user_id: 103, source: 'manual', registered_at: daysAgoIso(7, 19) },
    { id: 9004, team_id: TEAM.team_id, training_session_id: 501, user_id: 104, source: 'qr', registered_at: daysAgoIso(7, 18) },
    { id: 9005, team_id: TEAM.team_id, training_session_id: 502, user_id: 105, source: 'qr', registered_at: daysAgoIso(3, 8) },
    { id: 9006, team_id: TEAM.team_id, training_session_id: 502, user_id: 106, source: 'manual', registered_at: daysAgoIso(3, 9) },
  ];
}

let mockAttendances = buildSeedAttendances();
let nextAttendanceId = 9007;

// PNG 1x1 en base64: placeholder del QR real (el backend genera uno de 256px
// con go-qrcode). Al menos es un PNG válido, así que el data URI se puede
// mostrar en <Image> y meter en el HTML del PDF sin que falle la renderización.
const MOCK_QR_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Error con la misma forma que arma services/api.js (status + data), y con los
// status codes del backend real, que es lo que la pantalla mira para
// distinguir 403/404/422.
function attendanceError(message, status) {
  const error = new Error(message);
  error.status = status;
  error.data = { message: error.message };
  return error;
}

function findSessionOrThrow(sessionInstanceId) {
  const session = SESSIONS.find((s) => String(s.session_instance_id) === String(sessionInstanceId));
  if (!session) {
    // El backend responde 422 (no 404) en el listado de la grilla, el bulk y el
    // QR: no distingue entre "no existe" y "no está asignada a un día de
    // calendario", y no quiere confirmar la existencia de un id ajeno.
    throw attendanceError('La sesión indicada no existe o no está asignada a ningún día de calendario', 422);
  }
  return session;
}

function findAttendance(sessionInstanceId, userId) {
  return mockAttendances.find(
    (a) => String(a.training_session_id) === String(sessionInstanceId) && String(a.user_id) === String(userId),
  );
}

// attended_count es el TOTAL de asistencias de la sesión, sin filtrar por
// roster (el backend cuenta sobre la tabla, no sobre el LEFT JOIN) — por eso se
// deriva del estado y no va hardcodeado en la fixture: si el entrenador carga
// una asistencia, el conteo del selector tiene que moverse solo.
function countAttendances(sessionInstanceId) {
  return mockAttendances.filter((a) => String(a.training_session_id) === String(sessionInstanceId)).length;
}

export async function mockListAttendanceSessions(groupId, teamId) {
  const isSeedGroup = String(GROUP.group_id) === String(groupId) && String(TEAM.team_id) === String(teamId);
  if (!isSeedGroup) return { sessions: [] };

  return {
    sessions: SESSIONS.map((session) => ({
      session_instance_id: session.session_instance_id,
      name: session.name,
      date: session.date,
      presencial_time_from: session.presencial_time_from,
      presencial_time_to: session.presencial_time_to,
      attended_count: countAttendances(session.session_instance_id),
    })),
  };
}

export async function mockGetSessionAttendance(sessionInstanceId, teamId, groupId) {
  const session = findSessionOrThrow(sessionInstanceId);

  // Status se deriva de la existencia de la asistencia, y el invariante del
  // backend es que attendance_id/source/registered_at vienen null EN GRUPO (no
  // uno a uno) cuando la fila no tiene asistencia.
  const roster = ROSTER.map((runner) => {
    const attendance = findAttendance(session.session_instance_id, runner.user_id);
    return {
      user_id: runner.user_id,
      name: runner.name,
      email: runner.email,
      attendance_id: attendance ? attendance.id : null,
      status: attendance ? 'attended' : 'not_confirmed',
      source: attendance ? attendance.source : null,
      registered_at: attendance ? attendance.registered_at : null,
    };
  });
  const attended = roster.filter((row) => row.status === 'attended').length;

  return {
    session: {
      session_instance_id: session.session_instance_id,
      name: session.name,
      date: session.date,
      presencial_time_from: session.presencial_time_from,
      presencial_time_to: session.presencial_time_to,
      presencial_location: session.presencial_location,
      group_id: GROUP.group_id,
      group_name: GROUP.group_name,
      team_id: TEAM.team_id,
      team_name: TEAM.team_name,
    },
    summary: {
      roster_size: roster.length,
      attended,
      not_confirmed: roster.length - attended,
      attendance_rate_pct: round1((attended / roster.length) * 100),
    },
    roster,
  };
}

export async function mockBulkSaveAttendance({ teamId, trainingSessionId, userIds }) {
  const session = findSessionOrThrow(trainingSessionId);
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  for (const userId of userIds ?? []) {
    const existing = findAttendance(session.session_instance_id, userId);
    if (existing) {
      // El ON CONFLICT del backend refresca source y registered_by, pero NO
      // created_at — y created_at es lo que la grilla devuelve como
      // registered_at. Por eso acá solo se pisa el source.
      existing.source = 'manual';
      updated += 1;
    } else {
      mockAttendances.push({
        id: nextAttendanceId++,
        team_id: TEAM.team_id,
        training_session_id: session.session_instance_id,
        user_id: Number(userId),
        source: 'manual',
        registered_at: now,
      });
      created += 1;
    }
  }

  // Los contadores son excluyentes (created + updated == filas del lote). Un
  // lote vacío es un no-op que responde 200 con los dos en cero, no un error.
  return { created, updated };
}

export async function mockGetAttendanceQr(teamId, trainingSessionId) {
  const session = findSessionOrThrow(trainingSessionId);
  return {
    qr_code_base64: MOCK_QR_PNG_BASE64,
    url_encoded: `https://api.paceron.app/api/v1/attendance/team/${TEAM.team_id}/session/${session.session_instance_id}`,
  };
}

export async function mockDeleteAttendance(attendanceId, teamId) {
  const index = mockAttendances.findIndex((a) => String(a.id) === String(attendanceId));
  if (index === -1) throw attendanceError('La asistencia indicada no existe', 404);
  // El orden importa para no filtrar existencia: primero la fila, después el
  // equipo (403) y el rol (403). Nunca 403 para algo que no existe.
  if (String(mockAttendances[index].team_id) !== String(teamId)) {
    throw attendanceError('La asistencia indicada no pertenece al equipo indicado', 403);
  }
  mockAttendances.splice(index, 1);
  return null;
}

export function __resetAttendanceMock() {
  mockAttendances = buildSeedAttendances();
  nextAttendanceId = 9007;
}
