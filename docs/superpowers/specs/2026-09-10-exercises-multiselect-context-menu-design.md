# Ejercicios: selección múltiple + menú contextual — Design

## Contexto

Primer sub-proyecto de un esfuerzo más grande de rediseño del catálogo del
entrenador (ejercicios → sesiones → planes de entrenamiento), corrido en la
rama compartida `feature/catalog-redesign` — ver los otros dos specs
hermanos (`2026-09-10-training-plans-variable-duration-design.md` y
`2026-09-10-sessions-drag-and-drop-design.md`, este último con la decisión
de librería de drag-and-drop) para el resto del alcance. Este documento
cubre **solo** ejercicios.

Hoy `components/plans/exercises-catalog-tab.jsx` muestra una lista simple:
cada fila (`ExerciseRow`) tiene un ícono de lápiz (editar) y uno de tacho
(eliminar) sueltos, sin selección ni acciones en bloque. `hooks/use-exercises.js`
expone `createExercise`/`updateExercise`/`deleteExercise` — sin clonar.

## Alcance

**Adentro:**
- Modo selección múltiple sobre la lista de ejercicios.
- Menú de tres puntitos por fila (reemplaza lápiz/tacho sueltos): Editar,
  Clonar, Eliminar.
- Barra de acciones en bloque cuando hay 1+ seleccionados: Adjuntar a
  sesión existente, Clonar, Eliminar.
- `cloneExercise` nuevo en servicio/mock/hook.
- Modal de eliminación en bloque, consciente de uso en sesiones (mismo
  criterio que el modal individual ya existente).

**Afuera (explícitamente):**
- "Crear sesión con estos" (acción de creación de sesión desde una
  selección de ejercicios) — se agrega en el sub-proyecto de sesiones,
  cuando el modal de creación de sesiones ya tenga la forma nueva. No
  aparece en la barra de acciones en bloque de este sub-proyecto.
- Cualquier cambio a `create-session-modal.jsx` — ese archivo lo toca
  íntegramente el sub-proyecto de sesiones.
- Cualquier cambio al modelo de planes de entrenamiento — sub-proyecto
  aparte.

## Modo selección

Botón "Seleccionar" nuevo en el `headerRight` de la `SectionCard` de
`exercises-catalog-tab.jsx`, junto al "Crear ejercicio" existente. Estado
nuevo `const [selectionMode, setSelectionMode] = useState(false)` y
`const [selectedIds, setSelectedIds] = useState(new Set())`.

- Activar: `selectionMode = true`, botón pasa a decir "Cancelar".
- Cancelar (o desactivar): `selectionMode = false`, `selectedIds` se
  limpia.
- Con `selectionMode` activo, cada `ExerciseRow` muestra un checkbox a la
  izquierda del ícono de tipo (reusa `components/forms/checkbox-field.jsx`
  si su estilo encaja en una fila densa, si no un `Pressable` chico con
  `MaterialCommunityIcons` `checkbox-marked`/`checkbox-blank-outline` —
  decisión de implementación, sin impacto en el resto del diseño).
- Con `selectionMode` activo, el menú de tres puntitos por fila (ver
  siguiente sección) **no se muestra** — evita ambigüedad de si una acción
  del menú aplica a esa fila sola o a toda la selección.

## Menú de tres puntitos por fila

Reemplaza los `Pressable` sueltos de lápiz (`{idPrefix}-edit-button`) y
tacho (`{idPrefix}-delete-button`) en `ExerciseRow`
(`exercises-catalog-tab.jsx:51-56`) por un único botón `dots-vertical`,
mismo patrón que `RunnerMenu`/`RunnerActionsMenu` de
`components/team/team-detail-screen.jsx:173-231`:

- Un solo estado de "qué fila tiene el menú abierto" vive en
  `ExercisesCatalogTab` (no local a cada fila) — evita que el panel quede
  atrapado en el stacking context de su propia fila.
- El botón usa `measureInWindow` contra sí mismo y contra un `containerRef`
  del contenedor de la lista (mismo cálculo que `RunnerMenu#handlePress`)
  para posicionar el panel via `AnimatedDropdown`
  (`components/shared/animated-dropdown.jsx`).
- Panel (`ExerciseActionsMenu`, nuevo, mismo archivo o
  `exercises-catalog-tab.jsx`): 3 ítems —
  - **Editar** (`pencil-outline`) → mismo `onEdit(exercise)` que ya existe.
  - **Clonar** (`content-copy`) → llama `cloneExercise` (ver sección
    siguiente), toast de éxito/error, sin confirmación (mismo criterio
    que clonar planes hoy — no es destructivo).
  - **Eliminar** (`trash-can-outline`, rojo) → mismo flujo que hoy
    (`DeleteCatalogItemModal` individual, sin cambios).

