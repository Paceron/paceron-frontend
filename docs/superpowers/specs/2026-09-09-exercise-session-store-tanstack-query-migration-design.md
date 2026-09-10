# Migración de `exercise-store.js`/`session-store.js` a TanStack Query — diseño

## Contexto

Tercera migración de Zustand a TanStack Query siguiendo el mismo criterio
ya aplicado a equipos (`hooks/use-teams.js`/`hooks/use-groups.js`/
`hooks/use-invitations.js`, PR #123) y al perfil de usuario
(`hooks/use-user.js`, PR #124) — ver `CLAUDE.md`, sección "Estado de
aplicación vs. estado de servidor". Orden acordado con el usuario
2026-09-09: auth primero (ya hecho), después ejercicios y sesiones (esta
spec), planes de entrenamiento al final (su diseño todavía puede
cambiar).

`store/exercise-store.js` y `store/session-store.js` son el catálogo
reusable del entrenador (ver enmienda 2026-08-26 de
`docs/superpowers/specs/2026-08-26-training-plans-design.md` y el ABM
completo en `docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md`).
Ambos son CRUD simple, simétrico entre sí, sin ninguna dependencia
cruzada de estado entre ellos ni con otros stores (confirmado: no hay
ningún `useExerciseStore.getState()`/`useSessionStore.getState()` fuera
de sus propios tests). `sessions-catalog-tab.jsx` y varias pantallas de
planes leen ambos juntos, pero como dos fetches independientes, nunca
como estado compartido.

**Importante — sin backend real todavía, para los dos dominios:**
`services/exercises.js` y `services/sessions.js` tienen
`FORCE_MOCKS = true` (gap 4 de `docs/BACKEND_API_GAPS.md`) — esta
migración no cambia esa situación, solo mueve el estado de Zustand a
Query sobre la misma capa de servicio/mock existente. El mock de ambos
(`services/__mocks__/exercises-mock.js`/`sessions-mock.js`) es
consistente (una sola lista in-memory que `create`/`update`/`delete`
mutan directamente y que `list` refleja), a diferencia del viejo mock de
perfil de usuario — por eso acá alcanza con `invalidateQueries` después
de cada mutación, sin necesidad de sembrar el cache a mano con la
respuesta de la mutación (que sí hizo falta en `hooks/use-user.js` por
el gap de ese mock puntual).

## Alcance

Un solo spec para ambos dominios (exercises + sessions) — decisión
explícita del usuario, dado que ya se atacan juntos en el plan de
trabajo y comparten exactamente la misma forma. No incluye
`training-plan-store.js` (fuera de alcance, sub-proyecto siguiente y
último del esfuerzo, deliberadamente después porque su diseño puede
cambiar).

## Diseño

### `hooks/use-exercises.js` (nuevo)

- `useExercises(ownerId)` → `{ exercises, loading }`. Query key:
  `['exercises', ownerId]`. `queryFn` llama a
  `listExercisesService({ ownerId })` y mapea con `toExerciseModel`.
  `enabled: Boolean(ownerId)`.
- `useExerciseMutations()` → `{ createExercise, isCreating,
  updateExercise, isUpdating, deleteExercise, isDeleting }`.
  - `createExercise({ ownerId, form })` → llama a
    `createExerciseService(toCreateExercisePayload(form))`, invalida
    `['exercises', ownerId]` en `onSuccess`.
  - `updateExercise({ ownerId, exerciseId, form })` → llama a
    `updateExerciseService(exerciseId, toCreateExercisePayload(form))`,
    invalida `['exercises', ownerId]`.
  - `deleteExercise({ ownerId, exerciseId })` → llama a
    `deleteExerciseService(exerciseId)`, invalida
    `['exercises', ownerId]`.
  - Las tres mutationFn siguen el patrón ya establecido: `try/catch`
    interno, devuelven `{ success, error? }` (y `{ success, exercise }`
    para create/update, igual que hoy), nunca lanzan.
  - `ownerId` viaja en cada variable de mutación (no se resuelve
    internamente vía `useAuthStore`) porque los 3 call sites que
    mutan (`create-exercise-modal.jsx` y, indirectamente,
    `exercises-catalog-tab.jsx` para el delete) ya tienen `ownerId`
    a mano desde el componente — mismo criterio que
    `useTeamMutations().deleteTeam({ teamId, userId })` en
    `hooks/use-teams.js`, que también recibe el id necesario para
    invalidar como parte de las variables en vez de leerlo de un
    store aparte.
- `EXERCISE_KIND_OPTIONS` y `MUSCLE_GROUP_OPTIONS` (constantes puras,
  sin estado) se mueven acá desde `store/exercise-store.js` — mismo
  archivo que ya las consume (`create-exercise-modal.jsx`), sin
  necesidad de un tercer archivo de constantes solo para esto.

### `hooks/use-sessions.js` (nuevo)

Misma forma exacta, para el dominio de sesiones:

- `useSessions(ownerId)` → `{ sessions, loading }`, key
  `['sessions', ownerId]`.
- `useSessionMutations()` → `{ createSession, isCreating, updateSession,
  isUpdating, deleteSession, isDeleting }`, mismo patrón de
  `{ownerId, ...}` en las variables y de invalidar
  `['sessions', ownerId]` en `onSuccess`.

### `store/exercise-store.js` / `store/session-store.js` — se eliminan

A diferencia de `team-store.js` (que sobrevivió con un remanente
100%-local, `setGroupTrainingPlan` + selectores), acá no queda nada
client-only — ambos archivos se borran enteros. Sus dos únicas
constantes puras (`EXERCISE_KIND_OPTIONS`/`MUSCLE_GROUP_OPTIONS`) migran
a `hooks/use-exercises.js` como se explicó arriba.

### Impacto en consumidores (9 archivos)

Todos migran del patrón `useExerciseStore((s) => s.x)` /
`useSessionStore((s) => s.x)` al patrón `useExercises(ownerId)` /
`useExerciseMutations()` (ídem sessions). Lista completa, con el detalle
de qué usa cada uno hoy:

1. **`components/plans/session-exercises-preview.jsx`** — solo lee
   `exercises` (asume que ya está cargado por el padre), sin recibir
   `ownerId` como prop hoy (confirmado revisando los 2 call sites,
   `sessions-catalog-tab.jsx` y `training-plan-form-fields.jsx`,
   ninguno se lo pasa). Pasa a resolver
   `const ownerId = useAuthStore((s) => s.userId)` directo adentro del
   propio componente — es una pantalla exclusiva del catálogo del
   entrenador autenticado, no hace falta prop-drilling — y usar
   `useExercises(ownerId).exercises`.
2. **`components/plans/sessions-catalog-tab.jsx`** — lee/muta sessions,
   lee+fetchea exercises (para el preview de cada fila). Mecánico.
3. **`components/plans/training-plans-screen.jsx`** — solo dispara
   `fetchExercises`/`fetchSessions` en el pull-to-refresh — pasa a
   invalidar `['exercises', ownerId]`/`['sessions', ownerId]` vía
   `useQueryClient()` (mismo patrón que otros refresh ya migrados, ver
   `tier-upgrade-screen.jsx`).
4. **`components/plans/training-plan-form-fields.jsx`** — lee sessions
   para el picker de sesión por día, fetchea exercises (para que
   `session-exercises-preview.jsx` los tenga disponibles). Mecánico.
5. **`components/plans/training-plan-detail-screen.jsx`** — lee ambos
   catálogos completos, sin mutar. Mecánico.
6. **`components/plans/create-session-modal.jsx`** — lee+fetchea
   exercises (catálogo para elegir), crea/edita sessions. Mecánico +
   pasa `ownerId` a las mutations.
7. **`components/plans/exercises-catalog-tab.jsx`** — lee/muta
   exercises, lee+fetchea sessions (para "usado en N sesiones", igual
   patrón que `plansUsingSession`). Mecánico.
8. **`components/plans/create-exercise-modal.jsx`** — crea/edita
   exercises, usa `MUSCLE_GROUP_OPTIONS`. Mecánico + import de
   constante actualizado.
9. **`hooks/use-today-plan-session.js`** — ya NO usa estos stores
   (comentario explícito en el archivo: "A propósito NO usa
   useSessionStore/useExerciseStore"), sin cambios — se incluye en la
   lista solo porque el grep original lo encontró (matchea el
   comentario, no una llamada real).

### Testing

- `__tests__/exercise-store.test.js` y `__tests__/session-store.test.js`
  se eliminan sin reemplazo — testean acciones CRUD del store que ya no
  existe, y el proyecto no hace tests de render de componentes (ver
  `CLAUDE.md`, sección Testing), que es lo que haría falta para probar
  un hook envuelto en `QueryClientProvider`. La cobertura real de la
  capa de datos sigue intacta: `__tests__/exercises-mock.test.js` y
  `__tests__/sessions-mock.test.js` testean el servicio/mock
  directamente, sin pasar por el store ni por hooks — no cambian.
- **Nota para más adelante (no parte de esta migración):** cuando el
  trabajo esté bloqueado por falta de avances del backend real, vale la
  pena evaluar sumar tests de render de componentes — hoy es una
  convención deliberada del proyecto ("no hay tests de render", ver
  `CLAUDE.md`), pero a medida que más estado se mueve a hooks de Query
  (sin store Zustand testeable con `getState()`), la superficie que
  queda sin cobertura automática crece. No se resuelve acá; queda
  anotado como posible trabajo futuro cuando haya tiempo ocioso de
  frontend esperando al backend.

## Fuera de alcance

- `training-plan-store.js` — sub-proyecto siguiente, deliberadamente al
  final.
- Cualquier cambio a `services/exercises.js`/`services/sessions.js` o
  a los mocks — se consume la capa de servicio tal cual existe hoy.
- Agregar tests de render (ver nota arriba) — queda como backlog, no
  como parte de este plan.
