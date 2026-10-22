# Intentos múltiples configurables en competencias de ruta — Design

## Contexto

Hoy una competencia `type='route'` admite **un solo intento por corredor**
(`400` en el segundo, ver `docs/BACKEND_API_GAPS.md` Gap 28 — "resuelto, sin
reintentos en v1"). Esto se decidió explícitamente así para la v1 del módulo
de gamificación (Gap 33), con la nota de que iba a cambiar. El usuario pidió
retomar esto ahora que el camino de un solo intento ya está construido y
probado (`route-attempt-pre-start-screen.jsx` → `route-attempt-live-screen.jsx`
→ `route-attempt-detail-screen.jsx`, con el mapa de trayectoria y el
veredicto de cumplimiento ya andando).

**Pedido:** el creador de la competencia (entrenador u otro corredor,
igual que hoy) elige un `max_attempts` al crearla. Cada corredor participante
puede correr la ruta hasta esa cantidad de veces. El ranking usa, para cada
corredor, el mejor de sus intentos. El corredor puede revisar el detalle de
CUALQUIERA de sus intentos pasados, no solo el que cuenta para el ranking —
y, con el mismo criterio de visibilidad que ya tiene el ranking (cualquiera
que vea la competencia activa, sin depender de rol/participación), también
puede revisar los intentos de CUALQUIER OTRO participante.

**Decisión de alcance acordada con el usuario:** el trabajo real de backend
(modelo, DAO, service, endpoint nuevo) lo escribe la persona que mantiene
`paceron-backend` — este documento y el gap que resulta de él son el
pedido preciso. El frontend se construye en paralelo contra mocks, mismo
patrón ya usado para Gap 18/35.

## Arquitectura backend (para el Gap doc, no para implementar en este repo)

**Decisión: un `session_instance` nuevo por cada intento, no uno compartido.**

Hoy `CreateAttempt` (`competition_service.go`) reusa una única
`session_instance` sintética por competencia (`comp.RouteSessionInstanceID`,
Gap 26) y bloquea el segundo intento con un chequeo explícito
(`ExistsAttemptByCompetitionAndAthlete`). El índice único genérico de
`runner_session` (`uq_runner_session_session_athlete`, sobre
`session_instance_id, athlete_user_id`) — que rige TODAS las sesiones del
sistema, no solo competencias — también lo bloquearía igual aunque se
sacara ese chequeo explícito.

Se evaluaron 3 enfoques:

1. **(Elegido) Un `session_instance` nuevo por intento.** `CreateAttempt`
   deja de reusar la instancia compartida y crea una nueva cada vez, hasta
   `max_attempts`. Cada intento sigue siendo "una `session_instance` común"
   para el resto del sistema — reusa el pre-start/vivo/sync/detalle tal
   cual existen hoy, cero cambios en ese pipeline. No toca el índice único
   genérico (cada fila de `runner_session` tiene un `session_instance_id`
   distinto). Blast radius acotado a `competition_service.go` + 1 campo
   nuevo en el modelo `Competition`.
2. Agregar `attempt_number` a `runner_session` y ampliar el índice único a 3
   columnas. Descartado — toca una tabla e invariante que usa CADA sesión
   de entrenamiento del sistema (no solo competencias de ruta), con riesgo
   de migración/backfill injustificado para algo específico de un tipo de
   competencia.
3. Tabla nueva `competition_attempt`, separada del pipeline de
   `runner_session`/`session_instance`. Descartado — obligaría a duplicar
   GPS sync, SQLite local, `workout_feedback`, etc. que ya existen y
   funcionan sobre el pipeline genérico.

### Requerimientos concretos para el Gap doc (`docs/BACKEND_API_GAPS.md`)

- **Campo nuevo en `Competition`:** `max_attempts: number`, solo
  `type='route'` (`null`/ausente para `type='metric'`). Backend valida un
  rango — **pregunta abierta para el backend:** ¿cuál es el mínimo/máximo
  razonable? Frontend sugiere default 3 en el form mientras no haya
  respuesta, mismo patrón que `acceptance_radius_meters` (Gap 31, backend
  definió el rango `[5,500]`, frontend eligió el default de 50m).
- **`CreateAttempt` cambia de regla:** de "¿existe ya un intento? → 400" a
  "`COUNT(runner_session WHERE competition_id=X AND athlete_user_id=Y) >=
  max_attempts` → 400". Cada llamada exitosa crea una `session_instance`
  nueva (no la compartida que crea hoy al aprobarse la competencia).
- **Endpoint nuevo: `GET /competitions/{id}/attempts?athlete_user_id=X`**
  (query param opcional, default = caller) → lista de intentos de ESE
  atleta contra esa competencia:
  ```json
  [{
    "runner_session_id": 123,
    "session_instance_id": 9001,
    "status": "finished",
    "started_at": "2026-10-21T10:00:00Z",
    "finished_at": "2026-10-21T10:15:00Z",
    "distance_meters": 2850,
    "duration_ms": 900000,
    "compliance_ratio": 94.2
  }]
  ```
  Mismo criterio de visibilidad que el ranking: cualquiera que pueda ver la
  competencia puede pedir los intentos de cualquier participante, no solo
  los propios.
- **`progress` del detalle de competencia deja de ser inútil para
  `type='route'`.** Hoy `GET /competitions/{id}` devuelve
  `progress: [{user_id, value}]`, y para ruta `value` no tiene semántica
  real (confirmado leyendo `competition-ranking-modal.jsx` — hoy se
  muestra literal `'—'`). Pasa a llevar, por atleta, el MEJOR intento según
  el mismo comparador que ya ordena entre corredores distintos
  (% de cumplimiento de la trayectoria descendente, empate por menor
  `duration_ms`): `{user_id, compliance_ratio, duration_ms}` en vez de
  `value` para competencias de ruta.
- **El detalle (o el endpoint de arriba) expone `attempts_used` /
  `remaining_attempts` del CALLER** sobre la fila de la competencia misma
  (no solo dentro del endpoint de lista) — para que `competitions-tab.jsx`
  pueda decidir mostrar/ocultar/deshabilitar el botón "Correr esta
  trayectoria" sin pedir el endpoint de lista completo por cada fila de una
  lista de competencias.

## Frontend

### Comparador "mejor intento" (pieza nueva y reusable)

Mismo comparador en dos lugares: elegir, entre los intentos propios de UN
atleta, cuál representa al corredor en el ranking (hoy lo hace el backend,
pero el frontend lo necesita igual para los MOCKS); y ordenar atletas entre
sí en `competition-ranking-modal.jsx` (ya existe ahí, hoy solo para
`type='metric'`, hay que extenderlo a `type='route'` usando
`compliance_ratio`/`duration_ms` en vez de `value`).

Pieza pura nueva: `utils/route-geometry.js#pickBestAttempt(attempts)` →
recibe una lista de `{complianceRatio, durationMs}` y devuelve el índice/
objeto ganador: mayor `complianceRatio`, empate por menor `durationMs`. Sin
dependencia de GPS/SQLite — opera sobre números ya calculados, 100%
testeable en Jest junto al resto de `route-geometry.js`.

### Form de creación (`create-competition-modal.jsx`)

Campo nuevo `maxAttempts` cuando `type='route'`, mismo patrón visual que
`acceptanceRadius` (número, con el mismo tipo de validación de rango
client-side que ya existe ahí). Default sugerido: 3. Enviado como
`max_attempts` en el body de `POST /teams/{id}/competitions`.

### `competitions-tab.jsx`

- `canRun` suma `remainingAttempts > 0` a las condiciones que ya tiene
  (`!isTrainerView && type==='route' && status==='active' &&
  participantUserIds.includes(currentUserId)`, sin quitar ninguna) —
  **gap real confirmado leyendo el código actual:** hoy ni siquiera
  chequea si el corredor ya corrió, el bloqueo del segundo intento es
  100% server-side (un 400 silencioso si lo intenta). Con `max_attempts`
  > 1 esto deja de ser aceptable — un corredor con cupo agotado necesita
  feedback claro, no un error de red.
- Copy nuevo junto al botón "Correr esta trayectoria": `"Intento 2 de 3"`
  (o "Sin intentos disponibles" si `remainingAttempts === 0`, botón
  deshabilitado en ese caso en vez de ocultarse — consistente con el
  tratamiento visual ya existente de "disabled Play" en el pre-start).
- **Botón nuevo "Ver todos los intentos"**, al lado del de ranking
  (`podium`), mismo `canViewRanking` como condición de visibilidad. Ícono
  sugerido: `format-list-bulleted` o similar (a elegir en el plan).

### `AttemptsListModal` (componente nuevo)

Modal con:
- **Header:** select de atleta (`ResponsiveSelectField`, lista =
  `competition.participantUserIds`), default = usuario actual si participa,
  si no el primer participante de la lista.
- **Cuerpo:** lista de intentos del atleta seleccionado (pide
  `GET /competitions/{id}/attempts?athlete_user_id=X` vía un hook nuevo
  `useCompetitionAttempts(competitionId, athleteUserId)`), cada fila con
  fecha/hora, distancia, duración, % de cumplimiento, y un badge si es el
  intento que cuenta para el ranking (el que gana el comparador de arriba).
  Fila vacía → "Este corredor todavía no registró ningún intento."
- **Tap en una fila** → cierra el modal, navega a `/route-attempt-detail`
  con un param nuevo: `sessionInstanceId` (el de ESE intento puntual), en
  vez de depender de `competitionId + athleteUserId` sin más (que hoy
  asume "el" único intento del atleta).

### `useAttemptDetail` — nuevo modo de intento específico

Hoy la rama remota (`useRemoteAttemptDetail`) deriva el
`sessionInstanceId` de `competition.sessionInstanceId` (Gap 35 — un solo
valor por competencia). Con N intentos, ese campo deja de identificar "el"
intento del atleta. Cambio: `useAttemptDetail` acepta un param opcional
`sessionInstanceId` — si viene (navegación desde `AttemptsListModal`), se
usa directo, saltando la derivación vía `competition.sessionInstanceId`.
Si NO viene (navegación desde el ranking, sin cambios), se sigue resolviendo
como hoy — pero ahora apuntando al MEJOR intento del atleta, que es lo que
el backend va a devolver como "el" `session_instance_id` relevante para ese
atleta en el detalle de competencia (ver pedido de arriba).

### Mocks

`services/__mocks__/competitions-mock.js` necesita `max_attempts` en al
menos una competencia de ruta semilla (≥2, para poder probar el flujo
completo), y `services/__mocks__/runner-session-mock.js` +
`services/__mocks__/workoutFeedback-mock.js` necesitan ≥2 intentos
completos (`finished`) del mismo atleta contra esa competencia, con
`compliance_ratio`/`duration_ms` distintos entre sí para que el comparador
tenga algo real que elegir. El nuevo endpoint de lista y el campo
`remaining_attempts` se simulan enteramente del lado mock (no hay backend
real todavía) — mismo criterio que el resto de `services/__mocks__/`.

## Manejo de errores

- **Carrera de cupo agotado** (dos pestañas/dispositivos corriendo casi
  en simultáneo): el 400 del backend es la fuente de verdad. El frontend
  no asume éxito al tocar "Correr" — si falla, toast de error +
  invalidar/refetch `remainingAttempts` antes de reintentar.
- **Backend sin `max_attempts` todavía (no mergeado):** mismo patrón que
  Gap 35 — todo el trabajo de frontend se construye y prueba contra mocks,
  sin gatear nada en un campo que todavía no existe en el backend real.
- **`AttemptsListModal` con atleta sin intentos:** estado vacío explícito,
  no un error.
- **Navegar a un `sessionInstanceId` específico que ya no existe/404:**
  reusa el estado `not_found` que `route-attempt-detail-screen.jsx` ya
  tiene para el camino remoto.

## Testing

- `pickBestAttempt` (comparador puro) → tests en
  `__tests__/route-geometry.test.js`, mismo archivo que
  `computeRouteComplianceRatio`.
- Mocks nuevos (lista de intentos, `remaining_attempts`) → tests de
  servicio, mismo patrón que el resto de `services/__mocks__/*.test.js`.
- `useAttemptDetail` con el override `sessionInstanceId` → extiende
  `__tests__/use-attempt-detail-status.test.js` o un archivo nuevo
  equivalente (camino remoto, sin SQLite de por medio — no rompe Jest).
- Sin tests de render de `AttemptsListModal`/cambios en
  `competitions-tab.jsx` — convención ya establecida del repo, verificación
  visual manual (preview + mocks) antes de mergear.

## Fuera de alcance (explícito)

- Escribir el código Go del backend — este documento es el pedido, no la
  implementación. Ver sección "Decisión de alcance acordada con el
  usuario" arriba.
- Cooldown entre intentos (correr de nuevo inmediatamente después de
  terminar un intento) — no se pidió, no se agrega.
- Cambiar `max_attempts` de una competencia ya creada — la ruta ya es
  inmutable una vez creada (Gap 30), se asume que `max_attempts` sigue la
  misma regla salvo que el backend diga lo contrario.
