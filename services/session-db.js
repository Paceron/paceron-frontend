import * as SQLite from 'expo-sqlite';
import { toIsoUtc } from '../utils/time.js';

// Persistencia local del registro en vivo (offline-first). Durante la sesión
// SQLite es la fuente de verdad; el store solo sostiene lo transitorio. El
// sync al finalizar lee de acá (sets `finished`/`skipped` no syncados).
//
// Nombres de tablas/columnas alineados al contracto del backend
// (workout_feedback + workout_feedback_points) para que mover datos sea
// mecánico — ver docs/superpowers/specs/2026-09-24-live-session-recording-design.md.

const DB_NAME = 'paceron-sessions.db';

export const SET_STATUS = {
  PENDING: 'pending',
  STARTED: 'started',
  SKIPPED: 'skipped',
  FINISHED: 'finished',
  INTERRUPTED: 'interrupted',
};

export const RUN_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

const toNumberOrNull = (value) => (value == null ? null : Number(value));

const CREATE_SESSION_RUNS = `
  CREATE TABLE IF NOT EXISTS session_runs (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    session_instance_id      INTEGER NOT NULL,
    session_name             TEXT NOT NULL,
    session_date             TEXT NOT NULL,
    team_id                  INTEGER,
    athlete_user_id          INTEGER,
    report_source            TEXT NOT NULL DEFAULT 'corredor',
    gps_enabled              INTEGER NOT NULL DEFAULT 0,
    started_at               TEXT,
    ended_at                 TEXT,
    status                   TEXT NOT NULL DEFAULT 'in_progress',
    synced                   INTEGER NOT NULL DEFAULT 0,
    runner_session_created   INTEGER NOT NULL DEFAULT 0,
    runner_session_finished  INTEGER NOT NULL DEFAULT 0,
    created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`;

// Migración liviana para bases existentes (CREATE TABLE IF NOT EXISTS no agrega
// columnas). Los ALTER se corren en try/catch: si la columna ya existe, SQLite
// tira "duplicate column name" y se ignora.
const RUNNER_SESSION_COLUMN_MIGRATIONS = [
  'ALTER TABLE session_runs ADD COLUMN runner_session_created INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE session_runs ADD COLUMN runner_session_finished INTEGER NOT NULL DEFAULT 0',
];

const CREATE_EXERCISE_SETS = `
  CREATE TABLE IF NOT EXISTS exercise_sets (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id               INTEGER NOT NULL REFERENCES session_runs(id) ON DELETE CASCADE,
    exercise_instance_id INTEGER NOT NULL,
    exercise_name        TEXT NOT NULL,
    set_number           INTEGER NOT NULL,
    display_order        INTEGER NOT NULL,
    status               TEXT NOT NULL DEFAULT 'pending',
    started_at           TEXT,
    ended_at             TEXT,
    duration_ms          INTEGER,
    active_duration_ms   INTEGER,
    distance_meters      REAL,
    synced               INTEGER NOT NULL DEFAULT 0,
    UNIQUE (run_id, exercise_instance_id, set_number)
  );
`;

const CREATE_GPS_POINTS = `
  CREATE TABLE IF NOT EXISTS gps_points (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id         INTEGER NOT NULL REFERENCES exercise_sets(id) ON DELETE CASCADE,
    point_order    INTEGER NOT NULL,
    latitude       REAL NOT NULL,
    longitude      REAL NOT NULL,
    recorded_at_ms INTEGER NOT NULL,
    UNIQUE (set_id, point_order)
  );
`;

export async function initSessionDb() {
  const db = await getDb();
  await db.execAsync(`PRAGMA journal_mode = WAL;${CREATE_SESSION_RUNS}${CREATE_EXERCISE_SETS}${CREATE_GPS_POINTS}`);
  for (const statement of RUNNER_SESSION_COLUMN_MIGRATIONS) {
    try {
      await db.execAsync(statement);
    } catch {
      // columna ya existente — ok
    }
  }
}

