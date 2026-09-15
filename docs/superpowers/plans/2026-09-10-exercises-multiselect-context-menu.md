# Ejercicios: selección múltiple + menú contextual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El catálogo de ejercicios del entrenador gana selección múltiple, un menú de tres puntitos por fila (Editar/Clonar/Eliminar) y una barra de acciones en bloque (Adjuntar a sesión existente / Clonar / Eliminar) sobre la selección, más una mutación `cloneExercise` nueva en toda la pila (mock → servicio → hook).

**Architecture:** Estado de selección y de "qué menú está abierto" viven en `ExercisesCatalogTab` (no en cada fila) — mismo patrón ya usado por `RunnerMenu`/`RunnerActionsMenu` en `team-detail-screen.jsx` para evitar que un panel quede atrapado en el stacking context de su propia fila. Dos funciones puras nuevas (`mergeSessionExercises`, `exercisesWithUsage`) encapsulan la lógica de "adjuntar" y "detectar uso antes de borrar en bloque", testeables sin montar componentes.

**Tech Stack:** React Native + React Native Web, TanStack Query, `react-native-reanimated` (para `AnimatedDropdown`, ya existente).

**Spec:** `docs/superpowers/specs/2026-09-10-exercises-multiselect-context-menu-design.md`

## Global Constraints

- Todo elemento visual nuevo lleva `nativeID` y `testID` únicos (regla `local/require-native-id`).
- Sin tests de componente (convención del repo) — solo lógica pura (mocks/normalizers) lleva test real.
- `npm test` y `npm run lint` en verde antes de cada commit.
- "Crear sesión con estos" NO se implementa en este plan (queda para el sub-proyecto de sesiones) — no debe aparecer en el menú en bloque.

---

### Task 1: `cloneExercise` en mock, servicio y hook

**Files:**
- Modify: `services/__mocks__/exercises-mock.js`
- Modify: `services/exercises.js`
- Modify: `hooks/use-exercises.js`
- Test: `__tests__/exercises-mock.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores (primer task).
- Produces: `cloneExercise: ({ ownerId, exerciseId }) => Promise<{ success: boolean, exercise?: Model, error?: string }>` en el objeto que devuelve `useExerciseMutations()` — los tasks 5 y 6 lo consumen para clonar (individual y en bloque).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `__tests__/exercises-mock.test.js` (al final del `describe('exercises-mock', ...)` existente):

```js
  test('mockCloneExercise clona con id nuevo, nombre con sufijo "(copia)" y el resto de los campos igual', async () => {
    const original = await mockGetExercise(1);
    const clone = await mockCloneExercise(1);
    expect(clone.id).not.toBe(original.id);
    expect(clone.name).toBe(`${original.name} (copia)`);
    expect(clone.kind).toBe(original.kind);
    expect(clone.owner_id).toBe(original.owner_id);
    expect(clone.intensity).toBe(original.intensity);
    expect(clone.minutes).toBe(original.minutes);
    expect(clone.distance_m).toBe(original.distance_m);
    expect(clone.speed_kph).toBe(original.speed_kph);
    expect(clone.muscle_group).toBe(original.muscle_group);

    const all = await mockListExercises();
    expect(all.some((e) => e.id === clone.id)).toBe(true);
  });

  test('mockCloneExercise tira 404-like si el id no existe', async () => {
    await expect(mockCloneExercise(9999)).rejects.toThrow('no encontrado');
  });
```

Y agregar `mockCloneExercise` al import del archivo (línea 1-3):

```js
import {
  mockListExercises, mockGetExercise, mockCreateExercise, mockUpdateExercise, mockDeleteExercise, mockCloneExercise, __resetMockExercises,
} from '../services/__mocks__/exercises-mock.js';
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest exercises-mock -t "mockCloneExercise"`
Expected: FAIL — `mockCloneExercise is not a function` (todavía no existe en el mock).

- [ ] **Step 3: Implementar `mockCloneExercise`**

En `services/__mocks__/exercises-mock.js`, agregar esta función después de `mockDeleteExercise` (antes de `__resetMockExercises`):

```js
// Copia con sufijo "(copia)" — mismo criterio que mockCloneTrainingPlan
// (services/__mocks__/training-plans-mock.js). No hereda uso en
// sesiones: una sesión existente sigue apuntando al exerciseId
// original, no al clon.
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

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx jest exercises-mock -t "mockCloneExercise"`
Expected: PASS (2 tests).

- [ ] **Step 5: Agregar la función de servicio**

En `services/exercises.js`, agregar el import de `mockCloneExercise` (junto a los demás imports de `./__mocks__/exercises-mock.js`) y esta función al final del archivo:

```js
// POST /api/v1/exercises/{id}/clone.
export async function cloneExercise(exerciseId) {
  if (USE_MOCKS || FORCE_MOCKS) return await mockCloneExercise(exerciseId);
  return await api.post(`/exercises/${exerciseId}/clone`);
}
```

- [ ] **Step 6: Agregar la mutación al hook**

En `hooks/use-exercises.js`, agregar `cloneExercise as cloneExerciseService` al import de `../services/exercises.js`, y dentro de `useExerciseMutations()` (después de `deleteExerciseMutation`, antes del `return`):

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

Y en el `return` del hook, agregar:

```js
    cloneExercise: cloneExerciseMutation.mutateAsync,
    isCloning: cloneExerciseMutation.isPending,
