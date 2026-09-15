# Sesiones: modal ensanchado + panel de ejercicios con drag-and-drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En web ancho, `create-session-modal.jsx` se ensancha a 2 columnas — la sesión a la izquierda, un panel con el catálogo de ejercicios a la derecha del que se arrastran tarjetas para agregarlas a la sesión. Reordenar usa botones subir/bajar (no drag). Mobile/web angosto no cambia. Se suma `cloneSession` y un menú de tres puntitos (Editar/Clonar/Eliminar) al catálogo de sesiones.

**Architecture:** Drag-and-drop a mano con `react-native-gesture-handler`/`react-native-reanimated` (ya instalados) — sin librería nueva (ver spec para por qué se descartó `react-native-drax`). Un contexto de React (`SessionDragProvider`) comparte el estado del arrastre en curso entre el panel (fuente) y la lista de la sesión (destino), con un overlay `absolute inset-0` de pantalla completa para el "fantasma" que sigue al dedo/cursor — evita problemas de recorte al cruzar de una columna a la otra.

**Tech Stack:** React Native + React Native Web, `react-native-gesture-handler` (`~2.28.0`), `react-native-reanimated` (`~4.1.0`), TanStack Query.

**Spec:** `docs/superpowers/specs/2026-09-10-sessions-drag-and-drop-design.md`

## Global Constraints

- Sin librerías de drag-and-drop de terceros — solo gesture-handler/reanimated ya instalados.
- Mobile/web angosto (`isWeb && !isNarrowWeb` es `false`) no cambia de comportamiento en absoluto respecto a hoy.
- Reordenar usa botones subir/bajar, no drag.
- Todo elemento visual nuevo lleva `nativeID`/`testID` únicos.
- Sin tests de componente (convención del repo) — solo lógica pura lleva test real.
- `npm test` y `npm run lint` en verde antes de cada commit.

---

### Task 1: Prerrequisito — confirmar `GestureHandlerRootView`

**Files:**
- Modify: `app/_layout.jsx` (solo si el smoke test falla)

**Interfaces:**
- Consumes: nada.
- Produces: gestos de `react-native-gesture-handler` funcionando de forma confiable en toda la app — todos los tasks siguientes (5, 6, 7) dependen de esto.

- [ ] **Step 1: Agregar un gesto de prueba temporal**

En cualquier pantalla ya montada (por ejemplo, al final de
`app/(tabs)/index.web.jsx`, dentro de `HomeScreenWeb`, temporalmente
solo para esta verificación), agregar:

```jsx
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

function DebugDragSquare() {
  const x = useSharedValue(0);
  const pan = Gesture.Pan().onUpdate((e) => { x.value = e.translationX; });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ width: 60, height: 60, backgroundColor: 'red' }, style]} />
    </GestureDetector>
  );
}
```

Y renderizarlo temporalmente en algún punto visible del árbol (ej.
antes del `return` principal de `HomeScreenWeb`, envuelto en un `<View
style={{position:'absolute', top: 100, left: 100, zIndex: 999}}><DebugDragSquare /></View>`).

- [ ] **Step 2: Verificar en preview**

Con el dev server corriendo, ir a `/` con sesión iniciada (donde se
montó el cuadrado de prueba). Arrastrar el cuadrado rojo con el mouse.

**Si el cuadrado sigue al cursor**: gestos ya funcionan sin
wrapper adicional — ir directo al Step 4 (limpiar) sin tocar
`app/_layout.jsx`.

**Si el cuadrado NO se mueve** (o el gesto no responde): continuar al
Step 3.

- [ ] **Step 3: Envolver la app en `GestureHandlerRootView` (solo si el Step 2 falló)**

En `app/_layout.jsx`, agregar el import:

```js
import { GestureHandlerRootView } from 'react-native-gesture-handler';
```

Y envolver el `return` de `RootLayout`:

```jsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AppProviders>
            <StackNavigator />
            <RoleSwitchOverlay />
            <Toast config={toastConfig} topOffset={56} />
          </AppProviders>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
```

Repetir el Step 2 para confirmar que ahora sí funciona.

- [ ] **Step 4: Sacar el código de prueba**

Borrar `DebugDragSquare` y su uso de donde se haya montado
temporalmente — no debe quedar rastro en el commit.

- [ ] **Step 5: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 6: Commit**

Si el Step 3 fue necesario:

```bash
git add app/_layout.jsx
git commit -m "fix(app): wrap root in GestureHandlerRootView for drag gestures"
```

Si el Step 2 ya funcionó sin cambios, no hay nada que commitear en este
task — pasar directo al Task 2.

---

### Task 2: `cloneSession` en mock, servicio y hook