// Crea el run y siembra TODAS las series de la sesión como `pending` (los ids
// de ejercicios son del backend: exercise_instance_id). Devuelve el runId.
export async function createRun({ sessionInstanceId, sessionName, sessionDate, teamId, userId, gpsEnabled, exercises }) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO session_runs
       (session_instance_id, session_name, session_date, team_id, athlete_user_id, gps_enabled, started_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [toNumberOrNull(sessionInstanceId), sessionName, sessionDate, toNumberOrNull(teamId), toNumberOrNull(userId), gpsEnabled ? 1 : 0, toIsoUtc(), RUN_STATUS.IN_PROGRESS]
  );
  const runId = result.lastInsertRowId;
  let displayOrder = 0;
  for (const exercise of exercises ?? []) {
    const repeatCount = Math.max(1, exercise.repeatCount ?? 1);
    for (let setNumber = 0; setNumber < repeatCount; setNumber++) {
      await db.runAsync(
        `INSERT INTO exercise_sets (run_id, exercise_instance_id, exercise_name, set_number, display_order, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [runId, toNumberOrNull(exercise.id), exercise.name ?? '', setNumber, displayOrder++, SET_STATUS.PENDING]
      );
    }
  }
  return runId;
}

// Reanudar una sesión a medio andar (re-entrada a la pantalla en la misma
// sesión de app): mismo (session_instance_id, session_date) in_progress.
export async function getActiveRun(sessionInstanceId, sessionDate) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM session_runs
     WHERE session_instance_id = ? AND session_date = ? AND status = ?
     ORDER BY id DESC LIMIT 1`,
    [toNumberOrNull(sessionInstanceId), sessionDate, RUN_STATUS.IN_PROGRESS]
  );
  return rows[0] ?? null;
}

export async function getRun(runId) {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM session_runs WHERE id = ?', [runId]);
  return rows[0] ?? null;
}

export async function getSetsForRun(runId) {
  const db = await getDb();
  return await db.getAllAsync('SELECT * FROM exercise_sets WHERE run_id = ? ORDER BY display_order ASC', [runId]);
}

export async function markSetStarted(setId, startedAtIso) {
  const db = await getDb();
  await db.runAsync(`UPDATE exercise_sets SET status = ?, started_at = ? WHERE id = ?`, [SET_STATUS.STARTED, startedAtIso, setId]);
}

export async function markSetSkipped(setId) {
  const db = await getDb();
  await db.runAsync(`UPDATE exercise_sets SET status = ? WHERE id = ?`, [SET_STATUS.SKIPPED, setId]);
}

// Saltear todas las series pendientes/en curso de un ejercicio en un run.
export async function skipSetsForExercise(runId, exerciseInstanceId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE exercise_sets SET status = ? WHERE run_id = ? AND exercise_instance_id = ? AND status IN (?, ?)`,
    [SET_STATUS.SKIPPED, runId, toNumberOrNull(exerciseInstanceId), SET_STATUS.PENDING, SET_STATUS.STARTED]
  );
}

// Snapshot de tiempos en pausa — permite cerrar la vista de serie con el set a
// medio andar y reanudar conservando lo acumulado.
export async function updateSetTimings(setId, { durationMs, activeDurationMs }) {
  const db = await getDb();
  await db.runAsync(`UPDATE exercise_sets SET duration_ms = ?, active_duration_ms = ? WHERE id = ?`, [
    durationMs ?? null,
    activeDurationMs ?? null,
    setId,
  ]);
}

export async function updateSetDistance(setId, distanceMeters) {
  const db = await getDb();
  await db.runAsync(`UPDATE exercise_sets SET distance_meters = ? WHERE id = ?`, [distanceMeters ?? null, setId]);
}

export async function finishSet(setId, { endedAtIso, durationMs, activeDurationMs, distanceMeters }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE exercise_sets SET status = ?, ended_at = ?, duration_ms = ?, active_duration_ms = ?, distance_meters = ? WHERE id = ?`,
    [SET_STATUS.FINISHED, endedAtIso, durationMs ?? null, activeDurationMs ?? null, distanceMeters ?? null, setId]
  );
}

export async function markSetInterrupted(setId, { endedAtIso, durationMs, activeDurationMs, distanceMeters }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE exercise_sets SET status = ?, ended_at = ?, duration_ms = ?, active_duration_ms = ?, distance_meters = ? WHERE id = ?`,
    [SET_STATUS.INTERRUPTED, endedAtIso, durationMs ?? null, activeDurationMs ?? null, distanceMeters ?? null, setId]
  );
}

// Cancelación de sesión: todo set que quedó a medio andar (status `started`,
// pausado o no) pasa a `interrupted` conservando los timings ya persistidos.
export async function interruptStartedSets(runId) {
  const db = await getDb();
  await db.runAsync(`UPDATE exercise_sets SET status = ? WHERE run_id = ? AND status = ?`, [
    SET_STATUS.INTERRUPTED,
    runId,
    SET_STATUS.STARTED,
  ]);
}

export async function markSetSynced(setId) {
  const db = await getDb();
  await db.runAsync('UPDATE exercise_sets SET synced = 1 WHERE id = ?', [setId]);
}

export async function insertGpsPoint(setId, pointOrder, latitude, longitude, recordedAtMs) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO gps_points (set_id, point_order, latitude, longitude, recorded_at_ms) VALUES (?, ?, ?, ?, ?)`,
    [setId, pointOrder, latitude, longitude, recordedAtMs]
  );
}

export async function getGpsPoints(setId) {
  const db = await getDb();
  return await db.getAllAsync('SELECT * FROM gps_points WHERE set_id = ? ORDER BY point_order ASC', [setId]);
}

export async function finalizeRun(runId) {
  const db = await getDb();
  await db.runAsync(`UPDATE session_runs SET status = ?, ended_at = ? WHERE id = ?`, [RUN_STATUS.COMPLETED, toIsoUtc(), runId]);
}

export async function cancelRun(runId) {
  const db = await getDb();
  await db.runAsync(`UPDATE session_runs SET status = ?, ended_at = ? WHERE id = ?`, [RUN_STATUS.CANCELLED, toIsoUtc(), runId]);
}

export async function markRunSynced(runId) {
  const db = await getDb();
  await db.runAsync('UPDATE session_runs SET synced = 1 WHERE id = ?', [runId]);
}

// Flags del estado runner_session en el backend (ver spec de
// session-registration-review): el create idempotente y el PATCH finished se
// reintentan desde el pipeline de sync hasta quedar persistidos acá.
export async function markRunnerSessionCreated(runId) {
  const db = await getDb();
  await db.runAsync('UPDATE session_runs SET runner_session_created = 1 WHERE id = ?', [runId]);
}

export async function markRunnerSessionFinished(runId) {
  const db = await getDb();
  await db.runAsync('UPDATE session_runs SET runner_session_finished = 1 WHERE id = ?', [runId]);
}

// Los sets que hay que popular al backend al finalizar (finished/skipped,
// todavía sin syncar), en orden de sesión.
export async function getSetsForSync(runId) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM exercise_sets
     WHERE run_id = ? AND synced = 0 AND status IN (?, ?)
     ORDER BY display_order ASC`,
    [runId, SET_STATUS.FINISHED, SET_STATUS.SKIPPED]
  );
}