```

- [ ] **Step 7: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan (incluidos los 2 nuevos).

- [ ] **Step 8: Commit**

```bash
git add services/__mocks__/exercises-mock.js services/exercises.js hooks/use-exercises.js __tests__/exercises-mock.test.js
git commit -m "feat(exercises): add cloneExercise mutation (mock, service, hook)"
```

---

### Task 2: Funciones puras `mergeSessionExercises` y `exercisesWithUsage`

**Files:**
- Modify: `services/normalizers.js`
- Modify: `components/plans/exercises-catalog-tab.jsx`
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `mergeSessionExercises(session, newExerciseIds) => Array<{exerciseId, role, repeatCount, restMinutes}>` exportada de `services/normalizers.js` — consumida por Task 7 (Adjuntar a sesión existente). `exercisesWithUsage(exerciseIds, exercises, sessions) => Array<{exercise, usedIn}>` exportada de `components/plans/exercises-catalog-tab.jsx` — consumida por Task 6 (Eliminar en bloque).

- [ ] **Step 1: Escribir los tests que fallan (mergeSessionExercises)**

Agregar a `__tests__/normalizers.test.js`, al import existente agregar `mergeSessionExercises`:

```js
import {
  toUserModel, toRegisterPayload, toUpdatePayload, toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload,
  toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel, toInvitePayload, toTierModel,
  toCreatePreferencePayload, toPreferenceResponseModel, toProcessPaymentPayload, toPaymentModel, toSubscriptionModel,
  toTeamSearchResultModel, toJoinRequestModel, mergeSessionExercises,
} from '../services/normalizers.js';
```

Y agregar al final del archivo:

```js
describe('mergeSessionExercises', () => {
  const session = {
    exercises: [
      { exerciseId: '1', role: 'warmup', repeatCount: 1, restMinutes: 0 },
      { exerciseId: '2', role: 'main', repeatCount: 3, restMinutes: 2 },
    ],
  };

  test('agrega los ids nuevos al final, con rol "main" y defaults', () => {
    const result = mergeSessionExercises(session, ['5', '6']);
    expect(result).toEqual([
      { exerciseId: '1', role: 'warmup', repeatCount: 1, restMinutes: 0 },
      { exerciseId: '2', role: 'main', repeatCount: 3, restMinutes: 2 },
      { exerciseId: '5', role: 'main', repeatCount: 1, restMinutes: 0 },
      { exerciseId: '6', role: 'main', repeatCount: 1, restMinutes: 0 },
    ]);
  });

  test('no muta el array de ejercicios original de la sesión', () => {
    const before = JSON.stringify(session.exercises);
    mergeSessionExercises(session, ['9']);
    expect(JSON.stringify(session.exercises)).toBe(before);
  });

  test('con lista vacía de ids nuevos, devuelve los existentes sin cambios', () => {
    expect(mergeSessionExercises(session, [])).toEqual(session.exercises);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest normalizers -t "mergeSessionExercises"`
Expected: FAIL — `mergeSessionExercises is not a function`.

- [ ] **Step 3: Implementar `mergeSessionExercises`**

Agregar a `services/normalizers.js`, después de `toCreateSessionPayload` (línea ~337):

```js
// Fusiona ejercicios nuevos (agregados al final, rol "principal" por
// default) con los que ya tiene una sesión — usada por la acción
// "Adjuntar a sesión existente" del catálogo de ejercicios
// (exercises-catalog-tab.jsx). No aplica la validación de "1 ejercicio
// por rol" del formulario de alta/edición manual (create-session-modal.jsx)
// — acá la sesión destino ya es válida, solo se agregan filas.
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

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest normalizers -t "mergeSessionExercises"`
Expected: PASS (3 tests).

- [ ] **Step 5: Escribir el test que falla (exercisesWithUsage)**

`exercisesWithUsage` vive en `exercises-catalog-tab.jsx` junto a
`sessionsUsingExercise`, que ya está exportada ahí — no hay archivo de
test para ese componente todavía (es un archivo `.jsx` de UI, sin test
hoy). Crear `__tests__/exercises-catalog-tab.test.js` nuevo:

```js
import { sessionsUsingExercise, exercisesWithUsage } from '../components/plans/exercises-catalog-tab.jsx';

const exercises = [
  { id: '1', name: 'Trote suave' },
  { id: '2', name: 'Elongación' },
  { id: '3', name: 'Series 400m' },
];
const sessions = [
  { id: 's1', name: 'Sesión A', exercises: [{ exerciseId: '1' }] },
  { id: 's2', name: 'Sesión B', exercises: [{ exerciseId: '1' }, { exerciseId: '2' }] },
];

describe('exercisesWithUsage', () => {
  test('devuelve solo los ejercicios de la selección que están en uso, con sus sesiones', () => {
    const result = exercisesWithUsage(['1', '2', '3'], exercises, sessions);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.exercise.id === '1').usedIn).toEqual(sessions);
    expect(result.find((r) => r.exercise.id === '2').usedIn).toEqual([sessions[1]]);
    expect(result.some((r) => r.exercise.id === '3')).toBe(false);
  });

  test('con ninguno en uso, devuelve array vacío', () => {
    expect(exercisesWithUsage(['3'], exercises, sessions)).toEqual([]);
  });
});
```

(Este archivo de test importa `.jsx` directo — mismo que ya hace
`__tests__/routes.catalog.test.js` u otros tests que importan de
archivos con JSX en el repo si los hay; si Jest se queja de sintaxis
JSX al importar `exercises-catalog-tab.jsx` en un entorno de test sin
render, es porque el archivo transpila igual vía babel-jest ya
configurado para `.jsx` — no hace falta configuración adicional.)

- [ ] **Step 6: Correr el test y confirmar que falla**

Run: `npx jest exercises-catalog-tab`
Expected: FAIL — `exercisesWithUsage is not a function` (no está exportada todavía).

- [ ] **Step 7: Implementar y exportar `exercisesWithUsage`**

En `components/plans/exercises-catalog-tab.jsx`, agregar después de
`sessionsUsingExercise` (línea ~21):

```js
// Para cada id de la selección, sus sesiones de uso (reusa
// sessionsUsingExercise de arriba) — usado por BulkDeleteExercisesModal
// para saber a cuáles avisar antes de borrar en bloque. Solo devuelve
// los que SÍ tienen uso (los sin uso no necesitan aviso).
export function exercisesWithUsage(exerciseIds, exercises, sessions) {
  return exerciseIds
    .map((id) => ({
      exercise: exercises.find((e) => e.id === id),
      usedIn: sessionsUsingExercise(id, sessions),
    }))
    .filter((entry) => entry.usedIn.length > 0);
}
```

- [ ] **Step 8: Correr el test y confirmar que pasa**

Run: `npx jest exercises-catalog-tab`
Expected: PASS (2 tests).

- [ ] **Step 9: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 10: Commit**

```bash
git add services/normalizers.js components/plans/exercises-catalog-tab.jsx __tests__/normalizers.test.js __tests__/exercises-catalog-tab.test.js
git commit -m "feat(exercises): add mergeSessionExercises and exercisesWithUsage pure helpers"
```

---

### Task 3: Menú de tres puntitos por fila (Editar/Clonar/Eliminar)

**Files:**
- Modify: `components/plans/exercises-catalog-tab.jsx`

**Interfaces:**
- Consumes: `cloneExercise` de `useExerciseMutations()` (Task 1).
- Produces: nada que otro task consuma directamente — Task 4 sí necesita saber que este menú existe para ocultarlo en modo selección (ver ese task).

- [ ] **Step 1: Agregar el import de `AnimatedDropdown` y `useRef`/`useState` que falten**

En `components/plans/exercises-catalog-tab.jsx`, cambiar el import de React:

```js
import { useRef, useState } from 'react';
```

Y agregar:

```js
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
```

- [ ] **Step 2: Agregar el botón de tres puntitos y el panel del menú**

Reemplazar, dentro de `ExerciseRow` (líneas 41-56 actuales — los 2
`Pressable` de editar y eliminar sueltos), por:

```jsx
      <ExerciseMenuButton containerRef={containerRef} exercise={exercise} onOpenMenu={onOpenMenu} />
```

Agregar estos 2 componentes nuevos antes de `ExerciseRow` en el mismo
archivo (mismo patrón exacto que `RunnerMenu`/`RunnerActionsMenu` en
`components/team/team-detail-screen.jsx:173-231`):

```jsx
function ExerciseMenuButton({ exercise, onOpenMenu, containerRef }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, exercise);
      });
    });
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel="Más opciones"
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={`exercise-catalog-row-${exercise.id}-menu-toggle`}
      onPress={handlePress}
      testID={`exercise-catalog-row-${exercise.id}-menu-toggle`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
    </Pressable>
  );
}

