# Registro de Sesión: estado de sesión del corredor (WIP → finished) + revisión/edición de lo registrado

## Contexto

Cierra el ciclo del registro en vivo (specs `2026-09-23-live-session-base-design.md` y
`2026-09-24-live-session-recording-design.md`): hoy la toma de series termina con `workout_feedback`
persistido en el backend, pero no hay forma de (a) saber que esa sesión ya se completó, ni (b) volver
a ver y editar lo registrado. Esta spec agrega ambas cosas, con estado en el backend.

Flujo funcional requerido:

- **Toda sesión de fecha pasada entra al "Registro de Sesión"** (nunca más Play), esté completada o
  no — **todas son editables**:
  - Completada (todas las series de todos los ejercicios) → badge verde **"Sesión completada"** +
    modo **revisión** (datos ya cargados).
  - No completada → sin badge, modo **ingreso manual** (editor vacío, se cargan tiempos/distancia a
    mano).
  - Las de hoy, en la ventana de inicio, conservan el botón Play (toma en vivo).
- Al entrar a **Registro de Sesión**: pantalla similar a la del listado de ejercicios de la toma,
  que al hacer clic en un ejercicio y/o una serie **ocupa la pantalla** con el detalle de lo
  persistido en `workout_feedback` y **permite editarlo**.
- **Plataformas de edición:** en **mobile** edita el corredor (sobre su feedback); en **web** editan
  el corredor **y** el entrenador. El entrenador selecciona de qué corredor ver/editar el feedback
  por día pasado (selector con autocompletado + confirmar) antes del entra a la experiencia.
- Para persistir el estado de la sesión del corredor: **tabla nueva en el backend** que relaciona
  la sesión asignada (`session_instance`) con el usuario (`athlete_user`) y su status. Se crea la
  primera vez que se da Play, **o en el primer ingreso del registro manual**, en status `wip` con
  `start_date`; al completarse todas las series pasa a `finished` con `end_date`. **La creación es
  idempotente** (nunca duplicar).

Esta spec cubre decisión de diseño + contrato. La implementación Go vive en `paceron-backend` con su
propio change OpenSpec (mismo patrón que `workout_feedback_points`); el front end en este repo.

## Alcance

**Sí:**
- Tabla `runner_session` (nueva) con `UNIQUE (session_instance_id, athlete_user_id)` y status
  `wip | finished`, `start_date`/`end_date` (`TIMESTAMPTZ`).
- Creación en el primer Play (`POST`), transición a `finished` al completar la sesión.
- Endpoint de **consulta de estado** (corredor self y entrenador por atleta).
- Endpoint de **listado de feedback de una sesión** (para la pantalla de revisión).
- `PATCH` de un `workout_feedback` (edición de tiempos y distancia), autenticado para el atleta
  dueño **o** el entrenador/owner del equipo.
- Front: botón "Registro de Sesión" en el pre-start (en lugar de Play) para **toda sesión de fecha
  pasada** — con badge verde "Sesión completada" si está completada (modo revisión), sin badge y en
  **ingreso manual** si no (editor vacío).
- Front: pantalla de revisión **multiplataforma** (mobile + web) con lista de ejercicios/series +
  detalle a pantalla completa con edición — modo revisión (datos cargados) y modo manual (editor
  vacío). Mobile: la usa el corredor; web: corredor y entrenador.
- Front: **selector de corredor con autocompletado + confirmar** para que el entrenador elija de qué
  miembro del equipo ver/editar el feedback en un día pasado (entrada desde el calendario grupal).
- Creación de `runner_session` idempotente en el primer Play **y** en el primer ingreso manual.

**No** (fuera de alcance, quedan documentados como futuro):
- Historial multiplataforma completo (listar actividades de todos los corredores, eliminar — Gap 12).
- RPE / pulso / peso / repeticiones: el schema las soporta, esta versión solo edita tiempos y
  distancia.
- Edición de la ruta GPS (puntos) — solo lectura (se preservan tal como se grabaron).
- Presencial: asistencia/QR y monitoreo del entrenador sobre un corredor en vivo (módulo aparte).
- Rearmar el recorrido/estado de un `workout_feedback` a partir de los puntos (futuro).

## Decisión: `runner_session` es la fuente de verdad del estado

El "completado" del badge no se deriva de si el usuario tiene feedback syncado: después de un
cancel intermedio puede haber feedback parcial sin que la sesión esté completa. `runner_session`
es la única fuente confiable porque se crea en el Play (cubre arrancadas que nunca se syncaron) y
se pisa a `finished` solo al completar todas las series.

### Tabla