El link "Usado en N sesiones" (`{idPrefix}-usage-button`) no se mueve,
queda como está — es información, no una acción.

## `cloneExercise`

Mismo patrón exacto que `cloneTrainingPlan`
(`services/trainingPlans.js:65-68`, `services/__mocks__/training-plans-mock.js:152-170`):

**`services/__mocks__/exercises-mock.js`** — nueva función:

```js
// Copia con sufijo "(copia)" — mismo criterio que mockCloneTrainingPlan.
// No hereda uso en sesiones (una sesión existente sigue apuntando al
// exerciseId original, no al clon).
export async function mockCloneExercise(exerciseId) {
  const original = findExerciseOrThrow(exerciseId);
  const now = new Date().toISOString();
  const clone = {
    ...original,
    id: nextId++,
    name: `${original.name} (copia)`,
    created_at: now,
    updated_at: now,
  };
  mockExercises.push(clone);
  return clone;
}
```

(`findExerciseOrThrow`, `nextId`, `mockExercises` ya existen en
`services/__mocks__/exercises-mock.js:50-54` con esos nombres exactos —
confirmado leyendo el archivo real.)

**`services/exercises.js`** — nueva función:

```js
// POST /api/v1/exercises/{id}/clone.
export async function cloneExercise(exerciseId) {
  if (USE_MOCKS || FORCE_MOCKS) return await mockCloneExercise(exerciseId);
  return await api.post(`/exercises/${exerciseId}/clone`);
}
```

**`hooks/use-exercises.js`** — nueva mutación en `useExerciseMutations()`,
mismo patrón que `deleteExerciseMutation`:

```js
const cloneExerciseMutation = useMutation({
  mutationFn: async ({ exerciseId }) => {
    try {
      const cloned = await cloneExerciseService(exerciseId);
      return { success: true, exercise: toExerciseModel(cloned) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  onSuccess: (result, variables) => {
    if (result.success) queryClient.invalidateQueries({ queryKey: ['exercises', variables.ownerId] });
  },
});
```

Expuesta como `cloneExercise: cloneExerciseMutation.mutateAsync` +
`isCloning: cloneExerciseMutation.isPending` en el `return` del hook.
`variables` necesita llevar `ownerId` además de `exerciseId` para poder
invalidar (igual que las otras 3 mutaciones ya existentes — el caller
pasa `{ ownerId, exerciseId }`, aunque `cloneExerciseService` solo use
`exerciseId`).

**Test nuevo** en `__tests__/exercises-mock.test.js` (archivo ya existe,
cubre el resto del CRUD): agregar un `describe('mockCloneExercise')` con
casos — clona con id distinto, nombre con sufijo "(copia)", copia el
resto de los campos (`kind`, `ownerId`, etc.), lanza si el id no existe
(mismo comportamiento 404 que el resto de las funciones del mock).

## Barra de acciones en bloque

Cuando `selectedIds.size > 0`, el `headerRight` de la `SectionCard`
cambia (en vez de "Crear ejercicio"/"Seleccionar") a:

```jsx
<View className="flex-row items-center gap-2">
  <Text>{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</Text>
  <Pressable onPress={openBulkMenu}>
    <MaterialCommunityIcons name="dots-vertical" />
  </Pressable>
</View>
```

El menú (`AnimatedDropdown`, mismo mecanismo que el de fila) ofrece:

- **Adjuntar a sesión existente** → ver sección siguiente.
- **Clonar** → llama `cloneExercise` una vez por cada id seleccionado
  (`Promise.all`), toast único al final ("N ejercicios clonados" o, si
  alguno falló, "M de N clonados"). Sale del modo selección al terminar.
- **Eliminar** (rojo) → abre `BulkDeleteExercisesModal` (ver más abajo).

## Adjuntar a sesión existente

Nuevo componente chico `AttachToSessionPicker` (modal simple, un
`ResponsiveSelectField` con las sesiones del entrenador
`useSessions(userId)` + botón "Adjuntar"). Al confirmar:

1. Función pura nueva en `services/normalizers.js`:

