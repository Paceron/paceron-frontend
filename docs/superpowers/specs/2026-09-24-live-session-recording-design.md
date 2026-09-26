# Registro de actividad en vivo — toma de series con cronómetro, GPS y sync a workout_feedback

## Contexto

Continúa `docs/superpowers/specs/2026-09-23-live-session-base-design.md` (PR #136), que dejó la
navegación lista: calendario → pre-start (`session-pre-start-screen.jsx`) → ruta stub
`/training-session-active`. Esta spec construye la interfaz real de registro: listado de ejercicios
con desbloqueo por orden, vista de serie por serie con cronómetro/GPS/SKIP/FINISH, persistencia local
en SQLite durante la sesión (offline-first) y sync al backend al finalizar (tabla `workout_feedback`
+ tabla nueva `workout_feedback_points`).

Flujo funcional requerido:

- Una sesión tiene muchos ejercicios; cada ejercicio tiene 1..N series. La toma de tiempos es
  **estrictamente secuencial**: no se puede tomar una serie sin haber finalizado (o salteado) la
  anterior, ni avanzar a otro ejercicio sin terminar el anterior.
- Cada serie termina persistiendo sus datos en SQLite (expo-sqlite).
- Al finalizar todas las series de la sesión, se "popular" el backend con un array ordenado de sets
  (o varios calls, ver Sync).
- Permiso de GPS: se pide **una única vez por sesión**, al tocar Play en el pre-start. Si se niega o
  el GPS falla, todo el resto de la toma corre igual, sin distancias.
- `set_number` es 0-based (primera serie = 0) — alineado al default `set_number = 0` del backend
  (`workout_feedback`) y a `SetNumber >= 0` de su validación.

## Alcance

**Sí:**
- Pantalla activa real: listado de ejercicios/series con progreso + vista de serie a pantalla
  completa dentro de la misma ruta.
- Cronómetro `MM:SS:CC` (centésimas), cuenta regresiva de 5 s antes del arranque, PAUSE/resume.
- GPS: permiso único, sampleo ~1 s durante las series en curso, puntos persistidos por serie,
  distancia acumulada por haversine (valor absoluto entre pares consecutivos).
- SKIP de serie o de ejercicio completo (mini-menú), STATUS `pending|started|skipped|finished`
  (+ `interrupted` al cancelar), FINISH de 2 toques, STOP inferior con hold de 3 s + confirmación.
- Persistencia local SQLite (tablas `session_runs`, `exercise_sets`, `gps_points`).
- Sync al backend al finalizar: sets `finished`/`skipped` → `POST /workout-feedback` por serie +
  `POST /workout-feedback/:id/points` si hay puntos; 409 = ya existe (marcar syncado); fallo = retry.
- Cancelación: se conserva lo registrado, se syncan solo los sets `finished`/`skipped`, la serie en
  vuelo queda `interrupted` y no se sube.
- Backend: SDD + implementación de `workout_feedback_points` y sus endpoints (contract abajo, el
  desarrollo Go vive en el repo `paceron-backend` con su propio change OpenSpec).

**No** (fuera de alcance, quedan documentados como futuro):
- Tracking en background + notificación persistente de Android/iOS mientras corre la serie.
- Historial (ver/editar/eliminar actividad finalizada; Gap 12) y su UI multiplataforma.
- Presencial (entrenador): asistencia/QR, monitoreo en vivo, reportar por otro atleta.
- RPE / pulso / peso / repeticiones / elevación: el schema de `workout_feedback` los soporta, pero
  esta versión no los captura; quedan `NULL`.
- Descanso entre series con temporizador propio (los `restMinutes` se muestran, no se cronometran).

## Modelo de datos local (SQLite, expo-sqlite)

Nueva dependencia: `expo-sqlite` (SDK 54 → ~19.x). **Requiere regenerar el dev client** (quirk
documentado en CLAUDE.md — Expo Go no sirve desde el módulo nativo de maplibre). Web no aplica
(las dos rutas son nativo-only vía `MobileOnlyRoute`), pero la lib soporta web (wa-sqlite) si
algún día se necesita para debug.

Esquema (datos en SQLite durante toda la sesión, son la fuente de verdad local; el store solo
sostiene lo transitorio):

```sql
CREATE TABLE IF NOT EXISTS session_runs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_instance_id INTEGER NOT NULL,               -- del backend (pendingSession.sessionInstance.id)
  session_name        TEXT NOT NULL,
  session_date        TEXT NOT NULL,                  -- YYYY-MM-DD
  team_id             INTEGER,                        -- nullable (solo si el origen lo trae)
  athlete_user_id     INTEGER,                        -- userId del auth store
  report_source       TEXT NOT NULL DEFAULT 'corredor',
  gps_enabled         INTEGER NOT NULL DEFAULT 0,
  started_at          TEXT,                           -- ISO 8601
  ended_at            TEXT,
  status              TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | completed | cancelled
  synced              INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS exercise_sets (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id               INTEGER NOT NULL REFERENCES session_runs(id) ON DELETE CASCADE,
  exercise_instance_id INTEGER NOT NULL,              -- del backend (exercise.id)
  exercise_name        TEXT NOT NULL,                 -- denormalizado (display/store offline)
  set_number           INTEGER NOT NULL,              -- 0-based, ordinal por ejercicio
  display_order        INTEGER NOT NULL,              -- ordina la sesión completa (cursor)
  status               TEXT NOT NULL DEFAULT 'pending', -- pending | started | skipped | finished | interrupted
  started_at           TEXT,
  ended_at             TEXT,
  duration_ms          INTEGER,                       -- tiempo de pared
  active_duration_ms   INTEGER,                       -- sin pausas
  distance_meters      REAL,                          -- acumulado haversine absoluto
  synced               INTEGER NOT NULL DEFAULT 0,
  UNIQUE (run_id, exercise_instance_id, set_number)   -- mismo invariante que unique_feedback_per_set
);

CREATE TABLE IF NOT EXISTS gps_points (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id         INTEGER NOT NULL REFERENCES exercise_sets(id) ON DELETE CASCADE,
  point_order    INTEGER NOT NULL,                    -- ordinal por serie (0,1,2,...)
  latitude       REAL NOT NULL,
  longitude      REAL NOT NULL,
  recorded_at_ms INTEGER NOT NULL,
  UNIQUE (set_id, point_order)
);
```

- Al crear un run se siembran **todas** las series de la sesión como `pending` (ejercicio ×
  `repeatCount`), con `display_order` global secuencial.
- Re-entrada a la pantalla: se busca el run `in_progress` para la misma `(session_instance_id,
  session_date)` y se reanuda; si no existe, se crea uno nuevo.

## Store y servicios

- **`store/live-session-store.js`** (Zustand, estado de app): `runId`, `gpsEnabled` y limpieza.
  Sesión de datos en `store/session-runtime-store.js` (ya existe, `pendingSession`).
- **`services/session-db.js`** — DAO de SQLite: `initSessionDb`, `createRun`, `getActiveRun`,
  `getRun`, `getSetsForRun`, `markSetStarted`, `markSetSkipped`, `markSetInterrupted`,
  `finishSet`, `updateSetTimings` (snapshot de pausa), `updateSetDistance`, `insertGpsPoint`,
  `getGpsPoints`, `getSetsForSync`, `markSetSynced`, `finalizeRun`, `cancelRun`, `markRunSynced`.
- **`services/workoutFeedback.js`** + mock (`services/__mocks__/workoutFeedback-mock.js`) — llamadas
  a `POST /workout-feedback` y `POST /workout-feedback/:id/points` (patrón de dominio del repo).
- **`services/session-sync.js`** — orquestador de sync: lee sets no syncados, construye payloads,
  llama al servicio, marca `synced`, trata 409 como "ya existía", corta ante error de red y devuelve
  resumen `{ synced, conflicts, errors }`.
- **`utils/session-sync-payload.js`** — construcción **pura** del payload de un set (testeable):
  `team_id` (nullable), `assigned_session_id`/`assigned_exercise_id` (Number), `athlete_user_id`,
  `report_source`, `session_date`, `set_number`, `started_at`/`ended_at` (ISO), `duration_ms`,
  `active_duration_ms`, `distance_meters`, `completion_status` (`completed` | `skipped`).
- **`utils/distance.js`** — `haversineMeters(lat1, lng1, lat2, lng2)` (pura). Es distancia absoluta
  por definición (metros entre dos puntos ≥ 0), la suma acumulada no depende de la dirección.
- **`utils/time.js`** — `formatStopwatch(ms)` → `MM:SS:CC` (centésimas), `pad2`, helpers `nowIso()`.
- **`hooks/use-stopwatch.js`** — cronómetro: `start` (setea el epoch), `pause`, `resume`, `reset`;
  expone `wallMs`/`activeMs` con tick ~50 ms. La lógica de tiempos es pura (base = timestamp).
- **`hooks/use-gps-tracker.js`** — sampleo: `start(handlers)`/`stop()` sobre
  `Location.watchPositionAsync({ accuracy: Balanced, timeInterval: 1000, distanceInterval: 1 })`.
  No pide permisos (eso ya se hizo en el pre-start); si no está habilitado, no hace nada.

## Pantalla activa (`components/session-runtime/`)

Reemplaza el stub `training-session-active-screen.jsx` (misma ruta). Dos vistas dentro de la misma
ruta (sin `Modal` para la vista de serie — evita los pitfalls de Modal+gestos y se evita el
anidamiento de `ScrollView`s documentado en CLAUDE.md; los `Modal` solo se usan para confirmaciones/
resúmenes, copiando el patrón `*-backdrop`/`*-card` + `notifyWarning`).

**Guard de entrada:** sin `pendingSession` (o web) → `<Redirect href="/" />` (igual que pre-start).

### Vista 1 — Resumen de la sesión
- Header: botón volver (`router.back()`), nombre de sesión, fecha, progreso `sets listos/total`.
- `ScrollView` con un bloque por ejercicio y chips por serie mostrando estado
  (`pending`/`started`/`skipped`/`finished` con íconos y colores). **Solo el ejercicio "proximo"
  (el primero con series pendientes) es clickeable** — los anteriores muestran estado y los
  siguientes se ven atenuados/deshabilitados.
- Pie fijo: botón **STOP** que requiere **mantener presionado 3 s** y abre el modal de confirmación
  de cancelación. En web (`isWeb`, si algún día se viera) el hold no aplica — mismo criterio que
  `DraggableExerciseCard` (ver CLAUDE.md): el hold es solo para nativo, en web alcanza un tap que
  abre la confirmación directo.

### Vista 2 — Serie en curso ("próxima serie a realizar")
- Título del ejercicio + badge `Serie X de Y` + `reps/descanso` informativos.
- Cronómetro grande (`Orbitron_700Bold`, `MM:SS:CC`).
- **PLAY grande** (abajo): 1ª vez en la serie → **cuenta regresiva de 5 s** (overlay, 5..1) y al
  llegar a 0: persiste `started_at`, estado `started`, arranca cronómetro, persiste punto GPS
  inicial y activa el sampleo. Durante la serie el botón es **PAUSE** (congela cronómetro, guarda
  snapshot de tiempos, detiene GPS). Tap en PAUSADO → vuelve a PLAY y **reanuda** (sin cuenta
  regresiva: el countdown es solo del arranque de la serie).
- **SKIP**: mini-menú con dos opciones — *Saltar esta serie* (este set → `skipped`, avanza al
  siguiente set) y *Saltar todo el ejercicio* (todas las series pendientes de este ejercicio →
  `skipped`, avanza). Persiste los skips en SQLite. Habilitado en estados `ready`/`paused` (durante
  `running` se pausa primero; durante el countdown se cancela el countdown).
- **FINISH** (junto a PLAY): de **2 toques** — el 1º arma la confirmación (texto "Tocá de nuevo
  para finalizar", ventana de 4 s), el 2º dentro de la ventana finaliza la serie: persiste
  `ended_at`, `duration_ms`, `active_duration_ms`, `distance_meters`, estado `finished`, último
  punto GPS, detiene sampleo. Abre el **resumen de la serie** (tiempos + distancia): al cerrar,
  avanza automáticamente a la siguiente serie pendiente o, si se terminó la sesión entera, al flujo
  de finalización.

### Flujo de finalización de sesión
- Última serie finalizada → enviar estado: `ended_at` del run, status `completed`.
- Modal "Sesión completada" con resumen (set realizados/salteados, duración total, distancia total)
  y botón **Sincronizar** → `session-sync.js`. Resultado con toast: éxito / "algunos ya estaban
  registrados" / error con botón **Reintentar** (no se marca `synced` lo que falló, sigue en SQLite).
- Al cerrar: `router.back()` (vuelve al pre-start) y se limpia `live-session-store` (los datos
  siguen en SQLite).

### Cancelación (STOP)
- Hold 3 s → modal confirmación (`notifyWarning`; patrón `delete-training-plan-modal.jsx`).
- Confirmar: serie en vuelo (si la hay) → `interrupted` con sus snapshots; run → `cancelled`;
  sync de los sets `finished`/`skipped` (misma lógica que la finalización, con su toast/retry);
  limpiar store y `router.back()`.

## Permiso de GPS (una vez por sesión)

En `session-pre-start-screen.jsx`, el `onPress` del Play: antes de navegar,
`Location.requestForegroundPermissionsAsync()` (patrón de `hooks/use-location-picker.js`). Resultado:
- `granted` → `gpsEnabled = true`.
- negado o error → `gpsEnabled = false` sin bloquear (aviso sutil no invasivo, no romper el flujo;
  se puede sumar un `Toast` de tipo info).
Luego escribe `pendingSession` (ya estaba) y navega. `watchPositionAsync` solo se activa si
`gpsEnabled` es verdadero.

## Sync al backend

Al finalizar (o cancelar): por cada set `finished`/`skipped` no syncado →

```js
POST /api/v1/workout-feedback
{
  team_id, assigned_session_id: Number(run.session_instance_id),
  assigned_exercise_id: Number(set.exercise_instance_id),
  athlete_user_id, report_source: 'corredor', session_date,
  set_number, started_at, ended_at, duration_ms, active_duration_ms,
  distance_meters, completion_status   // 'completed' | 'skipped'
}
```

Si el feedback se crea y el set tiene `distance_meters !== null` y puntos →

```js
POST /api/v1/workout-feedback/:id/points
{ "points": [ { "order": n, "session_instance_id": ..., "exercise_instance_id": ...,
                "latitude": ..., "longitude": ..., "recorded_at": ISO } ] }
```

Reglas:
- **409** en el POST del set → el set ya existe server-side (índice único
  `unique_feedback_per_set`); se marca `synced` y se continúa.
- Error de red/5xx → se corta el loop, el set sigue sin `synced` y el usuario reintenta.
- Concurrencia acotada no hace falta para el volumen típico (~20-30 sets): secuencial alcanza, cada
  POST es rápido. Si crece, se pasa a un pool de 3-4 sin cambiar el contrato.
- `duration_ms` = tiempo de pared (start→finish incluyendo pausas);
  `active_duration_ms` = solo segmentos activos.

## Contracto backend a implementar (desarrollo en paceron-backend)

Módulo nuevo ligero sobre el patrón existente del backend (Controller → Service → DAO → postgres)
y el change OpenSpec correspondiente (`openspec/changes/<nombre>/`).

- **Tabla `workout_feedback_points`:**
  `id BIGSERIAL PK`, `feedback_id BIGINT NOT NULL`, `session_instance_id BIGINT NOT NULL`,
  `exercise_instance_id BIGINT NOT NULL`, `"order" INT NOT NULL`, `latitude DOUBLE PRECISION`,
  `longitude DOUBLE PRECISION`, `recorded_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`,
  `UNIQUE (feedback_id, "order")`. `session_instance_id`/`exercise_instance_id` van denormalizados
  (además del `feedback_id`) para consultas por sesión/ejercicio sin join, según requerimiento.
- **`POST /api/v1/workout-feedback/:id/points`** — bulk upsert de puntos de una serie
  (`INSERT ... ON CONFLICT (feedback_id, "order") DO NOTHING` → reintentar no duplica). Valida que
  el feedback exista y que el auth sea atleta / reportante / team-owner (misma matriz de auth del
  módulo). Responde `{ message, data: { created, skipped } }`.
- **`GET /api/v1/workout-feedback/:id/points`** — listar el recorrido (para el historial futuro).
- Sin índice único nuevo sobre sets del backend: `unique_feedback_per_set` ya cubre la
  idempotencia del set.

## Testing

- Jest (lógica pura): `utils/distance.js` (haversine con distancias conocidas, simetría, punto
  repetido = 0), `utils/time.js` (`formatStopwatch`, pads), `utils/session-sync-payload.js`
  (payload de set finished/skipped, coerción de ids a Number, nulos).
- Sin tests de render (convención del proyecto). Verificación visual: manual en dispositivo real
  (dev client). En preview web `MobileOnlyRoute` deja la pantalla como "solo nativo".
- Backend: `go test ./...` del módulo de points (controller/service/dao, `testify`, patrón de
  `workout_feedback_*_test.go`).

## Definiciones de diseño a dejar escritas (CLAUDE.md)

- Entrada en "Quirks conocidos": `expo-sqlite` suma un módulo nativo más — **no se requiere** un
  dev client nuevo por sí solo (maplibre ya obligó a eso), pero cualquier build futuro debe
  incluir el plugin/config sqlite si se agrega plugin de expo-sqlite (hoy `app.config.js` no lo
  necesita para la API base).
- Agregar una línea de convención si aplica (sync offline-first con flags `synced` como patrón de
  referencia para el historial del Gap 12).