function ExerciseActionsMenu({ exercise, onEdit, onClone, onDelete }) {
  const colors = useThemeColors();

  return (
    <View className="w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="exercise-catalog-menu-panel" testID="exercise-catalog-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="exercise-catalog-menu-edit"
        onPress={() => onEdit(exercise)}
        testID="exercise-catalog-menu-edit"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="exercise-catalog-menu-edit-label" testID="exercise-catalog-menu-edit-label">Editar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="exercise-catalog-menu-clone"
        onPress={() => onClone(exercise)}
        testID="exercise-catalog-menu-clone"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="content-copy" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="exercise-catalog-menu-clone-label" testID="exercise-catalog-menu-clone-label">Clonar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="exercise-catalog-menu-delete"
        onPress={() => onDelete(exercise)}
        testID="exercise-catalog-menu-delete"
      >
        <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
        <Text className="text-sm text-red-600 dark:text-red-400" nativeID="exercise-catalog-menu-delete-label" testID="exercise-catalog-menu-delete-label">Eliminar</Text>
      </Pressable>
    </View>
  );
}
```

`ExerciseRow` pasa a recibir `containerRef` y `onOpenMenu` como props
nuevas (además de las que ya tenía), y ya NO recibe `onEdit`/`onDelete`
directo (esos ahora viven en el menú, disparados desde el padre):

```jsx
function ExerciseRow({ exercise, usedIn, onOpenMenu, onShowUsage, containerRef, selectionMode, selected, onToggleSelected }) {
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const idPrefix = `exercise-catalog-row-${exercise.id}`;
  const statLine = buildExerciseStatLine(exercise);

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      {selectionMode && (
        <Pressable
          accessibilityLabel={selected ? 'Quitar de la selección' : 'Agregar a la selección'}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          nativeID={`${idPrefix}-checkbox`}
          onPress={() => onToggleSelected(exercise.id)}
          testID={`${idPrefix}-checkbox`}
        >
          <MaterialCommunityIcons color={selected ? '#8cc63e' : '#94a3b8'} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} />
        </Pressable>
      )}
      <View className={`h-10 w-10 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={18} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {exercise.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} testID={`${idPrefix}-stat`}>
          {statLine || meta.label}
        </Text>
      </View>
      <Pressable
        disabled={usedIn.length === 0}
        nativeID={`${idPrefix}-usage-button`}
        onPress={() => onShowUsage(exercise, usedIn)}
        testID={`${idPrefix}-usage-button`}
      >
        <Text className={`text-xs ${usedIn.length > 0 ? 'font-semibold text-primary underline' : 'text-slate-400 dark:text-slate-500'}`} nativeID={`${idPrefix}-usage-label`} testID={`${idPrefix}-usage-label`}>
          Usado en {usedIn.length} {usedIn.length === 1 ? 'sesión' : 'sesiones'}
        </Text>
      </Pressable>
      {!selectionMode && <ExerciseMenuButton containerRef={containerRef} exercise={exercise} onOpenMenu={onOpenMenu} />}
    </View>
  );
}
```

(`selectionMode`/`selected`/`onToggleSelected` se usan recién en el
Task 4 — se agregan las props acá ya para no tener que retocar
`ExerciseRow` de nuevo, pero `selectionMode` siempre llega `false` hasta
ese task, así que el checkbox nunca se renderiza todavía en este punto
del plan.)

- [ ] **Step 3: Cablear el estado del menú y las acciones en `ExercisesCatalogTab`**

Dentro de `ExercisesCatalogTab`, agregar:

```js
  const { deleteExercise, cloneExercise } = useExerciseMutations();
  const containerRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null); // { anchor, exercise } | null

  const handleOpenMenu = (anchor, exercise) => setOpenMenu({ anchor, exercise });
  const handleCloseMenu = () => setOpenMenu(null);

  const handleCloneOne = async (exercise) => {
    handleCloseMenu();
    const result = await cloneExercise({ ownerId: userId, exerciseId: exercise.id });
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos clonar el ejercicio', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Ejercicio clonado' });
  };
```

(`deleteExercise` ya estaba desestructurado de `useExerciseMutations()`
— sumar `cloneExercise` a esa misma línea.)

Envolver el `View` que contiene `exercises-catalog-list` con el
`containerRef` (el `<View className="gap-2" nativeID="exercises-catalog-list" ...>` ya existente pasa a llevar `ref={containerRef}`), y actualizar el `.map` para pasar las props nuevas:

```jsx
                {filteredExercises.map((exercise) => {
                  const usedIn = sessionsUsingExercise(exercise.id, sessions);
                  return (
                    <ExerciseRow
                      containerRef={containerRef}
                      exercise={exercise}
                      key={exercise.id}
                      onOpenMenu={handleOpenMenu}
                      onShowUsage={(ex, u) => setUsageTarget({ exercise: ex, usedIn: u })}
                      usedIn={usedIn}
                    />
                  );
                })}
```

Y agregar, junto a los otros modales montados al final del `return`
(después de `CreateExerciseModal`, antes de `deleteTarget &&`):

```jsx
      <AnimatedDropdown
        anchorStyle={openMenu ? { left: openMenu.anchor.x, top: openMenu.anchor.y + openMenu.anchor.height + 4, width: 192 } : {}}
        onClose={handleCloseMenu}
        open={Boolean(openMenu)}
      >
        {openMenu && (
          <ExerciseActionsMenu
            exercise={openMenu.exercise}
            onClone={handleCloneOne}
            onDelete={(ex) => { handleCloseMenu(); setDeleteTarget({ exercise: ex, usedIn: sessionsUsingExercise(ex.id, sessions) }); }}
            onEdit={(ex) => { handleCloseMenu(); setModalExercise(ex); }}
          />
        )}
      </AnimatedDropdown>
```

`AnimatedDropdown` se posiciona `position: absolute` dentro de un `View`
`absolute inset-0` — para que `left`/`top` calculados relativos al
`containerRef` (la lista) tengan sentido, este bloque de
`AnimatedDropdown` tiene que estar dentro del mismo `View` padre que
envuelve a `containerRef` (el `<>` raíz de `ExercisesCatalogTab` ya
envuelve todo, así que no hace falta mover nada — solo confirmar en
preview que el panel aparece pegado al botón correcto, no en la esquina
superior izquierda de la pantalla).

- [ ] **Step 4: Verificar lint**

Run: `npx eslint components/plans/exercises-catalog-tab.jsx`
Expected: sin errores.

- [ ] **Step 5: Verificar en preview**

Con el dev server corriendo, ir al catálogo de ejercicios (pestaña
"Ejercicios" del entrenador). Confirmar: cada fila tiene un botón de
tres puntitos (ya no lápiz/tacho sueltos); al tocarlo aparece un menú
con Editar/Clonar/Eliminar, pegado al botón; Editar abre el modal de
edición como antes; Clonar agrega una fila nueva con "(copia)" en el
nombre; Eliminar abre el modal de confirmación de siempre.

- [ ] **Step 6: Commit**

```bash
git add components/plans/exercises-catalog-tab.jsx
git commit -m "feat(exercises): per-row three-dot menu (edit/clone/delete)"
```

---

### Task 4: Modo selección + esqueleto de la barra en bloque

**Files:**
- Modify: `components/plans/exercises-catalog-tab.jsx`

**Interfaces:**
- Consumes: `ExerciseRow`'s `selectionMode`/`selected`/`onToggleSelected` props (ya definidas en Task 3, sin usar todavía).
- Produces: `selectedIds` (Set de exercise ids, string) en el estado de `ExercisesCatalogTab` — Tasks 5, 6 y 7 lo consumen para saber sobre qué ejercicios actuar. `bulkMenuOpen`/`setBulkMenuOpen` — Tasks 5/6/7 lo cierran al terminar su acción.

- [ ] **Step 1: Agregar el estado de selección**

En `ExercisesCatalogTab`:

```js
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  const handleToggleSelectionMode = () => {
    setSelectionMode((v) => !v);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const handleToggleSelected = (exerciseId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId); else next.add(exerciseId);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };
```

- [ ] **Step 2: Cablear el header de la card**

Reemplazar el `headerRight` de la `SectionCard` (hoy solo el botón
"Crear ejercicio") para que muestre 3 estados posibles: normal
(Crear ejercicio + Seleccionar), modo selección sin nada marcado
(Cancelar), y con 1+ marcados (N seleccionados + menú):

```jsx
      <SectionCard
        headerRight={selectedIds.size > 0 ? (
          <View className="flex-row items-center gap-2" nativeID="exercises-catalog-bulk-bar" testID="exercises-catalog-bulk-bar">
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="exercises-catalog-bulk-count" testID="exercises-catalog-bulk-count">
              {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
            </Text>
            <Pressable
              nativeID="exercises-catalog-bulk-menu-toggle"
              onPress={() => setBulkMenuOpen((v) => !v)}
              testID="exercises-catalog-bulk-menu-toggle"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={20} />
            </Pressable>
          </View>
        ) : selectionMode ? (
          <Pressable
            className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
            nativeID="exercises-catalog-cancel-selection-button"
            onPress={handleToggleSelectionMode}
            testID="exercises-catalog-cancel-selection-button"
          >
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400" nativeID="exercises-catalog-cancel-selection-button-label" testID="exercises-catalog-cancel-selection-button-label">Cancelar</Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-3" nativeID="exercises-catalog-header-actions" testID="exercises-catalog-header-actions">
            <Pressable
              nativeID="exercises-catalog-select-button"
              onPress={handleToggleSelectionMode}
              testID="exercises-catalog-select-button"
            >
              <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400" nativeID="exercises-catalog-select-button-label" testID="exercises-catalog-select-button-label">Seleccionar</Text>
            </Pressable>
            <Pressable
              className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
              nativeID="exercises-catalog-create-button"
              onPress={() => setModalExercise(null)}
              testID="exercises-catalog-create-button"
            >
              <Text className="text-sm font-semibold text-primary" nativeID="exercises-catalog-create-button-label" testID="exercises-catalog-create-button-label">
                Crear ejercicio
              </Text>
            </Pressable>
          </View>
        )}
        icon="dumbbell"
        title="Tus ejercicios"
      >
```

- [ ] **Step 3: Pasar `selectionMode`/`selected`/`onToggleSelected` a cada fila**

En el `.map` de `filteredExercises`:

```jsx
                    <ExerciseRow
                      containerRef={containerRef}
                      exercise={exercise}
                      key={exercise.id}
                      onOpenMenu={handleOpenMenu}
                      onShowUsage={(ex, u) => setUsageTarget({ exercise: ex, usedIn: u })}
                      onToggleSelected={handleToggleSelected}
                      selected={selectedIds.has(exercise.id)}
                      selectionMode={selectionMode}
                      usedIn={usedIn}
                    />
```

- [ ] **Step 4: Menú en bloque (esqueleto, acciones reales en tasks 5/6/7)**

Agregar, junto al menú de fila ya montado al final del `return`:

```jsx
      <AnimatedDropdown
        anchorStyle={{ right: 16, top: 56 }}
        onClose={() => setBulkMenuOpen(false)}
        open={bulkMenuOpen}
      >
        {bulkMenuOpen && (
          <View className="w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="exercises-catalog-bulk-menu-panel" testID="exercises-catalog-bulk-menu-panel">
            {/* Adjuntar a sesión existente, Clonar, Eliminar — se agregan en los tasks 5/6/7 */}
          </View>
        )}
      </AnimatedDropdown>
```

- [ ] **Step 5: Verificar lint**

Run: `npx eslint components/plans/exercises-catalog-tab.jsx`
Expected: sin errores.

- [ ] **Step 6: Verificar en preview**

Tocar "Seleccionar" → aparecen checkboxes en cada fila y el menú de tres
puntitos por fila desaparece; marcar 2 → el header cambia a "2
seleccionados" + botón de tres puntitos (el panel abre vacío, se llena
en los próximos tasks); "Cancelar" limpia todo y vuelve al estado
normal.