**Files:**
- Modify: `services/__mocks__/sessions-mock.js`
- Modify: `services/sessions.js`
- Modify: `hooks/use-sessions.js`
- Test: `__tests__/sessions-mock.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `cloneSession: ({ ownerId, sessionId }) => Promise<{success, session?, error?}>` en `useSessionMutations()` — consumida por Task 3.

- [ ] **Step 1: Leer la forma real del mock antes de escribir el test**

Antes de escribir nada, correr:

```bash
sed -n '1,40p' services/__mocks__/sessions-mock.js
```

para confirmar los nombres exactos de la función de lookup-por-id
(equivalente a `findExerciseOrThrow`), el array in-memory (equivalente
a `mockExercises`) y el contador de ids (equivalente a `nextId`) en
este archivo — pueden no llamarse igual que en `exercises-mock.js`. Usar
esos nombres reales en los steps siguientes.

- [ ] **Step 2: Escribir el test que falla**

Agregar a `__tests__/sessions-mock.test.js` (al import existente,
agregar `mockCloneSession`; al final del `describe` existente, agregar):

```js
  test('mockCloneSession clona con id nuevo, nombre con sufijo "(copia)" y copia profunda de exercises', async () => {
    const original = await mockGetSession(1);
    const clone = await mockCloneSession(1);
    expect(clone.id).not.toBe(original.id);
    expect(clone.name).toBe(`${original.name} (copia)`);
    expect(clone.exercises).toEqual(original.exercises);

    // Deep copy real — mutar el clon no toca el original.
    clone.exercises[0].role = 'cooldown';
    const originalAfter = await mockGetSession(1);
    expect(originalAfter.exercises[0].role).not.toBe('cooldown');
  });

  test('mockCloneSession tira 404-like si el id no existe', async () => {
    await expect(mockCloneSession(9999)).rejects.toThrow();
  });
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx jest sessions-mock -t "mockCloneSession"`
Expected: FAIL — `mockCloneSession is not a function`.

- [ ] **Step 4: Implementar `mockCloneSession`**

En `services/__mocks__/sessions-mock.js`, agregar (usando los nombres
reales confirmados en el Step 1 de este task — el bloque de abajo usa
los mismos nombres que `exercises-mock.js` como referencia, ajustar si
difieren):

```js
// Copia con sufijo "(copia)" y deep-copy de exercises — mismo criterio
// que mockCloneExercise/mockCloneTrainingPlan. No hereda uso en planes
// (un plan que referencia la sesión original sigue apuntando a esa, no
// al clon).
export async function mockCloneSession(sessionId) {
  const original = findSessionOrThrow(sessionId);
  const now = new Date().toISOString();
  const clone = {
    ...original,
    id: nextId++,
    name: `${original.name} (copia)`,
    exercises: JSON.parse(JSON.stringify(original.exercises)),
    created_at: now,
    updated_at: now,
  };
  mockSessions.push(clone);
  return clone;
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx jest sessions-mock -t "mockCloneSession"`
Expected: PASS (2 tests).

- [ ] **Step 6: Agregar la función de servicio**

En `services/sessions.js`, agregar el import de `mockCloneSession` y:

```js
// POST /api/v1/sessions/{id}/clone.
export async function cloneSession(sessionId) {
  if (USE_MOCKS || FORCE_MOCKS) return await mockCloneSession(sessionId);
  return await api.post(`/sessions/${sessionId}/clone`);
}
```

- [ ] **Step 7: Agregar la mutación al hook**

En `hooks/use-sessions.js`, agregar `cloneSession as
cloneSessionService` al import, y dentro de `useSessionMutations()`
(después de `deleteSessionMutation`):

```js
  const cloneSessionMutation = useMutation({
    mutationFn: async ({ sessionId }) => {
      try {
        const cloned = await cloneSessionService(sessionId);
        return { success: true, session: toSessionModel(cloned) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });
```

Y en el `return`:

```js
    cloneSession: cloneSessionMutation.mutateAsync,
    isCloning: cloneSessionMutation.isPending,
```

- [ ] **Step 8: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 9: Commit**

```bash
git add services/__mocks__/sessions-mock.js services/sessions.js hooks/use-sessions.js __tests__/sessions-mock.test.js
git commit -m "feat(sessions): add cloneSession mutation (mock, service, hook)"
```

---

### Task 3: Menú de tres puntitos en `sessions-catalog-tab.jsx`

**Files:**
- Modify: `components/plans/sessions-catalog-tab.jsx`

**Interfaces:**
- Consumes: `cloneSession` (Task 2).
- Produces: nada.

- [ ] **Step 1: Imports nuevos**

```js
import { useRef, useState } from 'react';
```

(reemplaza el `import { useEffect, useState } from 'react';` actual —
agregar `useRef` a esa misma línea, dejando `useEffect` también, ya que
sigue en uso para `fetchPlans`.)

```js
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
```

- [ ] **Step 2: `SessionMenuButton`/`SessionActionsMenu` — mismo patrón que `ExerciseMenuButton`/`ExerciseActionsMenu` (sub-proyecto de ejercicios)**

Agregar antes de `SessionRow`:

```jsx
function SessionMenuButton({ session, onOpenMenu, containerRef }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, session);
      });
    });
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel="Más opciones"
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={`session-catalog-row-${session.id}-menu-toggle`}
      onPress={handlePress}
      testID={`session-catalog-row-${session.id}-menu-toggle`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
    </Pressable>
  );
}