```sql
CREATE TABLE runner_session (
  id                  BIGSERIAL PRIMARY KEY,
  session_instance_id BIGINT NOT NULL REFERENCES session_instances(id),
  athlete_user_id     BIGINT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'wip',  -- wip | finished
  start_date          TIMESTAMPTZ NOT NULL,
  end_date            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_instance_id, athlete_user_id)
);
```

- Se crea **una sola vez**, en el primer Play. Reintentos/duplicados → upsert idempotente
  (`ON CONFLICT (session_instance_id, athlete_user_id) DO NOTHING` en el create; ver Sync).
- `start_date` = instante del primer Play (timezone del cliente, ISO 8601).
- `end_date` = instante en que la última serie queda `finished`.

## Endpoints (backend)

Todos bajo `/api/v1`, mismo patrón de auth del módulo de feedback (matriz: atleta / reportante /
team-owner).

| Método | Ruta | Cuerpo / params | Función | Auth |
|---|---|---|---|---|
| POST | `/session-instances/{id}/runner` | `{ start_date }` | Crea `runner_session` en `wip` (idempotente) | El actor es el atleta dueño |
| PATCH | `/session-instances/{id}/runner` | `{ status: 'finished' }` | Pasa a `finished` + `end_date` | Atleta dueño o trainer/owner del team |
| GET | `/session-instances/{id}/runner` | `?athlete_user_id=` | Estado actual (self si se omite el param) | Atleta dueño o trainer/owner |
| GET | `/session-instances/{id}/feedback` | — | Todos los `workout_feedback` de esa sesión (una fila por set), ordenados por `(assigned_exercise_id, set_number)` | Atleta dueño o trainer/owner |
| PATCH | `/workout-feedback/{id}` | `{ duration_ms?, active_duration_ms?, distance_meters? }` | Edita valores de una serie | Atleta dueño (el `athlete_user_id` del row) o trainer/owner |

Reglas:

- `POST runner` idempotente: si ya existe la fila devuelve `200` con el estado actual (nunca pisa
  `start_date` ni baja de `finished` a `wip`).
- `PATCH runner` con `finished` solo cuando el estado actual es `wip`; setea `end_date = now()`
  (o el del body si lo manda el cliente por latencia — se toma `now()` del servidor).
- `PATCH workout-feedback`: solo para `completion_status = 'completed'`; `skipped` no tiene valores
  que editar. Valida que `duration_ms >= 0`, `distance_meters >= 0`. `report_source` no cambia.
- El **create** de un `workout_feedback` para el modo manual usa el `POST /workout-feedback`
  **existente** (el del sync, ya implementado) — idempotente vía `unique_feedback_per_set`
  (409 → PATCH). No se agrega un POST nuevo de feedback.
- `GET feedback` devuelve también `exercise_name` denormalizado si el row lo tiene, para que el
  front arme el agrupamiento por ejercicio sin joins extra; si una serie no tiene feedback (no
  registrada), simplemente no aparece — el front la muestra como "sin registro" contra el shape
  del `session_instance`.

## Sync / creación en el Play

El flujo es offline-first (la toma corre entera en SQLite y se syncan al final). Para `runner_session`:

1. **Al tocar Play** (en `session-pre-start-screen.jsx`): fire-and-forget `POST runner` (no se
   espera para navegar). Si falla (offline/5xx), el run local queda con
   `runner_session_created = 0` y **el pipeline de sync reintenta el mismo upsert antes del primer
   `POST workout-feedback`** (ídem idempotencia). Así un arranque offline no pierde el `wip`.
2. **Al completar la sesión** (última serie `finished` + sync del run): `PATCH runner { finished }`.
   Misma política: si falla, se queda en cola para el retry del sync (el run ya está `completed`;
   el estado `wip` en backend se corrige en el próximo sync).
3. **Primer ingreso al modo manual** (fecha pasada, `POST runner`): mismo upsert **idempotente** —
   si la fila ya existía (ej. un `wip` que venció la fecha sin completarse) el servidor devuelve `200`
   con el estado actual y **no crea una segunda fila**; no baja de `finished` a `wip`. El front no
   necesita "saber" si ya existe: envía el mismo `POST` y trata cualquier `200` como ok.

Cola: reusar el mecanismo offline ya existente (`session_runs.synced`, retry del `services/session-sync.js`)
con un flag nuevo `runner_session_created` / `runner_session_finished` en la tabla `session_runs`
local (columnas adicionales, default 0).

## Front end

### 1) Pre-start (`components/session-runtime/session-pre-start-screen.jsx`)

- En foco (`useFocusEffect` + TanStack Query, hook `hooks/use-runner-session.js`):
  `GET .../runner` para `pendingSession.sessionInstance.id` + `userId`.
