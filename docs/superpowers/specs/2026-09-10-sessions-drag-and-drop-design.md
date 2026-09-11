# Sesiones: modal ensanchado + panel de ejercicios con drag-and-drop — Design

## Contexto

Tercer y último sub-proyecto del rediseño de catálogo del entrenador, en
la rama compartida `feature/catalog-redesign` (ver specs hermanas de
ejercicios y planes). Hoy `components/plans/create-session-modal.jsx` es
un modal angosto (`max-w-lg`) donde cada ejercicio de la sesión se agrega
con un botón "+ Agregar ejercicio" que crea una fila en blanco, y se
completa eligiendo el ejercicio de un `ResponsiveSelectField` por fila.
El objetivo: en pantallas anchas, ensanchar el modal y agregar un panel
lateral con el catálogo de ejercicios completo, del que se arrastran
tarjetas directo a la lista de la sesión — la fila se crea sola al
soltar, sin pasar por el select.

**Decisiones de enfoque ya cerradas con el usuario (2026-09-10):**
- **Drag-and-drop a mano**, con `react-native-gesture-handler`/
  `react-native-reanimated` (ya instalados, ya usados en esta app) — no
  se suma ninguna librería nueva. Se evaluó `react-native-drax`
  (soporta Web, pero su función de arrastre entre listas distintas la
  marca el propio autor como "experimental") y se descartó por el riesgo
  de correr esto desatendido durante la noche.
- **Reordenar ejercicios ya agregados a la sesión: botones arriba/abajo
  en cada fila, no drag.** Solo hace falta una mecánica de arrastre (del
  panel a la lista), no dos.