function SessionActionsMenu({ session, onEdit, onClone, onDelete }) {
  const colors = useThemeColors();

  return (
    <View className="w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="session-catalog-menu-panel" testID="session-catalog-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="session-catalog-menu-edit"
        onPress={() => onEdit(session)}
        testID="session-catalog-menu-edit"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="session-catalog-menu-edit-label" testID="session-catalog-menu-edit-label">Editar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="session-catalog-menu-clone"
        onPress={() => onClone(session)}
        testID="session-catalog-menu-clone"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="content-copy" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="session-catalog-menu-clone-label" testID="session-catalog-menu-clone-label">Clonar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="session-catalog-menu-delete"
        onPress={() => onDelete(session)}
        testID="session-catalog-menu-delete"
      >
        <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
        <Text className="text-sm text-red-600 dark:text-red-400" nativeID="session-catalog-menu-delete-label" testID="session-catalog-menu-delete-label">Eliminar</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: `SessionRow` — reemplazar los 2 `Pressable` sueltos**

Reemplazar (líneas 22-58 actuales, dentro de `SessionRow`) el bloque de
`onEdit`/`onDelete` sueltos por el botón único:

```jsx
function SessionRow({ session, usedIn, onOpenMenu, onShowUsage, containerRef }) {
  const idPrefix = `session-catalog-row-${session.id}`;

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-3" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
            {session.name}
          </Text>
          {session.description?.trim() ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-description`} numberOfLines={1} testID={`${idPrefix}-description`}>
              {session.description}
            </Text>
          ) : null}
        </View>
        <Pressable
          disabled={usedIn.length === 0}
          nativeID={`${idPrefix}-usage-button`}
          onPress={() => onShowUsage(session, usedIn)}
          testID={`${idPrefix}-usage-button`}
        >
          <Text className={`text-xs ${usedIn.length > 0 ? 'font-semibold text-primary underline' : 'text-slate-400 dark:text-slate-500'}`} nativeID={`${idPrefix}-usage-label`} testID={`${idPrefix}-usage-label`}>
            Usado en {usedIn.length} {usedIn.length === 1 ? 'plan' : 'planes'}
          </Text>
        </Pressable>
        <SessionMenuButton containerRef={containerRef} onOpenMenu={onOpenMenu} session={session} />
      </View>
      <SessionExercisesPreview session={session} />
    </View>
  );
}
```

- [ ] **Step 4: Cablear el estado del menú en `SessionsCatalogTab`**

Agregar:

```js
  const { deleteSession, cloneSession } = useSessionMutations();
  const containerRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);

  const handleOpenMenu = (anchor, session) => setOpenMenu({ anchor, session });
  const handleCloseMenu = () => setOpenMenu(null);

  const handleCloneOne = async (session) => {
    handleCloseMenu();
    const result = await cloneSession({ ownerId: userId, sessionId: session.id });
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos clonar la sesión', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Sesión clonada' });
  };
```

(`deleteSession` ya estaba desestructurado de `useSessionMutations()` —
sumar `cloneSession` a esa línea.)

Agregar `ref={containerRef}` al `<View className="gap-2"
nativeID="sessions-catalog-list" ...>` existente, y actualizar el
`.map`:

```jsx
            {sessions.map((session) => {
              const usedIn = plansUsingSession(session.id, plans);
              return (
                <SessionRow
                  containerRef={containerRef}
                  key={session.id}
                  onOpenMenu={handleOpenMenu}
                  onShowUsage={(s, u) => setUsageTarget({ session: s, usedIn: u })}
                  session={session}
                  usedIn={usedIn}
                />
              );
            })}
