# Spec de backend — Calendario y asignación de planes a grupos

> Documento para el equipo de backend (Go/Gin, repo separado). Describe cómo un plan de entrenamiento del catálogo se traduce en el calendario real de un grupo, y todo lo que pasa alrededor de eso (edición atómica, sesiones presenciales, cancelaciones, clonado por divergencia). No sigue la convención fechada de `docs/superpowers/specs/` — vive junto a `BACKEND_API_GAPS.md`/`BACKEND_TRAINING_PLANS_SPEC.md` y se actualiza in-place.
>
> **Subproyecto hermano:** `docs/BACKEND_TRAINING_PLANS_SPEC.md` cubre el catálogo reusable (Exercise/Session/TrainingPlan/PlanDay) — léase primero, este documento asume ese modelo y no lo repite. Convenciones generales (formato de respuesta, auth, IDs, nombres) son las mismas que ahí — no se listan de nuevo acá.

> **Actualización 2026-09-19 — RESUELTO:** `presencial_time` (single) pasó a `presencial_time_from`/`presencial_time_to` — toda sesión presencial necesita horario de inicio Y fin. El backend ya lo implementó y deployó (confirmado en la actualización de abajo, `FRONTEND_IMPACTO_INSTANCIACION.md` del repo backend: "los horarios viajan HH:MM (UTC) como siempre — sin cambio"). Gap 6 cerrado en `BACKEND_API_GAPS.md`.
>
> **Actualización 2026-09-20 — cambio de modelo confirmado en código (rama `feature/asignacion-por-instanciacion` del backend), rompe contrato, no es aditivo:** asignar una sesión a un día de calendario ya no guarda una referencia viva al catálogo (`session_id` como FK persistida) — el backend **instancia** (copia congelada) la sesión y sus ejercicios en tablas propias (`SessionInstance`/`ExerciseInstance`) en el momento del `PUT`, y la respuesta embebe esa copia bajo `session_instance` en vez de devolver un `session_id` crudo. Ver §3.1bis (nuevo) para el detalle completo. Consecuencias directas:
> - El **request** del `PUT` no cambia — sigue mandando `session_id` (id de catálogo) para indicar qué instanciar.
> - **Cada `PUT` con `kind=training` reinstancia de cero**, incluso si no cambiaste la sesión — el backend no tiene forma de "mantener la instancia actual" hoy. Se abrió **Gap 7** en `BACKEND_API_GAPS.md` pidiendo que esto se pueda evitar — pendiente de implementación, esta pieza del frontend se construye contra el comportamiento actual (siempre reinstancia).
> - El §5 de este documento (clonado por divergencia) queda **obsoleto** — el mecanismo que describía ya no existe, ver nota en esa sección.
> - Nuevo guard de "día cerrado": bloquea `PUT`/`DELETE`/`stamp`/`bulk`/`bulk-clear`/`shift` con `422` sobre fechas pasadas o presenciales ya empezadas — únic­a excepción, la transición a `kind=cancelled`. Ver §4.

## 1. Estado actual y por qué existe este documento

No existe ningún endpoint de calendario/asignación en el backend real — es dominio 100% nuevo, sin mock previo siquiera (a diferencia del catálogo, que corría contra mocks). El diseño reemplaza por completo un mecanismo anterior (`RunnerPlanAssignment` — asignación directa a un corredor individual, `CurrentPlanMark`, `Group.training_plan_id`) que había quedado documentado en `BACKEND_TRAINING_PLANS_SPEC.md` pero **nunca se implementó** — se descarta sin haber llegado a producción, no hace falta migración.

## 2. Decisión central: no hay una entidad "Assignment"

La asignación de un plan a un grupo **no es un registro con fecha de inicio/fin que haya que instanciar** — es, simplemente, el calendario del grupo. Un `GroupCalendarDay` por fecha con algo cargado. Consecuencias directas:

- Un corredor que se suma a un grupo no "recibe" una asignación — ve el calendario que ya existe, tal cual está, sin ciclo propio ni fecha de alta.
- Un plan "estampado" (drag del entrenador sobre el calendario) no queda como grupo rígido ligado al plan — copia sus datos día por día a filas de `GroupCalendarDay` normales, indistinguibles después de cualquier fila cargada a mano. El plan es un atajo de carga masiva, no una relación persistente.
- No hay "cuántas asignaciones tiene un corredor" como concepto — hay "de cuántos grupos es miembro", y cada uno tiene su propio calendario.

## 3. Entidades

### 3.1 `GroupCalendarDay` (tabla dispersa — sin fila = día vacío)

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | bigint PK | no | |
| `group_id` | bigint FK → group | no | `ON DELETE CASCADE` |
| `date` | date | no | fecha real de calendario — **no** `sequence_no` (eso es del template, esto es el calendario en sí). `UNIQUE(group_id, date)` |
| `kind` | enum | no | `rest` \| `other` \| `training` \| `cancelled` |
| `other_name` | varchar | sí | obligatorio *solo* si `kind = 'other'` |
| `session_id` (request) / `session_instance` (response) | bigint (request) / objeto embebido (response) | sí | **asimetría real, no error de tipeo** — el `PUT` sigue recibiendo `session_id` (id de catálogo, bigint), obligatorio si `kind = 'training'`; la fila en sí guarda `session_instance_id` (FK a la copia congelada, no a la sesión de catálogo) y la respuesta expone el objeto completo bajo `session_instance`, nunca un id crudo. Ver §3.1bis. Si `kind` pasa a `cancelled`, la instancia **se mantiene** (contexto de qué sesión era) |
| `cancelled_reason` | text | sí | obligatorio *solo* si `kind = 'cancelled'` |
| `is_presencial` | bool | no, default `false` | solo tiene sentido si `kind = 'training'` o `'cancelled'` (una sesión cancelada puede haber sido presencial) |
| `presencial_time_from` | time | sí | 24h, obligatorio *solo* si `is_presencial = true` |
| `presencial_time_to` | time | sí | 24h, obligatorio *solo* si `is_presencial = true`, debe ser posterior a `presencial_time_from` (`422` si no) |
| `presencial_location` | jsonb `{lat, lng, label?}` | sí | mismo shape que `PlanDay.default_location` (ver `BACKEND_TRAINING_PLANS_SPEC.md` §3.5), obligatorio *solo* si `is_presencial = true` |
| `source_plan_id` | bigint FK → training_plan | sí | **informativo, no vinculante** — de qué plan vino el stamp que originó (o pisó) esta fila. `ON DELETE SET NULL` si se borra el plan. Nunca se usa para bloquear ediciones ni para "romper" el vínculo con el plan — ver §2 |
| `created_at` / `updated_at` | timestamptz | no | |

**Validación al guardar (crear/editar/estampar), servidor nunca confía solo en el frontend:**
- `kind = 'other'` ⇒ `other_name` no nulo.
- `kind = 'training'` ⇒ `session_id` no nulo, `other_name` y `cancelled_reason` nulos.
- `kind = 'cancelled'` ⇒ `cancelled_reason` no nulo. Solo se puede transicionar a `cancelled` **desde** `kind = 'training'` — cancelar un día de descanso o vacío no tiene sentido, `422`.
- `kind = 'rest'` ⇒ `other_name`, `session_id`, `cancelled_reason` nulos.
- `is_presencial = true` ⇒ `presencial_time_from`, `presencial_time_to` y `presencial_location` no nulos, y `presencial_time_to > presencial_time_from`. `is_presencial = false` ⇒ los tres nulos (limpiar si se desmarca).

### 3.1bis Instanciación de sesiones (`SessionInstance`/`ExerciseInstance`)