- [ ] **Step 7: Commit**

```bash
git add components/plans/exercises-catalog-tab.jsx
git commit -m "feat(exercises): selection mode and bulk actions bar skeleton"
```

---

### Task 5: Acción en bloque — Clonar

**Files:**
- Modify: `components/plans/exercises-catalog-tab.jsx`

**Interfaces:**
- Consumes: `cloneExercise` (Task 1), `selectedIds`/`exitSelection` (Task 4).
- Produces: nada.

- [ ] **Step 1: Agregar el handler**

En `ExercisesCatalogTab`:

```js
  const handleBulkClone = async () => {
    setBulkMenuOpen(false);
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => cloneExercise({ ownerId: userId, exerciseId: id })));
    const failed = results.filter((r) => !r.success).length;
    exitSelection();
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunos ejercicios no se pudieron clonar', text2: `${failed} de ${ids.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: `${ids.length} ejercicio${ids.length === 1 ? '' : 's'} clonado${ids.length === 1 ? '' : 's'}` });
  };
```

- [ ] **Step 2: Agregar el ítem al menú en bloque**

Dentro del panel `exercises-catalog-bulk-menu-panel` (agregado en Task 4
como comentario placeholder), agregar:

```jsx
            <Pressable
              className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="exercises-catalog-bulk-clone"
              onPress={handleBulkClone}
              testID="exercises-catalog-bulk-clone"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="content-copy" size={16} />
              <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="exercises-catalog-bulk-clone-label" testID="exercises-catalog-bulk-clone-label">Clonar</Text>
            </Pressable>