- **Mobile/web angosto: sin cambios, mismo flujo de hoy** (botón "+
  Agregar ejercicio" + select por fila). El panel lateral y el drag son
  exclusivos de web ancho (`isWeb && !isNarrowWeb`, mismo criterio que ya
  usa `training-plan-form-fields.jsx` para su propio fork
  ancho/angosto). Una versión mobile mejorada (ej. un cajón inferior
  deslizable) queda anotada como idea a futuro, no se aborda ahora.

## Alcance

**Adentro:**
- Modal ensanchado en web ancho (2 columnas: sesión a la izquierda,
  catálogo de ejercicios a la derecha).
- Panel de ejercicios: lista del catálogo completo del entrenador +
  buscador + botón "+ Crear ejercicio" (se muda acá desde su ubicación
  actual).
- Arrastrar una tarjeta del panel y soltarla sobre la lista de la sesión
  agrega una fila nueva (rol "principal" por default, editable después).
- Botones subir/bajar por fila de la sesión, para reordenar.
- Se quita el botón "+ Agregar ejercicio" — **solo en el layout ancho**
  (mobile/angosto lo conserva sin cambios).
- `cloneSession` nuevo (servicio/mock/hook), y menú de tres puntitos por
  fila en `sessions-catalog-tab.jsx` (Editar/Clonar/Eliminar) — mismo
  patrón que ya se sumó a ejercicios en el sub-proyecto 1.

**Afuera (explícitamente):**
- Cualquier librería de drag-and-drop de terceros.
- Reordenar por arrastre (queda resuelto con los botones subir/bajar).
- Una versión mejorada del flujo mobile (panel/cajón deslizable) — idea
  anotada, no implementada ahora.
- Planes: ya tienen clonar/editar/eliminar (en `training-plan-detail-screen.jsx`,
  sin cambios necesarios) — no se toca nada de planes en este sub-proyecto.
- Validación de "1 ejercicio por rol" al guardar — sigue igual que hoy
  (`handleSubmit` en `create-session-modal.jsx`), no cambia con este
  rediseño.

## Prerrequisito técnico: `GestureHandlerRootView`

`react-native-gesture-handler` (ya instalado, `~2.28.0`) exige que toda la
app esté envuelta en un `GestureHandlerRootView` para que los gestos
(`Gesture.Pan()`, etc.) funcionen de forma confiable — hoy nadie en este
repo usa gestos reales de esta librería (`reanimated` sí se usa, para
animaciones, pero eso no requiere este wrapper), así que no hay
precedente de que ya esté resuelto. `expo-router` (`~6.0.24`, versión
reciente) puede envolver esto automáticamente en su punto de entrada —
sin confirmar contra este proyecto puntual.

**Primer paso del plan de implementación, antes de construir nada del
mecanismo de arrastre**: agregar un `Gesture.Pan()` mínimo de prueba
(ej. mover un cuadrado de debug) en cualquier pantalla, confirmar en
preview que el gesto responde. Si no responde, envolver el contenido de
`app/_layout.jsx` (`RootLayout`, el `return` que hoy arranca en
`AppProviders`/`StackNavigator`) en `GestureHandlerRootView` de
`react-native-gesture-handler` con `style={{ flex: 1 }}` — cambio de una
sola línea de anidamiento, sin efecto visual. Sacar el cuadrado de
prueba antes de seguir. Esto desbloquea (o confirma que ya está
desbloqueado) todo el resto de este sub-proyecto.

## Layout del modal (web ancho)

`create-session-modal.jsx`, card del modal: `max-w-lg` pasa a
`max-w-5xl` **solo cuando `isWeb && !isNarrowWeb`** (mismo hook
`useIsNarrowWeb` ya usado en el resto del catálogo). Estructura nueva:

```jsx
<View className={isWideLayout ? 'flex-row gap-4' : ''} nativeID="create-session-modal-body" testID="create-session-modal-body">
  <View className={isWideLayout ? 'w-[380px] shrink-0' : 'flex-1'} nativeID="create-session-modal-form-column" testID="create-session-modal-form-column">
    {/* Nombre, Descripción, lista de SessionExerciseRow, botones de acción —
        todo lo que ya existe hoy, con los ajustes de la sección siguiente */}
  </View>
  {isWideLayout && (
    <View className="flex-1 border-l border-slate-200 pl-4 dark:border-slate-700" nativeID="create-session-modal-exercise-panel-column" testID="create-session-modal-exercise-panel-column">
      <SessionExercisePanel onExerciseAdded={handleExerciseDropped} />
    </View>
  )}
</View>
```

`isWideLayout = isWeb && !isNarrowWeb`. El resto del modal (header,
título, footer con Cancelar/Crear) no cambia de posición, solo el cuerpo
central se parte en 2 columnas cuando corresponde. `max-h-[90%]` del
card se mantiene igual en los 2 layouts.

## `SessionExercisePanel` (nuevo, `components/plans/session-exercise-panel.jsx`)

Mini-catálogo embebido en el modal, mismo criterio visual que
`exercises-catalog-tab.jsx` pero sin acciones de editar/eliminar (esto
no es el catálogo real, es un selector para arrastrar):

```jsx
export function SessionExercisePanel({ onExerciseAdded }) {
  const userId = useAuthStore((s) => s.userId);
  const { exercises } = useExercises(userId);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const query = search.trim().toLowerCase();
  const filtered = query ? exercises.filter((e) => e.name.toLowerCase().includes(query)) : exercises;

  return (
    <View className="flex-1" nativeID="session-exercise-panel" testID="session-exercise-panel">
      <View className="mb-2 flex-row items-center justify-between" nativeID="session-exercise-panel-header" testID="session-exercise-panel-header">
        <Text className={FIELD_LABEL}>Catálogo de ejercicios</Text>
        <Pressable onPress={() => setShowCreateModal(true)} nativeID="session-exercise-panel-create-button" testID="session-exercise-panel-create-button">
          <Text className="text-sm font-semibold text-primary">+ Crear ejercicio</Text>
        </Pressable>
      </View>
      {/* buscador, mismo patrón que exercises-catalog-tab.jsx */}
      <ScrollView nativeID="session-exercise-panel-list" testID="session-exercise-panel-list">
        {filtered.map((exercise) => (
          <DraggableExerciseCard exercise={exercise} key={exercise.id} onDropped={onExerciseAdded} />
        ))}
      </ScrollView>
      <CreateExerciseModal onClose={() => setShowCreateModal(false)} onCreated={() => setShowCreateModal(false)} visible={showCreateModal} />
    </View>
  );
}
```

(`FIELD_LABEL` ya se importa de `../forms/fields.jsx` en
`create-session-modal.jsx` — mismo import acá.)

## Mecánica de arrastre (nuevo, `components/plans/session-drag-and-drop.jsx`)

Todo el mecanismo vive en un archivo nuevo, consumido por
`create-session-modal.jsx` (que mide y provee la zona de destino) y por
`SessionExercisePanel` (que renderiza las tarjetas arrastrables). Técnica:
mismo patrón de medición ya usado por `RunnerMenu`
(`team-detail-screen.jsx:173-193`) — `measureInWindow` en el destino,
comparado contra la posición absoluta del gesto — y el mismo patrón de
overlay a pantalla completa que `AnimatedDropdown`
(`components/shared/animated-dropdown.jsx`) para el "fantasma" que sigue
al dedo/cursor (evita problemas de recorte visual al cruzar de una
columna a la otra — el fantasma no vive dentro de ninguna de las 2
columnas, vive en un overlay `absolute inset-0` sobre el modal entero).

**Estado compartido** (contexto de React simple, no Zustand — vive y
muere con el modal):

```jsx
const SessionDragContext = createContext(null);

// Provider envuelve el body de 2 columnas del modal. Expone el estado
// del arrastre en curso (o null) + una función para registrar el ref
// del contenedor de la lista de la sesión (el "drop target").
export function SessionDragProvider({ children }) {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const [draggedExercise, setDraggedExercise] = useState(null); // exercise | null
  const dropTargetRef = useRef(null);

  return (
    <SessionDragContext.Provider value={{ dragX, dragY, draggedExercise, setDraggedExercise, dropTargetRef }}>
      {children}
      <DragGhost />
    </SessionDragContext.Provider>
  );
}
```

**`DraggableExerciseCard`** (dentro de `session-drag-and-drop.jsx`,
usado por `SessionExercisePanel`):

```jsx
function DraggableExerciseCard({ exercise, onDropped }) {
  const { dragX, dragY, setDraggedExercise, dropTargetRef } = useContext(SessionDragContext);

  const checkDrop = (absoluteX, absoluteY) => {
    if (!dropTargetRef.current) return;
    dropTargetRef.current.measureInWindow((x, y, width, height) => {
      const inside = absoluteX >= x && absoluteX <= x + width && absoluteY >= y && absoluteY <= y + height;
      if (inside) onDropped(exercise);
    });
  };

  const pan = Gesture.Pan()
    .onStart((e) => { runOnJS(setDraggedExercise)(exercise); dragX.value = e.absoluteX; dragY.value = e.absoluteY; })
    .onUpdate((e) => { dragX.value = e.absoluteX; dragY.value = e.absoluteY; })
    .onEnd((e) => {
      runOnJS(checkDrop)(e.absoluteX, e.absoluteY);
      runOnJS(setDraggedExercise)(null);
    });

  return (
    <GestureDetector gesture={pan}>
      {/* misma tarjeta visual que una fila del catálogo real
          (ícono por tipo + nombre + stat), ver ExerciseRow de
          exercises-catalog-tab.jsx como referencia de estilo */}
    </GestureDetector>
  );
}
```

**`DragGhost`** (overlay, se monta una sola vez por `SessionDragProvider`):

```jsx
function DragGhost() {
  const { dragX, dragY, draggedExercise } = useContext(SessionDragContext);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - 90 }, { translateY: dragY.value - 24 }],
  }));

  if (!draggedExercise) return null;
  return (
    <View className="absolute inset-0 z-50" style={{ pointerEvents: 'none' }} nativeID="session-drag-ghost-overlay" testID="session-drag-ghost-overlay">
      <Animated.View className="w-44 rounded-xl border border-primary bg-white px-3 py-2 opacity-90 shadow-lg dark:bg-surface" style={[{ position: 'absolute' }, style]}>
        <Text numberOfLines={1}>{draggedExercise.name}</Text>
      </Animated.View>
    </View>
  );
}
```

**En `create-session-modal.jsx`**: el `View` de
`create-session-modal-exercises-list` (la lista de `SessionExerciseRow`)
se envuelve en un `ref` que se registra en `dropTargetRef` al montar
(`useEffect` corto: `dropTargetRef.current = listRef.current`). El
callback `onExerciseAdded`/`onDropped` que recibe el exercise soltado
llama:

```js
const handleExerciseDropped = (exercise) => {
  setExercises((rows) => [...rows, { ...makeBlankRow('main'), exerciseId: exercise.id }]);
};
```

(Mismo `makeBlankRow` que ya existe en el archivo — `role: 'main'` por
default, editable después con el `SessionRoleSegmentedPicker` que ya
tiene cada fila.)

Todo esto (`SessionDragProvider`, `create-session-modal-body`,
`SessionExercisePanel`) solo se monta cuando `isWideLayout` es `true` —
en mobile/angosto ninguno de estos componentes nuevos existe en el
árbol, cero costo ahí.

## Reordenar: botones subir/bajar

`SessionExerciseRow` (`create-session-modal.jsx:67-149`) suma 2 botones
chicos (flechas arriba/abajo, `MaterialCommunityIcons`
`chevron-up`/`chevron-down`) junto al botón de quitar existente —
visibles en los 2 layouts (ancho y angosto/mobile, no es exclusivo de la
mecánica de drag):

```jsx
<Pressable disabled={index === 0} onPress={() => onMove(entry.localKey, -1)} nativeID={`${idPrefix}-move-up-button`} testID={`${idPrefix}-move-up-button`}>
  <MaterialCommunityIcons name="chevron-up" size={16} />
</Pressable>
<Pressable disabled={index === totalCount - 1} onPress={() => onMove(entry.localKey, 1)} nativeID={`${idPrefix}-move-down-button`} testID={`${idPrefix}-move-down-button`}>
  <MaterialCommunityIcons name="chevron-down" size={16} />
</Pressable>
```

`onMove` nuevo en `create-session-modal.jsx`:

```js
// Intercambia la fila con su vecina inmediata en la dirección dada
// (-1 = subir, +1 = bajar) — sin efecto si ya está en la punta (la UI ya
// deshabilita el botón ahí, esto es la defensa del lado de la función).
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

**Test nuevo**: función pura, testeable sin montar nada —
`__tests__/normalizers.test.js` no es el lugar correcto (no es un
normalizador); si se extrae a un archivo de utils propio (ej.
`utils/array-reorder.js` con una función genérica `swapAdjacent(array,
index, direction)`), va en un test nuevo `__tests__/array-reorder.test.js`.
Si se deja inline en el componente (más simple, es una función chica y
de un solo call site), queda sin test unitario — decisión del plan de
implementación, cualquiera de las 2 es aceptable.

## `cloneSession`

Mismo patrón exacto que `cloneExercise` (sub-proyecto 1) y
`cloneTrainingPlan`:

**`services/__mocks__/sessions-mock.js`** — nueva función
`mockCloneSession(sessionId)`: copia profunda, `id` nuevo, `name:
"${original.name} (copia)"`, deep-copy de `exercises`, no hereda uso en
planes (un plan que referencia la sesión original sigue apuntando a
esa, no al clon).

**`services/sessions.js`** — `POST /api/v1/sessions/{id}/clone`, mismo
wrapper `USE_MOCKS || FORCE_MOCKS` que el resto.

**`hooks/use-sessions.js`** — nueva mutación `cloneSession` en
`useSessionMutations()`, mismo patrón que `deleteSessionMutation`,
invalida `['sessions', ownerId]` al terminar.

**Test nuevo**: `__tests__/sessions-mock.test.js` (ya existe) — mismo
set de casos que se sumó a `mockCloneExercise` en el sub-proyecto 1.

## Menú de tres puntitos en `sessions-catalog-tab.jsx`

Mismo patrón exacto que se sumó a `exercises-catalog-tab.jsx` en el
sub-proyecto 1 (`RunnerMenu`/`AnimatedDropdown`, estado de "qué fila
tiene el menú abierto" en el componente padre). `SessionRow`
(`sessions-catalog-tab.jsx:22-58`) reemplaza sus 2 `Pressable` sueltos
(lápiz, tacho) por un botón `dots-vertical` con menú: Editar, Clonar,
Eliminar. El link "Usado en N planes" no se mueve, queda igual.

**Sin multi-selección para sesiones** — a diferencia de ejercicios
(sub-proyecto 1), acá el pedido original solo fue clonar/editar/eliminar
individual, no selección en bloque.

## Testing / verificación

Lógica pura con test real:
- `mockCloneSession` (`__tests__/sessions-mock.test.js`).
- La función de reordenar, si termina extraída a un archivo propio (ver
  sección de arriba).

Sin test de componente (convención) — verificación manual en preview,
**solo alcanzable en ancho de escritorio real** (el mecanismo de drag no
es simulable con clicks sintéticos de forma confiable — verificar con
interacción real de mouse):
1. Web ancho: abrir "Nueva sesión", confirmar 2 columnas, arrastrar 2-3
   ejercicios del panel a la lista de la sesión, confirmar que aparecen
   como filas nuevas con rol "principal".
2. Cambiar rol/repeticiones de una fila creada por drag — funciona igual
   que antes (mismo componente `SessionExerciseRow`).
3. Botones subir/bajar: reordenar 3+ filas, confirmar que el orden final
   se guarda correctamente (abrir la sesión de nuevo después de guardar).
4. Crear un ejercicio nuevo desde el botón del panel — aparece
   inmediatamente en la lista del panel, sin cerrar el modal de sesión.
5. Web angosto y mobile: confirmar que el modal se ve exactamente como
   hoy (sin panel, con el botón "+ Agregar ejercicio").
6. Catálogo de sesiones: menú de tres puntitos, clonar una sesión,
   confirmar "(copia)" en la lista.

`npm test` y `npm run lint` en verde antes de cada commit.

## Idea a futuro (anotar, no implementar)

Mobile/web angosto podría eventualmente sumar un cajón inferior
deslizable horizontalmente como reemplazo del panel lateral (en vez de
mantener el flujo viejo de botón+select) — sugerido por el usuario,
explícitamente pospuesto por complejidad. Guardar como idea de mejora
futura, no bloquea este sub-proyecto.