Al hacer `PUT` con `kind='training'`, el backend copia el contenido completo de la `Session` de catálogo (nombre, descripción) y de cada `Exercise` referenciado (todos sus campos) a tablas propias — `SessionInstance`/`ExerciseInstance` — y vincula la fila de calendario a esa copia (`session_instance_id`, no `session_id`). Esa copia queda **congelada**: editar o borrar la `Session`/`Exercise` de catálogo después nunca la vuelve a tocar. Consecuencia directa: **la UI de "mostrá qué grupos tienen esta sesión asignada antes de editar" (§5, ver nota de obsolescencia) perdió su razón de ser** — editar el catálogo ya no puede afectar ninguna asignación existente.

Shape de la respuesta (`session_instance`, `null` si `kind` no es `training`/`cancelled`):

```json
{
  "session_instance": {
    "id": 123,
    "name": "Fartlek 5K",
    "description": null,
    "created_at": "2026-09-20T10:00:00Z",
    "exercises": [
      {
        "id": 456, "name": "Trote", "kind": "jogging", "description": null,
        "intensity": null, "minutes": 10, "distance_m": null, "speed_kph": null,
        "muscle_group": null, "video_url": null,
        "role": "warmup", "repeat_count": 1, "rest_minutes": 0
      }
    ]
  }
}
```

`exercises` es siempre array (vacío posible, nunca `null`). Cada elemento combina el detalle congelado del ejercicio con `role`/`repeat_count`/`rest_minutes` del vínculo.

**Reglas confirmadas:**
- **Cada `PUT` con `kind='training'` reinstancia de cero**, sin excepción — no hay forma de "guardar sin re-elegir sesión", ni para tocar solo el horario presencial de un día ya asignado. La instancia vieja se borra al reemplazarse (salvo que ya tenga feedback enganchado, se conserva huérfana).
- **`kind='cancelled'` (solo alcanzable desde `training`) conserva la instancia** — `session_instance` sigue embebido, no se manda `session_id` en ese `PUT` (ver `toCalendarDayPayload` del frontend).
- **`SessionInstance`/`ExerciseInstance` no tienen referencia de vuelta al catálogo** — no hay forma de saber de qué `Session`/`Exercise` salió una instancia ya creada. Esto abre **Gap 7** (`BACKEND_API_GAPS.md`) pidiendo agregar esa referencia (`session_id`/`exercise_id` nullable, `ON DELETE SET NULL`, mismo patrón que `source_plan_id`) más la posibilidad de omitir `session_id` en el `PUT` para conservar la instancia actual sin reinstanciar — pendiente de implementación en el backend.

### 3.2 Shape de ubicación (`{lat, lng, label?}`)

Mismo shape en `PlanDay.default_location` y `GroupCalendarDay.presencial_location` — `lat`/`lng` numéricos (float), `label` opcional (varchar, texto libre que el entrenador puede escribir además del pin, ej. "Punto de encuentro — entrada norte"). No hay geocoding del lado del backend — el frontend resuelve la posición inicial vía GPS del dispositivo y el pin final vía el picker de mapa (OpenFreeMap/MapLibre, resuelto 100% en el cliente, sin dependencia de backend para los tiles en sí). El backend solo persiste el par de coordenadas + label, no valida que el punto "exista" en ningún sentido geográfico.

## 4. Endpoints

**Permisos (no cubierto por la tabla de convenciones general, se aclara acá porque es todo dato sensible/escribible):**
- `GET /groups/{id}/calendar` — el entrenador dueño del grupo, o cualquier corredor miembro (lectura). `403` para cualquier otro usuario autenticado.
- `PUT`/`DELETE`/`stamp`/`bulk`/`bulk-clear`/`shift` (todo lo que escribe) — **solo** el entrenador dueño del grupo. `403` para corredores, incluso miembros.
- `stamp` además valida que el `plan_id` sea del mismo `owner_id` que administra el grupo — `403` si el entrenador intenta estampar un plan que no es suyo.
- `/users/{id}/next-session` y `/users/{id}/calendar-summary` — `{id}` debe ser el propio usuario autenticado (del token), `403` si no coincide. Son endpoints de "mis datos", no una consulta abierta sobre cualquier `user_id`.