```

- [ ] **Step 3: Verificar lint**

Run: `npx eslint components/plans/exercises-catalog-tab.jsx`
Expected: sin errores.

- [ ] **Step 4: Verificar en preview**

Seleccionar 2 ejercicios, abrir el menú en bloque, tocar "Clonar" —
aparecen 2 filas nuevas con "(copia)", toast de éxito, vuelve al estado
normal (sin selección).

- [ ] **Step 5: Commit**

```bash
git add components/plans/exercises-catalog-tab.jsx
git commit -m "feat(exercises): bulk clone action"
```

---

### Task 6: Acción en bloque — Eliminar (consciente de uso)

**Files:**
- Create: `components/plans/bulk-delete-exercises-modal.jsx`
- Modify: `components/plans/exercises-catalog-tab.jsx`

**Interfaces:**
- Consumes: `exercisesWithUsage` (Task 2), `deleteExercise` (ya existía), `selectedIds`/`exitSelection` (Task 4).
- Produces: `BulkDeleteExercisesModal` — componente nuevo, sin otros consumidores en este plan.

- [ ] **Step 1: Crear el modal**

`components/plans/bulk-delete-exercises-modal.jsx`, mismo lenguaje
visual que `delete-catalog-item-modal.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CheckboxField } from '../forms/checkbox-field.jsx';
import { notifyWarning } from '../../utils/haptics.js';