- Nueva helper pura en `utils/session-start-window.js`: `isPastSessionDate(day, now)` → `true` si la
  fecha del día es anterior a hoy (testeable con Jest, mismo patrón que `canStartAsyncSession`).
- **Lógica del bloque inferior (decide qué muestra el pre-start):**
  - `isPastSessionDate(...)` **y** `status === 'finished'` → badge verde **"Sesión completada"** en
    el tope + botón **"Registro de Sesión"** (modo revisión: datos cargados).
  - `isPastSessionDate(...)` **y** `status !== 'finished'` → sin badge, botón **"Registro de
    Sesión"** (modo manual: editor vacío, sin datos precargados). Al primer ingreso crea
    `runner_session` (`POST .../runner`, idempotente — ver Sync).
  - En ventana (la fecha todavía no pasó) → se mantiene el botón Play actual.
- Botón "Registro de Sesión": tono primario, ícono `clipboard-text-outline` → navega a
  `/training-session-review` cargando el store de revisión con `mode: 'review' | 'manual'`.

### 2) Store + ruta de revisión

- **`store/session-review-store.js`** (Zustand, slot transitorio como `session-runtime-store`):
  `{ sessionInstance, date, sessionName, role, athleteUserId, mode }` con `mode: 'review' | 'manual'`.
  Se llena antes de navegar — mismo patrón de `pendingSession`, sin serializar arrays en la URL.
- **Ruta `app/training-session-review.jsx`** **multiplataforma** (fuera de `(tabs)`; guard de
  entrada `<Redirect>` si falta el slot). Componentes en `components/session-runtime/session-review-screen.jsx`
  — la revisión/edición funciona en mobile y web (formularios con `Row`/`Col` de
  `components/forms/fields.jsx` y `ResponsiveSelectField`; no hereda el aparato de gesture-handler
  de la toma, no usa gestos).
- **Corredor (mobile):** viene del pre-start (el store se llena con `pendingSession` +
  `role='runner'` + `mode` según la rama que mostró el botón).
- **Corredor (web):** entrada desde el **detalle del día** de su calendario (vista agregada,
  `use-aggregated-calendar`) en una fecha pasada → misma pantalla, mismo `mode` (ver Asunciones).
- **Entrenador (web):** selector de corredor (ver sección 4) desde el calendario grupal en un día
  pasado → confirma corredor → pantalla de revisión con `athleteUserId` + `mode` (`review` o
  `manual` según el estado del atleta y la fecha).

### 4) Selector de corredor del entrenador (web)

- Entrada: `group-calendar-day-screen.jsx` (web, resolución con día pasado) → acción
  "Ver registros" (o similar) para ese día.
- `components/team/athlete-picker-modal.jsx`: lista desplegable de **atletas del equipo** (roster,
  `use-team-roster`) con **autocompletado** (input filtra por nombre a medida que se escribe) →
  el entrenador **selecciona** un corredor → botón **"Confirmar"** → rellena el store de revisión
  (`athleteUserId` del elegido + `mode` según estado/fecha) y navega a `/training-session-review`.
- El flujo de elegir-corredor es **anterior** a entrar a la experiencia de revisión — no se entra
  a la pantalla sin corredor confirmado (a diferencia del corredor, que ya entra "con" su id).

### 3) Pantalla de revisión (`session-review-screen.jsx`)

Dos vistas dentro de la misma ruta (sin `Modal` para el detalle — mismo motivo que la spec de
recording: stack de navegación interno o dos sub-vistas con estado).

**Vista A — lista de ejercicios/series:**
- Header: volver, nombre de sesión, fecha, badge de estado.
- `ScrollView` con un bloque por ejercicio (del shape del `session_instance`) y filas por serie con
  su estado desde el `GET feedback` (completada → valores, salteada → "Saltada", sin registro →
  "Sin registro").
- Tap en un ejercicio **o** en una serie → Vista B.

**Vista B — detalle a pantalla completa + edición:**
- **Modo revisión:** info persistida — tiempos (pared/activo), distancia, `started_at`/`ended_at`,
  puntos GPS (solo-lectura).
- **Modo manual:** editor **vacío** (la sesión de fecha pasada nunca se hizo — no hay datos que
  mostrar). La serie muestra los campos a completar a mano (tiempos + distancia) sin valores.
- Edición (corredor y trainer autorizado): campos de tiempos + distancia → `PATCH workout-feedback`
  si la serie ya tiene fila, o **`POST /workout-feedback`** (endpoint existente del sync, idempotente
  por `unique_feedback_per_set` — 409 → PATCH) si se crea por primera vez (caso manual). En modo
  manual todas las series se guardan por POST.
