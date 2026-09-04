# Módulo de planes de entrenamiento — Design

**Fecha:** 2026-08-26
**Estado:** Aprobado, en desarrollo

## Contexto

`FUNCTIONAL_PROPOSE.md` lista "Planificación de entrenamientos" como
módulo reservado desde el principio del proyecto. `BACKEND_API_GAPS.md`
confirma que el equipo de backend **deliberadamente pausó** el gap de
"plan de entrenamiento en el grupo" hasta que el usuario lo retomara
("Cuando el usuario retome alguno de los dos, se vuelve a documentar acá
como gap propio") — este pedido es exactamente eso: retomarlo. Un
compañero del usuario compartió una gramática/schema SQL propia (para
alimentar una IA de generación de planes) que se usa acá como referencia
del modelo de datos de un plan — no se copia el SQL literal (es
Postgres, este repo es frontend puro), se traduce su estructura a
JS/mock manteniendo la misma jerarquía y las mismas reglas de
"exactamente uno de".

## Alcance de esta spec

Módulo nuevo de punta a punta: `services/__mocks__/training-plans-mock.js`,
`services/trainingPlans.js`, `services/normalizers.js` (agrega
funciones), `store/team-store.js` (una acción nueva,
`setGroupTrainingPlan`), `store/training-plan-store.js` (nuevo),
`components/plans/*` (reemplaza los placeholders "Próximamente" de
`my-plans-screen.jsx`/`training-plans-screen.jsx`, suma pantallas
nuevas), rutas nuevas bajo `app/(tabs)/plans/` y
`app/(tabs)/training-plans/`, `docs/BACKEND_API_GAPS.md` (reabre el gap),
`__tests__/training-plan-store.test.js` (nuevo).

## Decisiones

### Arquitectura: Zustand + `services/` real+mock, NO TanStack Query

Este repo migró equipos/grupos/invitaciones de vuelta a Zustand pegando
contra `services/` reales con fallback a mock (`USE_MOCKS`) —
`hooks/use-team-roster.js` es la única pieza en TanStack Query, y es un
caso puntual (fan-out de lookup de usuarios, no el dominio en sí). Planes
de entrenamiento sigue el mismo patrón que equipos: `store/training-plan-
store.js` (Zustand) llamando `services/trainingPlans.js`
(`USE_MOCKS` → `services/__mocks__/training-plans-mock.js`, así queda
listo para cuando el backend real exista — mismo criterio que
`services/teams.js` desde antes de que el backend de equipos estuviera
completo).

### El schema SQL se traduce a JS manteniendo el "arco exclusivo", no como columnas nulleables sueltas

Cada punto de la gramática donde el SQL usaba discriminador + FKs
nullables + CHECK se traduce a un objeto JS con una propiedad `kind` +
un único sub-objeto con los datos de esa opción (no una FK nullable por
opción — en JS no hace falta, la forma del objeto ya es autoexplicativa
y no hay riesgo de inconsistencia como en SQL):

```js
// PlanDay — antes: rest | marathon | other | training (arco exclusivo)
{ sequenceNo: 1, dayOfWeek: 'monday', kind: 'training', session: {...} }
{ sequenceNo: 2, dayOfWeek: 'tuesday', kind: 'rest' }
{ sequenceNo: 3, dayOfWeek: 'wednesday', kind: 'other', otherName: 'Natación' }

// TrainingSession — SIEMPRE sus 3 hijos fijos (no es un arco exclusivo)
{ warmup: {...WarmcoolBlock}, main: {...MainBlock}, cooldown: {...WarmcoolBlock} }

// WarmcoolBlock — warmup/cooldown: walking | jogging | elongation
{ kind: 'walking', minutes: 10 }
{ kind: 'elongation' }  // sin atributos, igual que en el SQL

// MainBlock — cruising | walking | jogging | set
{ kind: 'cruising', distanceM: 3000 }
{ kind: 'set', set: {...SetBlock} }

// SetBlock — repeat/rest propios + walking | jogging | running
{ repeatCount: 4, restMinutes: 2, kind: 'running', distanceM: 400, speedKph: 14 }
```

Los 7 días de `plan_day × 7` del SQL se mantienen fijos siempre (todo
plan tiene exactamente 7, `sequenceNo` 1..7, `dayOfWeek` lunes..domingo)
— es la estructura semanal que se repite, independiente de la
caducidad (ver más abajo).

### Caducidad (7 o 14 días): gobierna cuánto dura vigente el ciclo semanal, no cuántos días tiene el plan

El SQL de referencia no modela caducidad (solo `is_current` booleano).
El usuario pidió 7 o 14 días de caducidad — se interpreta como: el plan
sigue siendo siempre una semana de 7 días (`plan_day × 7`, fija), y
`durationDays` (7 | 14) es cuántos días desde `createdAt` ese ciclo
semanal se considera vigente antes de necesitar renovación/reasignación
por parte del entrenador. Un plan de 14 días repite la misma semana dos
veces antes de vencer. `status` se **deriva** en el momento de
mostrarlo (`now < createdAt + durationDays` → `activo`, si no
`vencido`) — no es un campo guardado, mismo criterio de semáforo
(`activo`/`vencido`) que ya usa el resto de la app (`SUBSCRIPTION_META`,
`TEAM_STATUS_META`) para no inventar una paleta nueva. Un plan vencido
no se borra solo — sigue en la lista del entrenador con el tag
"Vencido", el borrado es una acción explícita separada.

### Asignación a grupo: reusa `group.trainingPlanId` (ya existía, estaba vacío)

`store/team-store.js` ya tenía `trainingPlanId` en cada grupo — quedó
`null` siempre porque `TRAINING_PLAN_OPTIONS` se vació a propósito
(2026-08-02) al no haber plan real. Ahora que sí hay un `planId` real,
se reusa ese mismo campo en vez de inventar una tabla de asignación para
grupos: `setGroupTrainingPlan(teamId, groupId, planId)` (acción nueva,
100% local — el backend real no tiene este campo, ver
`BACKEND_API_GAPS.md`) simplemente lo setea. Un grupo tiene **un solo**
plan asignado a la vez (asignar uno nuevo reemplaza al anterior, no se
apila).

`TRAINING_PLAN_OPTIONS` (la constante vacía) y el picker de plan dentro
del wizard de creación de equipo (`group-list-editor.jsx`, al armar
grupos en borrador) **quedan sin tocar en esta entrega** — seguirán
mostrando "Sin opciones disponibles". No se retroalimentan con los
planes reales todavía porque conceptualmente no tiene sentido elegir un
plan mientras se arma un grupo que ni siquiera existe aún: el flujo real
pasa a ser "armar la librería de planes primero (Planes de
entrenamiento), después asignar a un grupo ya creado" — eso es lo que
cubre la pantalla nueva "Asignar" de este módulo. Retomar el picker del
wizard es un paso aparte, fuera de esta entrega.