// Borrado en bloque de N ejercicios seleccionados — mismo criterio que
// DeleteCatalogItemModal (individual): si alguno está en uso en
// sesiones, se lista aparte y exige el mismo checkbox "entiendo" antes
// de habilitar "Eliminar". `items` = lista completa de ejercicios
// seleccionados (para el conteo/nombres); `withUsage` = el subconjunto
// que exercisesWithUsage() marcó como en uso.
export function BulkDeleteExercisesModal({ visible, items, withUsage, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const hasUsage = withUsage.length > 0;

  useEffect(() => {
    if (visible) { setUnderstood(false); notifyWarning(); }
  }, [visible]);

  const handleConfirm = async () => {
    if (loading || (hasUsage && !understood)) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal animationType="fade" nativeID="bulk-delete-exercises-modal" onRequestClose={handleCancel} testID="bulk-delete-exercises-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="bulk-delete-exercises-modal-backdrop" onPress={handleCancel} testID="bulk-delete-exercises-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="bulk-delete-exercises-modal-card" onPress={() => {}} testID="bulk-delete-exercises-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="bulk-delete-exercises-modal-header" testID="bulk-delete-exercises-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="bulk-delete-exercises-modal-title" testID="bulk-delete-exercises-modal-title">
              Eliminar {items.length} ejercicio{items.length === 1 ? '' : 's'}
            </Text>
          </View>

          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="bulk-delete-exercises-modal-description" testID="bulk-delete-exercises-modal-description">
            Esta acción no se puede deshacer.
          </Text>

          {hasUsage && (
            <View className="mb-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20" nativeID="bulk-delete-exercises-modal-usage" testID="bulk-delete-exercises-modal-usage">
              <Text className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-400" nativeID="bulk-delete-exercises-modal-usage-title" testID="bulk-delete-exercises-modal-usage-title">
                {withUsage.length} de estos están en uso en sesiones:
              </Text>
              <ScrollView className="max-h-28" nativeID="bulk-delete-exercises-modal-usage-list" showsVerticalScrollIndicator={false} testID="bulk-delete-exercises-modal-usage-list">
                {withUsage.map(({ exercise, usedIn }) => (
                  <Text className="text-xs text-amber-700 dark:text-amber-300" key={exercise.id} nativeID={`bulk-delete-exercises-modal-usage-item-${exercise.id}`} testID={`bulk-delete-exercises-modal-usage-item-${exercise.id}`}>
                    • {exercise.name} ({usedIn.length} {usedIn.length === 1 ? 'sesión' : 'sesiones'})
                  </Text>
                ))}
              </ScrollView>
              <CheckboxField checked={understood} idPrefix="bulk-delete-exercises-modal-checkbox" onChange={setUnderstood}>
                <Text className="text-xs text-amber-800 dark:text-amber-300" nativeID="bulk-delete-exercises-modal-checkbox-label" testID="bulk-delete-exercises-modal-checkbox-label">
                  Entiendo que van a dejar de estar en esas sesiones.
                </Text>
              </CheckboxField>
            </View>
          )}

          <View className="flex-row gap-3" nativeID="bulk-delete-exercises-modal-actions" testID="bulk-delete-exercises-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="bulk-delete-exercises-modal-cancel-button"
              onPress={handleCancel}
              testID="bulk-delete-exercises-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="bulk-delete-exercises-modal-cancel-label" testID="bulk-delete-exercises-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={loading || (hasUsage && !understood)}
              nativeID="bulk-delete-exercises-modal-confirm-button"
              onPress={handleConfirm}
              testID="bulk-delete-exercises-modal-confirm-button"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="bulk-delete-exercises-modal-confirm-label" testID="bulk-delete-exercises-modal-confirm-label">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Cablear en `exercises-catalog-tab.jsx`**

Agregar el import y el estado:

```js
import { BulkDeleteExercisesModal } from './bulk-delete-exercises-modal.jsx';
```

```js
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => deleteExercise({ ownerId: userId, exerciseId: id })));
    const failed = results.filter((r) => !r.success).length;
    setBulkDeleteVisible(false);
    exitSelection();
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunos ejercicios no se pudieron eliminar', text2: `${failed} de ${ids.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: `${ids.length} ejercicio${ids.length === 1 ? '' : 's'} eliminado${ids.length === 1 ? '' : 's'}` });
  };
```

Agregar el ítem al menú en bloque:

```jsx
            <Pressable
              className="flex-row items-center gap-2 px-3 py-2 hover:bg-red-50 active:opacity-70 dark:hover:bg-red-900/20"
              nativeID="exercises-catalog-bulk-delete"
              onPress={() => { setBulkMenuOpen(false); setBulkDeleteVisible(true); }}
              testID="exercises-catalog-bulk-delete"
            >
              <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
              <Text className="text-sm text-red-600 dark:text-red-400" nativeID="exercises-catalog-bulk-delete-label" testID="exercises-catalog-bulk-delete-label">Eliminar</Text>
            </Pressable>
```

Y montar el modal, junto a los demás modales del `return`:

```jsx
      <BulkDeleteExercisesModal
        items={Array.from(selectedIds)}
        onCancel={() => setBulkDeleteVisible(false)}
        onConfirm={handleBulkDelete}
        visible={bulkDeleteVisible}
        withUsage={exercisesWithUsage(Array.from(selectedIds), exercises, sessions)}
      />
```

- [ ] **Step 3: Verificar lint**

Run: `npx eslint components/plans/exercises-catalog-tab.jsx components/plans/bulk-delete-exercises-modal.jsx`
Expected: sin errores.

- [ ] **Step 4: Verificar en preview**

Seleccionar 1 ejercicio SIN uso + 1 CON uso (usar el link "Usado en N
sesiones" de la lista normal para identificar cuál tiene uso antes de
entrar en modo selección) → Eliminar en bloque → el modal muestra el
bloque ámbar solo para el que tiene uso, botón deshabilitado hasta
tildar el checkbox, confirmar borra los 2.

- [ ] **Step 5: Commit**

```bash
git add components/plans/bulk-delete-exercises-modal.jsx components/plans/exercises-catalog-tab.jsx
git commit -m "feat(exercises): bulk delete action with usage awareness"
```

---

### Task 7: Acción en bloque — Adjuntar a sesión existente

**Files:**
- Create: `components/plans/attach-to-session-picker.jsx`
- Modify: `components/plans/exercises-catalog-tab.jsx`

**Interfaces:**
- Consumes: `mergeSessionExercises` (Task 2), `updateSession` de `useSessionMutations()` (ya existente en `hooks/use-sessions.js`), `selectedIds`/`exitSelection` (Task 4).
- Produces: `AttachToSessionPicker` — sin otros consumidores en este plan.

- [ ] **Step 1: Crear el picker**

`components/plans/attach-to-session-picker.jsx`:

```jsx
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Elegir una sesión existente para adjuntarle los ejercicios
// seleccionados del catálogo — append inmediato, sin abrir el modal de
// edición de esa sesión (ver spec para el porqué: es una acción rápida,
// el rol/orden se ajusta después si hace falta).
export function AttachToSessionPicker({ visible, sessions, onClose, onConfirm }) {
  const colors = useThemeColors();
  const [sessionId, setSessionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setSessionId('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    await onConfirm(sessionId);
    setSubmitting(false);
    setSessionId('');
  };

  return (
    <Modal animationType="fade" nativeID="attach-to-session-picker" onRequestClose={handleClose} testID="attach-to-session-picker" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="attach-to-session-picker-backdrop" onPress={handleClose} testID="attach-to-session-picker-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="attach-to-session-picker-card" onPress={() => {}} testID="attach-to-session-picker-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="attach-to-session-picker-header" testID="attach-to-session-picker-header">
            <MaterialCommunityIcons color={colors.primary} name="clipboard-plus-outline" size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="attach-to-session-picker-title" testID="attach-to-session-picker-title">
              Adjuntar a sesión existente
            </Text>
          </View>

          <ResponsiveSelectField
            dense
            hideErrorRow
            label="Sesión"
            onChange={setSessionId}
            options={sessions.map((s) => ({ id: s.id, name: s.name }))}
            placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
            required
            value={sessionId}
          />

          <View className="mt-3 flex-row gap-3" nativeID="attach-to-session-picker-actions" testID="attach-to-session-picker-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={submitting}
              nativeID="attach-to-session-picker-cancel-button"
              onPress={handleClose}
              testID="attach-to-session-picker-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="attach-to-session-picker-cancel-label" testID="attach-to-session-picker-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={submitting || !sessionId}
              nativeID="attach-to-session-picker-confirm-button"
              onPress={handleConfirm}
              testID="attach-to-session-picker-confirm-button"
            >
              {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="attach-to-session-picker-confirm-label" testID="attach-to-session-picker-confirm-label">
                  Adjuntar
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Cablear en `exercises-catalog-tab.jsx`**

Agregar imports:

```js
import { useSessions, useSessionMutations } from '../../hooks/use-sessions.js';
import { mergeSessionExercises } from '../../services/normalizers.js';
import { AttachToSessionPicker } from './attach-to-session-picker.jsx';
```

(`useSessions` ya estaba importado — sumar `useSessionMutations` a esa
misma línea.)

Agregar estado y handler:

```js
  const { updateSession } = useSessionMutations();
  const [attachPickerVisible, setAttachPickerVisible] = useState(false);

  const handleAttachToSession = async (sessionId) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    const result = await updateSession({
      ownerId: userId,
      sessionId,
      form: {
        name: targetSession.name,
        description: targetSession.description,
        exercises: mergeSessionExercises(targetSession, Array.from(selectedIds)),
      },
    });
    setAttachPickerVisible(false);
    exitSelection();
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos adjuntar los ejercicios', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: `Ejercicios agregados a "${targetSession.name}"` });
  };
```

Agregar el ítem al menú en bloque:

```jsx
            <Pressable
              className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="exercises-catalog-bulk-attach"
              onPress={() => { setBulkMenuOpen(false); setAttachPickerVisible(true); }}
              testID="exercises-catalog-bulk-attach"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-plus-outline" size={16} />
              <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="exercises-catalog-bulk-attach-label" testID="exercises-catalog-bulk-attach-label">Adjuntar a sesión existente</Text>
            </Pressable>
```

Y montar el picker:

```jsx
      <AttachToSessionPicker
        onClose={() => setAttachPickerVisible(false)}
        onConfirm={handleAttachToSession}
        sessions={sessions}
        visible={attachPickerVisible}
      />
```

- [ ] **Step 3: Verificar lint y test completos**

Run: `npx eslint components/plans/exercises-catalog-tab.jsx components/plans/attach-to-session-picker.jsx && npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 4: Verificar en preview**

Seleccionar 2 ejercicios, "Adjuntar a sesión existente", elegir una
sesión, confirmar — toast de éxito con el nombre de la sesión. Ir al
catálogo de sesiones, abrir esa sesión para editar, confirmar que los 2
ejercicios aparecen al final de la lista con rol "principal".

- [ ] **Step 5: Commit**

```bash
git add components/plans/attach-to-session-picker.jsx components/plans/exercises-catalog-tab.jsx
git commit -m "feat(exercises): bulk attach-to-existing-session action"
```

---

### Task 8: Barrido final y version bump

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada — último task de este plan (sub-proyecto 1 de 3; los
  otros 2 planes de la misma rama tienen su propio bump al final).

- [ ] **Step 1: Bump de versión**

Confirmar el valor actual de `"version"` en `package.json` e
incrementar un **minor** (feature visible con varias acciones nuevas,
no un fix puntual).

- [ ] **Step 2: Suite completa**

Run: `npm test`
Expected: todos los tests pasan, incluidos los nuevos de los tasks
1 y 2.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Barrido de preview**

Repetir en una sola pasada: seleccionar/cancelar, menú por fila
(editar/clonar/eliminar), las 3 acciones en bloque (adjuntar/clonar/eliminar)
sobre una selección de 2+.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: version bump for exercises multi-select and context menu"
```