- Guard de cambios sin guardar (`useFormDirty`/`useUnsavedChangesGuard`, convención del repo).
  `notifySuccess`/`notifyError` (haptics) + Toast al guardar. Los rows `skipped` y "sin registro"
  muestran el detalle pero deshabilitan la edición (en modo manual todos están "sin registro", el
  edición está habilitada).
- `report_source` en manual: `'corredor'` si entra el corredor, `'entrenador'` si entra un trainer
  (decisión de spec, ver Asunciones).
- Al terminar de cargar todas las series en modo manual → mismo `PATCH runner { finished }` (la
  sesión pasa a completada y el badge aparecerá la próxima vez).

### Hooks / servicios / testables

- `services/runnerSession.js` + mock — `createRunnerSession`, `finishRunnerSession`,
  `getRunnerSession`, `getSessionFeedback`, `updateWorkoutFeedback`.
- `hooks/use-runner-session.js` (TanStack Query) — estado del badge en pre-start + invalidación
  post-sync.
- `hooks/use-session-feedback.js` — datos de la pantalla de revisión + mutación de edición.
- Selector del entrenador: reusa `use-team-roster` (atletas del equipo) — no hace falta hook nuevo.
- `services/normalizers.js` — `toRunnerSessionModel`, `toSessionFeedbackListModel`
  (agrupar por `assigned_exercise_id`, ordenar por `set_number`; pura y testeable).
- `utils/` — nada nuevo (se reusan `toIsoUtc`, `formatStopwatch` — reusa `formatMeters` si se
  quiere mostrar distancia).

## Testing

- Jest (lógica pura): normalizers de feedback (agrupamiento/orden/sin-registro), payloads de
  `runner_session` (ids a Number, `start_date` ISO), transformación a lista de revisión.
- Sin tests de render (convención del proyecto). Verificación visual: la **revisión es
  multiplataforma** → se verifica en preview web (React Native Web) y en dispositivo; el pre-start
  (toma en vivo) sigue siendo nativo-only (dev client).
- Backend: `go test ./...` de `runner_session` y del PATCH de `workout_feedback`
  (controller/service/dao + matriz de auth, `testify`, patrón existente).

## Definiciones de diseño a dejar en CLAUDE.md

- `runner_session` es el primer caso de **estado de dominio en el backend** que el front lee como
  fuente de verdad para decidir UI (el badge de completada). Antes el front decidía por datos
  locales. Nota breve en "Quirks"/convención: estados de sesión del corredor viven en backend,
  no en el store.
- La pantalla de revisión hereda las reglas de gestos/`Modal` de la spec de recording (detalle en
  `View` apilada, no `Modal`; gestos solo vía gesture-handler con `GestureDetector`).

## Asunciones a confirmar

1. **Badge y reemplazo de Play solo cuando `status === 'finished'`** — un `wip` no muestra nada
   (confirmado con el usuario en el requerimiento; se fija igual como decisión de spec).
2. **La rama "fecha pasada" cubre TODAS las sesiones vencidas, completadas o no — todas editables:**
   completada → badge + modo revisión; sin completar → modo manual. Solo las de hoy en la ventana
   conservan el Play. (Requerimiento del usuario 2026-09-24.)
3. **Modo manual = editor vacío**: no se precargan datos aunque el backend tenga feedback parcial
   de un `wip` interrumpido — por decisión del usuario "en este caso no va a haber datos
   cargados". El guardado es por `POST workout-feedback` (crea), y si la serie ya tenía fila el 409
   la convierte en PATCH (resiliencia, no una feature).
4. **`report_source` en manual**: `'corredor'` si entra el corredor, `'entrenador'` si entra un
   trainer.
5. **Al llenar todas las series en manual también pasa a `finished`** (misma regla que la toma en
   vivo) — hace aparecer el badge la próxima vez.
6. **Entrada del entrenador:** desde el calendario grupal (web) en un día pasado, **selector de
   corredor con autocompletado** sobre los atletas del equipo (roster) y **confirmar la selección**
   antes de entrar a la experiencia. Se implementa la pantalla de revisión genérica por
   `athleteUserId` + este picker en la misma iteración.
7. **Editable solo `completed`:** los `skipped` no se pueden revertir ni editar en esta versión.
8. **Nombre de la tabla `runner_session`** (alternativas: `athlete_session`, `session_participation`)
   — se confirma con el backend al abrir el change OpenSpec.
9. **Fin del `end_date`:** lo pone el servidor en el `PATCH runner` (no el cliente).
10. **Matriz de plataformas de edición:** mobile = corredor (sobre su feedback); web = corredor y
    entrenador. El entrenador no edita desde mobile en esta versión (su entrada es web), aunque la
    API lo permite (auth de trainer vale igual). El corredor en web entra por el detalle del día de
    su calendario agregado.