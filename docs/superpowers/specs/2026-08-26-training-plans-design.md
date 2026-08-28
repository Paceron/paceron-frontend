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

## Fuera de alcance

Retomar el picker de plan dentro del wizard de creación de equipo
(`group-list-editor.jsx`) — sigue vacío por ahora, ver más arriba.
Historial de asignaciones (cuándo se le asignó/desasignó un plan a
quién), versionado de un plan ya asignado (editar un plan afecta a
todos los que lo tengan asignado ahora mismo — no hay snapshot por
asignación), notificar al corredor cuando se le asigna/cambia un plan,
progreso/cumplimiento real de las sesiones (marcar un entrenamiento
como hecho), backend real (sigue sin existir — todo pasa por el mock,
ver `BACKEND_API_GAPS.md`).

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