| Método | Path | Body | Respuesta |
|---|---|---|---|
| `GET` | `/groups/{id}/calendar?from={date}&to={date}` | — | `200` array de `GroupCalendarDay` en el rango (ambos límites inclusive, obligatorios — sin rango no se lista "todo" el calendario) |
| `PUT` | `/groups/{id}/calendar/{date}` | `{kind, other_name?, session_id?, cancelled_reason?, is_presencial?, presencial_time_from?, presencial_time_to?, presencial_location?}` | `200` `GroupCalendarDay` — upsert de un día individual, valida §3.1 |
| `DELETE` | `/groups/{id}/calendar/{date}` | — | `204` — vacía el día (borra la fila, no un soft-delete) |
| `POST` | `/groups/{id}/calendar/stamp` | `{plan_id, start_date, force?}` | `201` array de `GroupCalendarDay` creados/reemplazados — copia cada `PlanDay` del plan a partir de `start_date` (día 1 del plan → `start_date`, día 2 → `start_date + 1`, etc.), incluyendo `default_presencial`/`default_time_from`/`default_time_to`/`default_location` si los tiene. Si algún día del rango ya tiene contenido y `force` no es `true`, responde `409` con la lista de fechas en conflicto (el frontend las muestra en el modal de confirmación) en vez de aplicar nada |
| `POST` | `/groups/{id}/calendar/bulk` | `{dates: [...], kind, session_id?, other_name?, is_presencial?, presencial_time_from?, presencial_time_to?, presencial_location?}` | `200` array de `GroupCalendarDay` actualizados — multi-select bulk-assign, mismo `kind`/contenido a todas las fechas listadas, misma validación de §3.1 por cada una |
| `POST` | `/groups/{id}/calendar/bulk-clear` | `{dates: [...]}` | `204` — multi-select bulk-clear, borra las filas de esas fechas |
| `POST` | `/groups/{id}/calendar/shift` | `{from_date, days}` | `200` array de `GroupCalendarDay` con la fecha ya actualizada — todas las filas con `date >= from_date` pasan a `date + days`. `days` entero positivo, elegido por el entrenador (no fijo a 1). `409` si el corrimiento haría chocar dos fechas existentes (no debería pasar corriendo hacia adelante, pero se valida igual) |
| `GET` | `/users/{id}/next-session` | — | `200` `{group_id, date, session_id, is_presencial, presencial_time_from?, presencial_time_to?, presencial_location?}` \| `204` si ninguno de sus grupos tiene una próxima `GroupCalendarDay` con `kind IN ('training','cancelled')` y `date >= hoy` — la primera cronológicamente entre TODOS sus grupos. Para el banner de "próximo entrenamiento" del home del corredor |
| `GET` | `/users/{id}/calendar-summary` | — | `200` array de `{group_id, group_name}` — un ítem por cada grupo del que es miembro, para poblar "Mis asignaciones" (cada ítem abre `GET /groups/{id}/calendar` filtrado). Sin paginación ni detalle embebido — la pantalla de detalle pega el `GET` de calendario aparte |

**Guard de día cerrado (`422`, confirmado en código 2026-09-20):** aplica a `PUT`/`DELETE`/`stamp`/`bulk`/`bulk-clear` y a `shift` sobre las filas afectadas. Un día está "cerrado" si su fecha ya pasó, o si es hoy y ya arrancó (presencial: pasado `presencial_time_from`; no presencial: cualquier momento de hoy ya cuenta como cerrado). Mensaje siempre incluye la(s) fecha(s), incluso en el caso individual:

```json
HTTP 422
{"message": "el día de calendario está cerrado: 2026-09-19, 2026-09-22"}
```