```

Y montar el menú, junto a los demás modales del `return`:

```jsx
      <AnimatedDropdown
        anchorStyle={openMenu ? { left: openMenu.anchor.x, top: openMenu.anchor.y + openMenu.anchor.height + 4, width: 192 } : {}}
        onClose={handleCloseMenu}
        open={Boolean(openMenu)}
      >
        {openMenu && (
          <SessionActionsMenu
            onClone={handleCloneOne}
            onDelete={(s) => { handleCloseMenu(); setDeleteTarget({ session: s, usedIn: plansUsingSession(s.id, plans) }); }}
            onEdit={(s) => { handleCloseMenu(); setModalSession(s); }}
            session={openMenu.session}
          />
        )}
      </AnimatedDropdown>
```

- [ ] **Step 5: Verificar lint**

Run: `npx eslint components/plans/sessions-catalog-tab.jsx`
Expected: sin errores.

- [ ] **Step 6: Verificar en preview**

Catálogo de sesiones: cada fila con botón de tres puntitos; Editar
abre el modal de edición; Clonar agrega "(copia)"; Eliminar abre el
modal de siempre.

- [ ] **Step 7: Commit**

```bash
git add components/plans/sessions-catalog-tab.jsx
git commit -m "feat(sessions): per-row three-dot menu (edit/clone/delete)"
```

---

### Task 4: Botones subir/bajar en `SessionExerciseRow`

**Files:**
- Modify: `components/plans/create-session-modal.jsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `handleMoveExercise(localKey, direction)` — sin otros consumidores en este plan (se cablea al mismo tiempo que se define, en este task).

- [ ] **Step 1: Agregar el handler en `CreateSessionModal`**

Junto a `handleRemoveExercise` (línea 247 actual):

```js
  // Intercambia la fila con su vecina inmediata en la dirección dada
  // (-1 = subir, +1 = bajar) — sin efecto si ya está en la punta (la UI
  // ya deshabilita el botón ahí, esto es la defensa del lado de la
  // función).
  const handleMoveExercise = (localKey, direction) => {
    setExercises((rows) => {
      const index = rows.findIndex((r) => r.localKey === localKey);
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };
```

- [ ] **Step 2: Agregar los botones a `SessionExerciseRow`**

Cambiar la firma (línea 67 actual) para recibir `totalCount`/`onMove`:

```jsx
function SessionExerciseRow({ idPrefix, entry, index, totalCount, catalogExercises, onChangeExercise, onChangeRole, onRemove, onMove }) {
```

En el `View` de `${idPrefix}-fields` (línea 79-104 actuales), agregar
los 2 botones nuevos entre el select de ejercicio y el botón de quitar:

```jsx
        <Pressable
          accessibilityLabel="Subir ejercicio"
          className="h-12 w-9 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-30 dark:border-slate-700"
          disabled={index === 0}
          nativeID={`${idPrefix}-move-up-button`}
          onPress={() => onMove(entry.localKey, -1)}
          testID={`${idPrefix}-move-up-button`}
        >
          <MaterialCommunityIcons color="#94a3b8" name="chevron-up" size={18} />
        </Pressable>
        <Pressable
          accessibilityLabel="Bajar ejercicio"
          className="h-12 w-9 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-30 dark:border-slate-700"
          disabled={index === totalCount - 1}
          nativeID={`${idPrefix}-move-down-button`}
          onPress={() => onMove(entry.localKey, 1)}
          testID={`${idPrefix}-move-down-button`}
        >
          <MaterialCommunityIcons color="#94a3b8" name="chevron-down" size={18} />
        </Pressable>
```

(Insertar inmediatamente antes del `Pressable` de
`${idPrefix}-remove-button` ya existente, dentro del mismo `View`
`${idPrefix}-fields`.)

- [ ] **Step 3: Pasar las props nuevas desde el `.map`**

En el bloque `create-session-modal-exercises-list` (línea 317-330
actuales):

```jsx
                {exercises.map((entry, index) => (
                  <SessionExerciseRow
                    catalogExercises={catalogExercises}
                    entry={entry}
                    idPrefix={`create-session-modal-exercise-row-${entry.localKey}`}
                    index={index}
                    key={entry.localKey}
                    onChangeExercise={handleChangeExercise}
                    onChangeRole={handleChangeRole}
                    onMove={handleMoveExercise}
                    onRemove={handleRemoveExercise}
                    totalCount={exercises.length}
                  />
                ))}
```

- [ ] **Step 4: Verificar lint**

Run: `npx eslint components/plans/create-session-modal.jsx`
Expected: sin errores.

- [ ] **Step 5: Verificar en preview**