### Asignación a corredor individual: relación nueva, no existía nada parecido

A diferencia de grupo, no había ningún campo previo para "este corredor
tiene este plan". Se modela como una tabla mock nueva
(`mockRunnerPlanAssignments`, `{ id, planId, userId, assignedAt }`) —
mismo patrón fila-por-relación que `team_users`/`group_users`. Un
corredor tiene **una sola** asignación individual activa a la vez
(asignar reemplaza la anterior) — mismo criterio que grupo, por
consistencia.

### Un corredor puede ver el plan de su grupo Y un plan individual a la vez — no se pisan

Son dos fuentes independientes: el plan de cualquier grupo del que sea
miembro (en cualquiera de sus equipos) y su asignación individual, si
tiene. `fetchMyPlans(userId)` en `training-plan-store.js` junta las dos:
recorre `myMemberTeams` (ya lo trae `team-store.js`), por cada equipo
trae sus grupos reales y para cada grupo con `trainingPlanId` chequea
membresía real (`getGroupUsers`) contra `userId`; suma la asignación
individual si existe; deduplica por `planId` (podría, en teoría,
coincidir) y trae el detalle completo de cada plan único. Es una
composición client-side deliberadamente simple (sin memoización ni
batching) — mismo nivel de esfuerzo que el resto del dominio de equipos
en esta etapa, no hace falta más para el volumen de datos mock actual.