En `bulk`/`bulk-clear`/`shift` es **todo-o-nada** — se validan todas las fechas antes de escribir y si alguna está cerrada se rechaza el lote completo, listando todas las fechas conflictivas (no solo la primera). **Única excepción: la transición a `kind=cancelled`** (desde `training`) — permitida incluso sobre un día cerrado, no repuntea nada, solo marca `cancelled_reason` y conserva la instancia.

## 5. [OBSOLETO] Editar una `Session` con asignaciones activas — clonado por divergencia

> **Eliminado del backend, confirmado en código (rama `feature/asignacion-por-instanciacion`, 2026-09-20).** Esta sección describía un mecanismo que ya no existe — dejaba de tener sentido apenas se implementó la instanciación (§3.1bis): una sesión asignada al calendario ya no mantiene ninguna referencia viva al catálogo, así que editar la sesión de origen no puede "repuntear" nada que ya esté asignado. Consecuencias concretas para el frontend:
> - `PUT /sessions/{id}` ya **no acepta** `exclude_group_ids`/`clone_name`/`clone_description` — si se mandan, se ignoran en silencio (sin `400`, sin warning).
> - `GET /sessions/{id}/assigned-groups` fue **eliminado**, responde `404`. Sin reemplazo — no hace falta, no hay nada que repuntear.
> - Cualquier UI de catálogo que mostrara "esta sesión está asignada en estos grupos, ¿desmarcás alguno antes de editar?" queda descartada — no aplica más.
>
> Se mantiene el contenido original abajo solo como referencia histórica de un diseño ya no vigente — no implementar nada de lo que sigue.

Una sesión asignada en el calendario de un grupo **mantiene referencia viva** al catálogo (`GroupCalendarDay.session_id`) — editar la sesión en el catálogo (`PUT /sessions/{id}`, ver `BACKEND_TRAINING_PLANS_SPEC.md` §4) actualiza automáticamente lo que ve cualquier grupo que la tenga asignada, salvo que el entrenador pida explícitamente lo contrario para algunos grupos.

**Flujo (histórico, ya no vigente):**

1. Antes de mostrar el form de edición de una sesión, el frontend pide `GET /sessions/{id}/assigned-groups` → `200` array de `{group_id, group_name}` (distinct, de cualquier `GroupCalendarDay.session_id` = esa sesión, sin importar la fecha). Si viene vacío, edición normal, sin checklist.
2. Si no viene vacío, el frontend muestra el checklist (todos tildados por default) y el entrenador destilda 0+ grupos.
3. Al confirmar, `PUT /sessions/{id}` recibe 3 campos adicionales opcionales en su body — `{..., exclude_group_ids?: [...], clone_name?, clone_description?}`. `clone_name`/`clone_description` son **del `PUT`**, no del endpoint público `POST /sessions/{id}/clone` (que sigue sin body, ver doc de catálogo) — son la forma en que el frontend manda lo que el entrenador haya editado en los campos "nombre y descripción" del clon que se le muestran en el momento de destildar grupos.
   - Si `exclude_group_ids` viene vacío u omitido: `PUT` normal, todos los grupos ven el cambio (comportamiento ya descripto en el doc de catálogo). `clone_name`/`clone_description` se ignoran si vienen igual (no hay clon que crear).
   - Si trae ids, el backend, **antes** de aplicar el update:
     a. crea un clon de la sesión tal como está *antes* de este `PUT` (mismo mecanismo interno que `POST /sessions/{id}/clone`, pero con `name`/`description` = `clone_name`/`clone_description` si vinieron, o el sufijo default `" (copia)"` si no),
     b. hace `UPDATE GroupCalendarDay SET session_id = <clon.id> WHERE group_id IN (exclude_group_ids) AND session_id = {id}` (todas las fechas, no solo una),
     c. recién ahí aplica el resto del `PUT` (los campos normales de sesión) a la sesión original — la comparten los grupos que quedaron tildados (los no listados en `exclude_group_ids`) más el catálogo en general (nuevas asignaciones futuras).
   - Todo el paso 3 es una transacción — si el `PUT` final falla, se revierte también el clonado/repunteo.