Abrir "Nueva sesión", agregar 3 ejercicios (flujo de hoy, botón "+
Agregar ejercicio"), confirmar que cada fila tiene flechas
arriba/abajo, que la primera tiene la de subir deshabilitada, la
última la de bajar, y que tocar las flechas reordena visualmente.

- [ ] **Step 6: Commit**

```bash
git add components/plans/create-session-modal.jsx
git commit -m "feat(sessions): up/down move buttons to reorder session exercises"
```

---

### Task 5: Mecánica de arrastre — `session-drag-and-drop.jsx`

**Files:**
- Create: `components/plans/session-drag-and-drop.jsx`

**Interfaces:**
- Consumes: `GestureHandlerRootView` funcionando (Task 1).
- Produces: `SessionDragProvider` (componente wrapper), `DraggableExerciseCard` (componente), `useSessionDropTarget()` (hook que expone `dropTargetRef`, para que `create-session-modal.jsx` registre el contenedor de la lista de la sesión) — consumidos por Task 6 (`DraggableExerciseCard`) y Task 7 (`SessionDragProvider`, `useSessionDropTarget`).

- [ ] **Step 1: Crear el archivo completo**

```jsx
import { createContext, useContext, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

// Mecánica de arrastre a mano (sin librería de terceros — ver
// docs/superpowers/specs/2026-09-10-sessions-drag-and-drop-design.md
// para el porqué). Estado compartido entre el panel de ejercicios
// (fuente) y la lista de la sesión (destino), vive y muere con el
// modal — no es estado global de la app.
const SessionDragContext = createContext(null);

export function SessionDragProvider({ children }) {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const [draggedExercise, setDraggedExercise] = useState(null);
  const dropTargetRef = useRef(null);

  return (
    <SessionDragContext.Provider value={{ dragX, dragY, draggedExercise, setDraggedExercise, dropTargetRef }}>
      {children}
      <DragGhost />
    </SessionDragContext.Provider>
  );
}

// El contenedor de la lista de la sesión (destino del drop) se registra
// acá — measureInWindow se usa recién al soltar, así que no hace falta
// re-medir en cada frame del arrastre.
export function useSessionDropTarget() {
  const { dropTargetRef } = useContext(SessionDragContext);
  return dropTargetRef;
}

// Tarjeta arrastrable del panel de ejercicios. `onDropped(exercise)` se
// llama solo si el punto de soltado cae dentro del contenedor
// registrado en dropTargetRef.
export function DraggableExerciseCard({ exercise, onDropped, children }) {
  const { dragX, dragY, setDraggedExercise, dropTargetRef } = useContext(SessionDragContext);

  const checkDrop = (absoluteX, absoluteY) => {
    if (!dropTargetRef.current) return;
    dropTargetRef.current.measureInWindow((x, y, width, height) => {
      const inside = absoluteX >= x && absoluteX <= x + width && absoluteY >= y && absoluteY <= y + height;
      if (inside) onDropped(exercise);
    });
  };

  const pan = Gesture.Pan()
    .onStart((e) => {
      runOnJS(setDraggedExercise)(exercise);
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
    })
    .onUpdate((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
    })
    .onEnd((e) => {
      runOnJS(checkDrop)(e.absoluteX, e.absoluteY);
      runOnJS(setDraggedExercise)(null);
    });

  return (
    <GestureDetector gesture={pan}>
      <View nativeID={`draggable-exercise-card-${exercise.id}`} testID={`draggable-exercise-card-${exercise.id}`}>
        {children}
      </View>
    </GestureDetector>
  );
}

// Overlay de pantalla completa que sigue al dedo/cursor mientras hay un
// arrastre en curso — vive en un solo lugar (montado una vez por
// SessionDragProvider) para que el "fantasma" pueda visualmente cruzar
// de la columna del panel a la columna de la sesión sin quedar
// recortado por el overflow de ninguna de las 2 (mismo problema que ya
// resuelve el patrón absolute-inset-0 de components/shared/animated-dropdown.jsx).
function DragGhost() {
  const { dragX, dragY, draggedExercise } = useContext(SessionDragContext);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - 90 }, { translateY: dragY.value - 24 }],
  }));

  if (!draggedExercise) return null;
  return (
    <View className="absolute inset-0 z-50" nativeID="session-drag-ghost-overlay" style={{ pointerEvents: 'none' }} testID="session-drag-ghost-overlay">
      <Animated.View
        className="w-44 rounded-xl border border-primary bg-white px-3 py-2 opacity-90 shadow-lg dark:bg-surface"
        nativeID="session-drag-ghost-card"
        style={[{ position: 'absolute' }, style]}
        testID="session-drag-ghost-card"
      >
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="session-drag-ghost-card-label" numberOfLines={1} testID="session-drag-ghost-card-label">
          {draggedExercise.name}
        </Text>
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/plans/session-drag-and-drop.jsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/plans/session-drag-and-drop.jsx
git commit -m "feat(sessions): hand-rolled drag-and-drop primitives (provider, draggable card, ghost overlay)"
```

---

### Task 6: `SessionExercisePanel`

**Files:**
- Create: `components/plans/session-exercise-panel.jsx`

**Interfaces:**
- Consumes: `DraggableExerciseCard` (Task 5).
- Produces: `SessionExercisePanel({ onExerciseAdded })` — consumida por Task 7.

- [ ] **Step 1: Crear el archivo completo**

```jsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { FIELD_LABEL } from '../forms/fields.jsx';
import { EXERCISE_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';
import { CreateExerciseModal } from './create-exercise-modal.jsx';
import { DraggableExerciseCard } from './session-drag-and-drop.jsx';

// Mini-catálogo embebido en el modal de sesión (columna derecha, solo
// web ancho) — mismo criterio visual que exercises-catalog-tab.jsx,
// sin acciones de editar/eliminar (esto no es el catálogo real, es un
// selector para arrastrar a la sesión).
function PanelExerciseCard({ exercise }) {
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const statLine = buildExerciseStatLine(exercise);
  const idPrefix = `session-exercise-panel-card-${exercise.id}`;

  return (
    <View className="mb-2 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className={`h-8 w-8 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={16} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {exercise.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} numberOfLines={1} testID={`${idPrefix}-stat`}>
          {statLine || meta.label}
        </Text>
      </View>
    </View>
  );
}

