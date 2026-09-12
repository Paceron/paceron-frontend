import { createContext, useContext, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { isWeb } from '../../utils/platform.js';

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

// Overlay que sigue al cursor mientras hay un arrastre en curso — vive
// en un solo lugar (montado una vez por SessionDragProvider) para que el
// "fantasma" pueda visualmente cruzar de la columna del panel a la
// columna de la sesión sin quedar recortado por el overflow de ninguna
// de las 2 (mismo problema que ya resuelve el patrón absolute-inset-0 de
// components/shared/animated-dropdown.jsx). CRÍTICO: en RN Web todo View
// es `position: relative` por default, así que un `inset-0` clásico
// (className `absolute`) no ancla contra la ventana sino contra el
// ancestro posicionado más cercano — acá el card del modal, que está
// centrado y con padding, es decir con un offset propio respecto a la
// pantalla. `dragX`/`dragY` vienen de `e.absoluteX/absoluteY` (coordenadas
// de PANTALLA), así que mezclarlas con un origen que NO es la pantalla
// corría el fantasma hacia la derecha/abajo por exactamente ese offset
// (bug reportado: el fantasma no queda debajo del cursor). En web, este
// overlay solo se monta dentro del layout ancho de escritorio — nunca en
// mobile nativo —, así que `position: fixed` (ancla contra el viewport,
// no contra el ancestro) es seguro acá sin tocar la rama nativa.
function DragGhost() {
  const { dragX, dragY, draggedExercise } = useContext(SessionDragContext);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - 90 }, { translateY: dragY.value - 24 }],
  }));

  if (!draggedExercise) return null;
  return (
    <View
      className="inset-0 z-50"
      nativeID="session-drag-ghost-overlay"
      style={{ position: isWeb ? 'fixed' : 'absolute', pointerEvents: 'none' }}
      testID="session-drag-ghost-overlay"
    >
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