### Planes son del entrenador (`ownerId`), no de un equipo — reusables entre todos sus equipos/grupos/corredores

Un plan no pertenece a un equipo puntual — es de la biblioteca del
entrenador que lo creó, asignable a cualquier grupo o corredor que
administre, en cualquiera de sus equipos. Esto es lo que le da sentido
real a "clonar": armar un plan una vez, clonarlo y ajustarlo para otro
grupo con necesidades distintas, sin tocar el original ni tener que
recrearlo desde cero.

### Corredor: "Mis planes" es de solo lectura, sin excepción

Pedido explícito del usuario ("el corredor solo podrá ver sus planes
asignados y nada más, por ahora"). `MyPlansScreen`/
`TrainingPlanDetailScreen` (vista de corredor) no ofrecen ninguna
acción de edición/borrado/reasignación — esas viven únicamente del lado
de `TrainingPlansScreen` (entrenador). `TrainingPlanDetailScreen` es un
único componente reusado por las dos rutas (`/plans/[planId]` y
`/training-plans/[planId]`) — la única diferencia es qué acciones
muestra, gateadas por si quien mira es el dueño del plan
(`plan.ownerId === user.userId`), mismo criterio que ya usa
`canDeleteTeam` en equipos.

### Pantallas y rutas

- `/training-plans` (entrenador) — `TrainingPlansScreen`: lista de los
  planes propios (nombre, estado activo/vencido, caducidad), botón
  "Crear plan", por fila: Ver, Editar, Asignar, Clonar, Borrar.
- `/training-plans/create` — `CreateTrainingPlanScreen`: nombre,
  descripción, caducidad (7/14), constructor de los 7 días.
- `/training-plans/[planId]` — `TrainingPlanDetailScreen` (ver arriba,
  compartida).
- `/training-plans/[planId]/edit` — `EditTrainingPlanScreen`, mismos
  campos que crear, precargados (reusa `useTrainingPlanForm` +
  `TrainingPlanFormFields`, mismo patrón que
  `useTeamGeneralInfoForm`/`TeamGeneralInfoFields` en equipos).
- `/training-plans/[planId]/assign` — `AssignTrainingPlanScreen`: elegir
  equipo propio → grupo del equipo O corredor del roster de ese equipo.
- `/plans` (corredor) — `MyPlansScreen`: lista de planes asignados
  (propio + por grupo), solo lectura.
- `/plans/[planId]` — reusa `TrainingPlanDetailScreen`.

### Constructor de los 7 días: un picker por día, no un editor de texto libre

Cada uno de los 7 días es una card con un selector de tipo (Descanso /
Maratón / Otra actividad + nombre / Entrenamiento). Un día de tipo
Entrenamiento despliega 3 sub-bloques fijos (Entrada en calor / Bloque
principal / Vuelta a la calma), cada uno con su propio selector de tipo
y los campos numéricos que correspondan (minutos, distancia, velocidad,
repeticiones, descanso) — exactamente los atributos que ya define el
SQL de referencia por tipo de bloque, ninguno inventado de más.

## Enmienda 2026-08-26: ejercicios y sesiones pasan a ser catálogo reusable

Feedback del usuario tras la primera entrega: la granularidad estaba
mal — un día de entrenamiento no debería armar sus 3 bloques inline
cada vez, "ejercicio" y "sesión" son estructuras de datos que van a
crecer (ej. video por ejercicio a futuro) y se van a poder templarizar
para reusar entre planes, con sus propias pantallas de ABMC más
adelante ("otros menús", fuera de esta entrega). Cambios:

- **`Exercise`** (nuevo, catálogo del entrenador): `{id, ownerId, name,
  kind, minutes?, distanceM?, speedKph?, videoUrl}` — `kind` es
  walking/jogging/elongation/cruising/running (los 5 tipos hoja del SQL
  de referencia, ya sin la envoltura `set` — ver abajo). `videoUrl`
  existe en el modelo desde ya (siempre `null` por ahora) para no tener
  que migrar el shape el día que se implemente.
- **`Session`** (nuevo, catálogo del entrenador): `{id, ownerId, name,
  description, warmupExerciseId, mainExerciseId, mainRepeatCount,
  mainRestMinutes, cooldownExerciseId}` — reemplaza `TrainingSession`.
  La "serie" (`set_block` del SQL) deja de ser un tipo de ejercicio
  aparte: `mainRepeatCount`/`mainRestMinutes` en la sesión envuelven
  cualquier ejercicio elegido para el bloque principal (repeatCount=1,
  restMinutes=0 es "una sola vez", igual que antes pero ya no hace
  falta un `kind: 'set'` separado — un ejercicio de tipo `running`
  repetido 4 veces con descanso ya expresa lo mismo que antes era
  `main.kind='set'` + `set.kind='running'`).
- **`PlanDay`**: un día `kind:'training'` ahora tiene `sessionId`
  (referencia), no una `session` embebida — arma el plan **eligiendo**
  una sesión ya creada, no construyéndola de cero cada vez.
- Formulario de plan (`DayCard` en `training-plan-form-fields.jsx`):
  para un día de Entrenamiento, un selector de sesión (`Session`
  existente del entrenador) + botón "Crear sesión" al lado. Ese botón
  abre `CreateSessionModal` (no navega a otra pantalla — perdería el
  plan a medio armar) con sus propios selectores de ejercicio para
  warmup/main/cooldown, cada uno con su propio botón "Crear ejercicio"
  que abre `CreateExerciseModal`. Los modales son la versión mínima de
  "alta" pedida ahora ("un botón para acceder al formulario de alta de
  sesión ahí mismo") — las pantallas completas de catálogo (listar,
  editar, borrar ejercicios/sesiones sueltas) quedan fuera de esta
  entrega, explícitamente para "otros menús en el futuro".
- Vista de detalle (`TrainingPlanDetailScreen`): un día de entrenamiento
  pasa a ser expandible (mismo patrón acordeón que ya usa `RunnerRow`
  en mobile) — colapsado muestra el nombre de la sesión, expandido
  muestra cada ejercicio (warmup/main/cooldown) como su propia fila,
  "al estilo gimnasio": ícono por tipo, nombre, dato clave (minutos,
  distancia, velocidad), y el bloque principal muestra "N ×" cuando
  `mainRepeatCount > 1`.
- Un poco de personalidad visual pedida también acá: cada `kind` de
  ejercicio tiene su propio ícono + color (antes todos los tags eran
  gris neutro) — caminata celeste, trote ámbar, corrida rojo/naranja
  (mayor intensidad), ritmo continuo verde azulado, elongación violeta.
  Mismo criterio ya usado en el resto de la app (semáforo de color con
  intención, no decorativo porque sí) pero acá el "significado" es el
  tipo de esfuerzo, no un estado de urgencia.

## Fuera de alcance

Retomar el picker de plan dentro del wizard de creación de equipo
(`group-list-editor.jsx`) — sigue vacío por ahora, ver más arriba.
Historial de asignaciones (cuándo se le asignó/desasignó un plan a
quién), versionado de un plan ya asignado (editar un plan afecta a
todos los que lo tengan asignado ahora mismo — no hay snapshot por
asignación), notificar al corredor cuando se le asigna/cambia un plan,
progreso/cumplimiento real de las sesiones (marcar un entrenamiento
como hecho), backend real (sigue sin existir — todo pasa por el mock,
ver `BACKEND_API_GAPS.md`). Pantallas de catálogo completo de
ejercicios/sesiones (listar/editar/borrar sueltos, fuera del flujo de
armar un plan) — "otros menús" a futuro, hoy solo existe el alta rápida
vía modal. Video por ejercicio (el campo existe, sin UI para cargarlo).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse como entrenador (rol activo) →
"Planes de entrenamiento" → crear un plan (7 días, algunos de
descanso/otra actividad, al menos uno de entrenamiento con sus 3
bloques) → aparece en la lista con estado "Activo". Asignarlo a un
grupo de "Runners Mendoza" y por separado a un corredor individual de
otro equipo. Clonar el plan → aparece un segundo plan idéntico, sin
asignaciones. Editar el original → el clon no cambia. Loguearse (o
switchear a) corredor miembro de ese grupo → "Mis planes" muestra el
plan asignado por grupo; loguearse como el corredor con asignación
individual → ve el suyo. Ninguno de los dos puede editar/borrar desde
ahí. Borrar el plan desde el lado del entrenador → desaparece de "Mis
planes" para ambos corredores.

`npm test` y `npm run lint` en verde antes de abrir la PR.

## Enmienda 2026-09-03: sin "Maratón", datos característicos completos por tipo de ejercicio

Dos pedidos del usuario en la misma sesión:

**"Maratón" sale de las opciones de tipo de día.** `DAY_KIND_OPTIONS`
pasa a `Descanso / Otra actividad / Entrenamiento`, se borra la entrada
`marathon` de `DAY_KIND_META` (sin uso ya en ningún lado — ningún plan
sembrado ni test lo usaba). Todo el código que resuelve el tipo de día
ya caía a `DAY_KIND_META.rest` como fallback ante un kind desconocido,
así que no rompe nada si quedara algún dato viejo con ese kind.

**Cada tipo de ejercicio necesita sus propios "datos característicos"
completos**, verbatim del usuario: *"Cada ejercicio tiene un nombre, un
tipo y otros datos caracteristicos de el ejercicio. Por ejemplo, hay un
ejercicio elongacion de musculo cuadriceps. O una serie de distancia
400m y un ritmo."* Repasando los 5 kinds, había dos incompletos:

- **`elongation`** no tenía NINGÚN dato propio — el grupo muscular
  vivía metido en el `name` como texto libre ("Elongación de
  cuádriceps"), no como algo consultable/filtrable. Se agrega
  `muscleGroup`, un picker cerrado (no texto libre) —
  `MUSCLE_GROUP_OPTIONS` en `store/exercise-store.js`, mismo lugar que
  ya tiene `EXERCISE_KIND_OPTIONS`: Cuádriceps, Isquiotibiales, Gemelos
  (pantorrillas), Glúteos, Aductores, Psoas / flexores de cadera, Zona
  lumbar / cadena posterior, Core / abdominales — los grupos que ya
  cubrían los 4 ejercicios de elongación sembrados, más los 2 que
  faltaban para que el picker no quede corto de entrada.
- **`cruising`** (ritmo continuo) tenía `distanceM` pero no `speedKph`
  — un ritmo continuo sin ritmo asociado es una inconsistencia real,
  no una simplificación a propósito. Pasa a compartir `speedKph` con
  `running` (mismo campo, mismo label "Velocidad (km/h)" — no se
  inventa una unidad nueva tipo min/km, es más cambio del que se pidió
  y una fuente de bugs de parseo que no vale la pena para esta vuelta).

`walking`/`jogging` (`minutes`) y `running` (`distanceM` + `speedKph`)
quedan como estaban — ya tenían su dato característico completo.

Modelo de `Exercise` resultante:

```
{ id, ownerId, name, kind, minutes, distanceM, speedKph, muscleGroup, videoUrl }
```

`muscleGroup` solo es relevante (se muestra en el form, se guarda) con
`kind === 'elongation'` — mismo criterio condicional que ya usan
`minutes`/`distanceM`/`speedKph` en `CreateExerciseModal`
(`showMinutes`/`showDistance`/`showSpeed`, ahora + `showMuscleGroup`).

La línea de "stat" de un ejercicio (ícono + nombre + datos) se arma en
3 lugares por separado (`ExercisesCatalogTab`, `TrainingPlanDetailScreen`,
`TodaySessionCard`) — con 2 campos más para tejer ahí, se extrae a un
helper compartido `buildExerciseStatLine(exercise)` en
`exercise-kind-meta.js` en vez de triplicar la lógica.

### Fuera de alcance (esta enmienda)

Repensar la unidad de `speedKph` (min/km en vez de km/h) — el usuario
dice "un ritmo" pero cambiar de unidad implica un input mm:ss nuevo,
parseo/validación, y migrar los datos sembrados; no fue lo
explícitamente pedido, se deja para si hace falta más adelante.
`holdSeconds` (segundos sostenidos) para elongación — dato real y
relevante, pero no lo pidió el usuario, se agrega si surge la
necesidad concreta en vez de anticiparla.