export function SessionExercisePanel({ onExerciseAdded }) {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises } = useExercises(userId);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const query = search.trim().toLowerCase();
  const filtered = query ? exercises.filter((e) => e.name.toLowerCase().includes(query)) : exercises;

  return (
    <View className="flex-1" nativeID="session-exercise-panel" testID="session-exercise-panel">
      <View className="mb-2 flex-row items-center justify-between" nativeID="session-exercise-panel-header" testID="session-exercise-panel-header">
        <Text className={FIELD_LABEL} nativeID="session-exercise-panel-header-label" testID="session-exercise-panel-header-label">Catálogo de ejercicios</Text>
        <Pressable
          nativeID="session-exercise-panel-create-button"
          onPress={() => setShowCreateModal(true)}
          testID="session-exercise-panel-create-button"
        >
          <Text className="text-sm font-semibold text-primary" nativeID="session-exercise-panel-create-button-label" testID="session-exercise-panel-create-button-label">
            + Crear ejercicio
          </Text>
        </Pressable>
      </View>

      <View className="mb-3 h-10 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900" nativeID="session-exercise-panel-search-row" testID="session-exercise-panel-search-row">
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={16} />
        <TextInput
          className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
          nativeID="session-exercise-panel-search-input"
          onChangeText={setSearch}
          placeholder="Buscar ejercicio"
          placeholderTextColor={colors.onSurfaceVariant}
          testID="session-exercise-panel-search-input"
          value={search}
        />
      </View>

      <ScrollView nativeID="session-exercise-panel-list" showsVerticalScrollIndicator={false} testID="session-exercise-panel-list">
        {filtered.length === 0 ? (
          <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="session-exercise-panel-empty" testID="session-exercise-panel-empty">
            Ningún ejercicio coincide.
          </Text>
        ) : (
          filtered.map((exercise) => (
            <DraggableExerciseCard exercise={exercise} key={exercise.id} onDropped={onExerciseAdded}>
              <PanelExerciseCard exercise={exercise} />
            </DraggableExerciseCard>
          ))
        )}
      </ScrollView>

      <CreateExerciseModal onClose={() => setShowCreateModal(false)} onCreated={() => setShowCreateModal(false)} visible={showCreateModal} />
    </View>
  );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint components/plans/session-exercise-panel.jsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/plans/session-exercise-panel.jsx
git commit -m "feat(sessions): draggable exercise catalog panel"
```

---

### Task 7: Cablear el layout ancho en `create-session-modal.jsx`

**Files:**
- Modify: `components/plans/create-session-modal.jsx`

**Interfaces:**
- Consumes: `SessionDragProvider`, `useSessionDropTarget`, (Task 5), `SessionExercisePanel` (Task 6).
- Produces: nada — último task de integración de este sub-proyecto.

- [ ] **Step 1: Imports nuevos**

```js
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { SessionDragProvider, useSessionDropTarget } from './session-drag-and-drop.jsx';
import { SessionExercisePanel } from './session-exercise-panel.jsx';
```

- [ ] **Step 2: Detectar el layout ancho**

Dentro de `CreateSessionModal`, junto a las demás variables derivadas
(después de `const isEditing = Boolean(session);`):

```js
  const isNarrowWeb = useIsNarrowWeb();
  const isWideLayout = isWeb && !isNarrowWeb;