**Un solo clon compartido**: si se destildan 3 grupos en la misma edición, los 3 pasan a apuntar al mismo clon nuevo (no 3 clones independientes).

## 6. Borrado de `Session` con calendarios activos

> **Actualización 2026-09-20:** con la instanciación (§3.1bis), esto ya no requiere ningún cuidado especial de parte del backend en relación al calendario — una vez asignado un día, la fila de calendario referencia una `SessionInstance` congelada, totalmente independiente de la `Session` de catálogo. Borrar (o editar) la `Session` original no afecta ninguna asignación existente, pasada o futura, sin necesidad de borrado lógico pensado para este caso puntual. El borrado lógico del catálogo (`deleted_at`/`archived`, `BACKEND_TRAINING_PLANS_SPEC.md` §5) puede seguir existiendo por otras razones del catálogo en sí, pero no es un requisito que imponga el calendario.

## 7. Fuera de alcance / decisiones diferidas

- **Tracking de completado**: el detalle de "Mis asignaciones" del corredor por ahora solo muestra el calendario (§4, `GET /groups/{id}/calendar`) — "cumplido/pendiente" y logros/estadísticas quedan sin mecanismo, a diseñar cuando se aborde tracking real de sesiones.
- **Monitoreo en tiempo real** de la ubicación de los participantes durante una sesión presencial (puntos en un mapa en vivo) — mencionado como idea a futuro por el usuario, no es parte de este diseño. Cuando se aborde, es un feature completamente distinto (streaming de ubicación, consentimiento/privacidad, vista de mapa en vivo), no una extensión de `presencial_location`.
- **Reuso del `LocationPicker`** para ubicación de equipo o de usuario (perfil) — el componente se construye pensado para ser reusable, pero ningún otro dominio lo consume todavía. No agregar columnas de ubicación a `Team`/`User` como parte de este trabajo.
- **Multi-sesión por día** — cada `GroupCalendarDay` tiene una sola sesión/actividad. Ya estaba anotado como pendiente desde el rediseño de catálogo, sigue diferido acá también.
- **Notificaciones** al estampar un plan, editar un día, o cancelar una sesión — ninguna todavía.
- **Concurrencia**: dos entrenadores editando el calendario del mismo grupo al mismo tiempo no tiene ningún mecanismo de lock — last-write-wins, aceptable para el tamaño de equipo actual.

## 8. Diagrama de relaciones

```mermaid
erDiagram
    GROUP_CALENDAR_DAY {
        bigint id PK
        bigint group_id FK
        date date
        varchar kind
        varchar other_name
        bigint session_instance_id FK
        text cancelled_reason
        bool is_presencial
        time presencial_time_from
        time presencial_time_to
        jsonb presencial_location
        bigint source_plan_id FK
    }

    SESSION_INSTANCE {
        bigint id PK
        varchar name
        varchar description
        timestamptz created_at
    }

    GROUP ||--o{ GROUP_CALENDAR_DAY : "tiene calendario"
    GROUP_CALENDAR_DAY ||--o| SESSION_INSTANCE : "asignada en (kind=training/cancelled) — copia congelada, sin FK de vuelta al catálogo hasta Gap 7"
    TRAINING_PLAN ||--o{ GROUP_CALENDAR_DAY : "estampó (informativo, source_plan_id)"
```

`GROUP` y `TRAINING_PLAN` están definidos en `BACKEND_TRAINING_PLANS_SPEC.md` (y `GROUP` en el dominio de equipos, ya real) — no se repiten acá. `SESSION_INSTANCE` (y `EXERCISE_INSTANCE`, no diagramada por brevedad) son tablas internas del backend, propias de la instanciación (§3.1bis) — ya no hay relación directa con `SESSION` de catálogo salvo que se implemente Gap 7.