```js
// Fusiona ejercicios nuevos (agregados al final, rol "principal" por
// default) con los que ya tiene la sesión — usada por la acción
// "Adjuntar a sesión existente" del catálogo de ejercicios. No aplica
// ninguna validación de "1 ejercicio por rol" (esa regla es solo del
// formulario de alta/edición manual, ver create-session-modal.jsx) — acá
// el entrenador ya tiene una sesión válida y solo agrega más filas.
export function mergeSessionExercises(session, newExerciseIds) {
  const existing = session.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    role: e.role,
    repeatCount: e.repeatCount,
    restMinutes: e.restMinutes,
  }));
  const added = newExerciseIds.map((exerciseId) => ({
    exerciseId,
    role: 'main',
    repeatCount: 1,
    restMinutes: 0,
  }));
  return [...existing, ...added];
}
```

2. El picker llama `updateSession` (`hooks/use-sessions.js`, ya existe)
   con:

```js
await updateSession({
  ownerId: userId,
  sessionId: chosenSession.id,
  form: {
    name: chosenSession.name,
    description: chosenSession.description,
    exercises: mergeSessionExercises(chosenSession, Array.from(selectedIds)),
  },
});
```

3. Toast de éxito ("N ejercicios agregados a `<nombre de sesión>`") o
   error. Sale del modo selección al terminar. Sin abrir el modal de
   edición de la sesión — el entrenador ajusta rol/orden después si hace
   falta, desde el catálogo de sesiones.

**Test nuevo**: `__tests__/normalizers.test.js` (ya existe) — casos para
`mergeSessionExercises`: agrega al final en orden, rol siempre "main",
`repeatCount`/`restMinutes` en default, no muta el array de la sesión
original.

## Eliminar en bloque

Nuevo componente `BulkDeleteExercisesModal`
(`components/plans/bulk-delete-exercises-modal.jsx`), mismo lenguaje
visual que `DeleteCatalogItemModal` (`components/plans/delete-catalog-item-modal.jsx`)
pero para una lista:

- Lista los N nombres de los ejercicios seleccionados.
- Función pura nueva (junto a `mergeSessionExercises`, mismo archivo o
  `exercises-catalog-tab.jsx` junto a `sessionsUsingExercise` que ya
  existe ahí) — agrega qué exercises de la selección están en uso:

```js
// Para cada ejercicio de la selección, sus sesiones de uso (reusa
// sessionsUsingExercise ya existente) — usado por el modal de borrado
// en bloque para saber a cuáles avisar.
export function exercisesWithUsage(exerciseIds, exercises, sessions) {
  return exerciseIds
    .map((id) => ({
      exercise: exercises.find((e) => e.id === id),
      usedIn: sessionsUsingExercise(id, sessions),
    }))
    .filter((entry) => entry.usedIn.length > 0);
}
```

- Si `exercisesWithUsage(...).length > 0`, se listan aparte con sus
  sesiones (reusa el patrón visual de `DeleteCatalogItemModal`'s bloque
  ámbar) y exige el mismo checkbox "Entiendo que van a dejar de estar en
  esas sesiones" antes de habilitar "Eliminar" — mismo criterio que hoy
  para el caso individual, solo que agregando todos los que apliquen.
- Confirmar → llama `deleteExercise` una vez por cada id seleccionado
  (`Promise.all`), toast único, sale del modo selección.

**Test nuevo**: `__tests__/normalizers.test.js` (si `exercisesWithUsage`
termina viviendo ahí) o el archivo de test que corresponda al lugar final
de la función — casos: filtra correctamente los que tienen uso, ignora
los que no, agrega las sesiones correctas por ejercicio.

## Testing / verificación

Lógica pura con test real (convención del repo, ver CLAUDE.md sección
Testing — `npm test` cubre store/servicios/mocks/normalizers, no render
de componentes):
- `mockCloneExercise` (`__tests__/exercises-mock.test.js`).
- `mergeSessionExercises` (`__tests__/normalizers.test.js`).
- `exercisesWithUsage` (mismo archivo que corresponda).

Sin test de componente (convención) — verificación manual en preview:
1. Activar "Seleccionar", marcar 2+ ejercicios, confirmar que el header
   cambia a "N seleccionados" y el menú por fila desaparece.
2. Menú por fila (fuera de modo selección): Editar (sin cambios),
   Clonar (aparece "... (copia)" en la lista), Eliminar (sin cambios).
3. Bloque → Clonar: clona los N seleccionados, toast correcto.
4. Bloque → Eliminar, con al menos uno en uso: checkbox obligatorio antes
   de habilitar el botón.
5. Bloque → Adjuntar a sesión existente: elegir una sesión, confirmar que
   los ejercicios aparecen al final de esa sesión (abrir esa sesión desde
   el catálogo de sesiones para chequear).

`npm test` y `npm run lint` en verde antes de cada commit.