```

- [ ] **Step 3: Ensanchar el card del modal solo en layout ancho**

Cambiar la clase del card (línea 291 actual):

```jsx
          <Pressable className={`max-h-[90%] w-full ${isWideLayout ? 'max-w-5xl' : 'max-w-lg'} rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface`} nativeID="create-session-modal-card" onPress={() => {}} testID="create-session-modal-card">
```

- [ ] **Step 4: Envolver el cuerpo del modal en `SessionDragProvider`, partir en 2 columnas cuando corresponde**

El `ScrollView` de `create-session-modal-scroll` (línea 299 actual)
hoy envuelve directo el `InputField`/nombre, descripción, lista de
ejercicios, botón "+ Agregar ejercicio" y error. Pasa a:

```jsx
            {isWideLayout ? (
              <SessionDragProvider>
                <SessionModalWideBody
                  catalogExercises={catalogExercises}
                  description={description}
                  error={error}
                  exercises={exercises}
                  onChangeExercise={handleChangeExercise}
                  onChangeRole={handleChangeRole}
                  onExerciseDropped={(exercise) => setExercises((rows) => [...rows, { ...makeBlankRow('main'), exerciseId: exercise.id }])}
                  onMove={handleMoveExercise}
                  onRemove={handleRemoveExercise}
                  onSetDescription={setDescription}
                  onSetName={setName}
                  name={name}
                  visible={visible}
                />
              </SessionDragProvider>
            ) : (
              <ScrollView nativeID="create-session-modal-scroll" showsVerticalScrollIndicator={false} testID="create-session-modal-scroll">
                <InputField autoFocus={!isWeb && visible} dense hideErrorRow label="Nombre" onChange={setName} placeholder="Ej. Series de velocidad" value={name} />
                <InputField dense hideErrorRow label="Descripción" multiline numberOfLines={2} onChange={setDescription} value={description} />

                <View className="mb-2 flex-row items-center justify-between" nativeID="create-session-modal-exercises-header" testID="create-session-modal-exercises-header">
                  <Text className={FIELD_LABEL} nativeID="create-session-modal-exercises-header-label" testID="create-session-modal-exercises-header-label">Ejercicios</Text>
                  <Pressable
                    className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
                    nativeID="create-session-modal-create-exercise-button"
                    onPress={() => setShowCreateExerciseModal(true)}
                    testID="create-session-modal-create-exercise-button"
                  >
                    <Text className="text-sm font-semibold text-primary" nativeID="create-session-modal-create-exercise-button-label" testID="create-session-modal-create-exercise-button-label">
                      + Crear ejercicio
                    </Text>
                  </Pressable>
                </View>

                <View className="gap-2" nativeID="create-session-modal-exercises-list" testID="create-session-modal-exercises-list">
                  {exercises.map((entry, index) => (
                    <SessionExerciseRow
                      catalogExercises={catalogExercises}
                      entry={entry}
                      idPrefix={`create-session-modal-exercise-row-${entry.localKey}`}
                      index={index}
                      key={entry.localKey}
                      onChangeExercise={handleChangeExercise}
                      onChangeRole={handleChangeRole}
                      onMove={handleMoveExercise}
                      onRemove={handleRemoveExercise}
                      totalCount={exercises.length}
                    />
                  ))}
                </View>

                <Pressable
                  className="mb-3 mt-2 h-11 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-dashed border-primary px-4 hover:bg-primary-tint-subtle active:opacity-70 dark:hover:bg-primary/10"
                  nativeID="create-session-modal-add-exercise-button"
                  onPress={handleAddExercise}
                  testID="create-session-modal-add-exercise-button"
                >
                  <MaterialCommunityIcons color="#8cc63e" name="plus" size={18} />
                  <Text className="text-sm font-semibold text-primary" nativeID="create-session-modal-add-exercise-button-label" testID="create-session-modal-add-exercise-button-label">
                    Agregar ejercicio
                  </Text>
                </Pressable>

                {error && (
                  <Text className="mb-3 text-xs text-red-500 dark:text-red-400" nativeID="create-session-modal-error" testID="create-session-modal-error">{error}</Text>
                )}
              </ScrollView>
            )}
```

(Este bloque narrow/mobile es literalmente el contenido que ya existía
en el archivo, sin cambios de comportamiento — solo se agregaron
`onMove`/`totalCount` a `SessionExerciseRow`, ya hechos en el Task 4.
No se quita el botón "+ Agregar ejercicio" en esta rama.)

- [ ] **Step 5: `SessionModalWideBody` — componente nuevo, mismo archivo**

Agregar antes de `export function CreateSessionModal`:

```jsx
// Cuerpo del modal en layout ancho — 2 columnas: sesión a la izquierda
// (mismos campos y lista de SessionExerciseRow que la variante angosta,
// SIN el botón "+ Agregar ejercicio" — acá las filas se crean soltando
// una tarjeta del panel), catálogo de ejercicios arrastrable a la
// derecha. El `View` de la lista de la sesión se registra como drop
// target vía useSessionDropTarget().
function SessionModalWideBody({ name, onSetName, description, onSetDescription, exercises, catalogExercises, onChangeExercise, onChangeRole, onMove, onRemove, onExerciseDropped, error, visible }) {
  const dropTargetRef = useSessionDropTarget();

  return (
    <View className="flex-row gap-4" nativeID="create-session-modal-body" testID="create-session-modal-body">
      <ScrollView className="w-[380px] shrink-0" nativeID="create-session-modal-form-column" testID="create-session-modal-form-column">
        <InputField autoFocus={visible} dense hideErrorRow label="Nombre" onChange={onSetName} placeholder="Ej. Series de velocidad" value={name} />
        <InputField dense hideErrorRow label="Descripción" multiline numberOfLines={2} onChange={onSetDescription} value={description} />

        <Text className={FIELD_LABEL} nativeID="create-session-modal-exercises-header-label" testID="create-session-modal-exercises-header-label">Ejercicios</Text>
        <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID="create-session-modal-drop-hint" testID="create-session-modal-drop-hint">
          Arrastrá ejercicios del panel de la derecha para agregarlos acá.
        </Text>

        <View className="min-h-[80px] gap-2 rounded-xl border border-dashed border-slate-300 p-2 dark:border-slate-600" nativeID="create-session-modal-exercises-list" ref={dropTargetRef} testID="create-session-modal-exercises-list">
          {exercises.map((entry, index) => (
            <SessionExerciseRow
              catalogExercises={catalogExercises}
              entry={entry}
              idPrefix={`create-session-modal-exercise-row-${entry.localKey}`}
              index={index}
              key={entry.localKey}
              onChangeExercise={onChangeExercise}
              onChangeRole={onChangeRole}
              onMove={onMove}
              onRemove={onRemove}
              totalCount={exercises.length}
            />
          ))}
        </View>

        {error && (
          <Text className="mb-3 mt-2 text-xs text-red-500 dark:text-red-400" nativeID="create-session-modal-error" testID="create-session-modal-error">{error}</Text>
        )}
      </ScrollView>

      <View className="flex-1 border-l border-slate-200 pl-4 dark:border-slate-700" nativeID="create-session-modal-exercise-panel-column" testID="create-session-modal-exercise-panel-column">
        <SessionExercisePanel onExerciseAdded={onExerciseDropped} />
      </View>
    </View>
  );
}
```

`dropTargetRef` de `useSessionDropTarget()` es un `useRef` normal — se
pasa como `ref` de un `View` de React Native Web (que expone
`measureInWindow` igual que cualquier `View` nativo).

- [ ] **Step 6: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 7: Verificar en preview (ancho de escritorio real, ~1440px)**

Abrir "Nueva sesión": modal ensanchado, 2 columnas. Arrastrar 2-3
ejercicios del panel derecho hacia la lista de la izquierda (con mouse
real, no clicks sintéticos — el drag no es simulable de forma confiable
con eventos sintéticos) — confirmar que aparecen como filas nuevas con
rol "principal", editable con el picker de rol de cada fila. Crear un
ejercicio nuevo desde el botón del panel, confirmar que aparece ahí sin
cerrar el modal. Reordenar con las flechas subir/bajar. Guardar y
volver a abrir la sesión — el orden se mantuvo.

- [ ] **Step 8: Verificar en preview (mobile/web angosto)**

Redimensionar a <1024px (o abrir en el preview mobile). Confirmar que
el modal se ve exactamente como antes de este sub-proyecto: sin panel,
con el botón "+ Agregar ejercicio", select por fila.

- [ ] **Step 9: Commit**

```bash
git add components/plans/create-session-modal.jsx
git commit -m "feat(sessions): wide layout with drag-and-drop exercise panel"
```

---

### Task 8: Barrido final y version bump

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada — último task de los 3 sub-proyectos de
  `feature/catalog-redesign`.

- [ ] **Step 1: Bump de versión**

Confirmar el valor actual de `"version"` en `package.json` e
incrementar un **minor** — feature grande y visible (primer
drag-and-drop del repo).

- [ ] **Step 2: Suite completa**

Run: `npm test`
Expected: todos los tests pasan.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Barrido de preview**

Repetir en una sola pasada: menú de tres puntitos en sesiones (editar/
clonar/eliminar), botones subir/bajar, layout ancho con drag-and-drop
completo, layout angosto/mobile sin cambios.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: version bump for sessions drag-and-drop"
```
