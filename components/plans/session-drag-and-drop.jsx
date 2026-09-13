import { createContext, useContext, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isWeb } from '../../utils/platform.js';
import { EXERCISE_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';

// Alto de fila aproximado — usado solo para estimar en qué posición de
// la lista de la sesión se soltó una card del catálogo (no hay forma de
// medir cada fila real sin virtualización de por medio, ver DraxList en
// create-session-modal.jsx). No pretende ser exacto, alcanza para que
// "soltar arriba" inserte cerca del principio y "soltar abajo" cerca
// del final, en vez de ir siempre al final sin importar dónde se soltó.
const ESTIMATED_ROW_HEIGHT = 110;

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
      if (!inside) return;
      const insertIndex = Math.max(0, Math.round((absoluteY - y) / ESTIMATED_ROW_HEIGHT));
      onDropped(exercise, insertIndex);
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
  const meta = EXERCISE_KIND_META[draggedExercise.kind] ?? EXERCISE_KIND_META.walking;
  const statLine = buildExerciseStatLine(draggedExercise);
  return (
    <View
      className="inset-0 z-50"
      nativeID="session-drag-ghost-overlay"
      style={{ position: isWeb ? 'fixed' : 'absolute', pointerEvents: 'none' }}
      testID="session-drag-ghost-overlay"
    >
      {/* Mismo contenido que PanelExerciseCard (ícono + nombre + stat) en
          vez de solo el nombre en texto plano — la idea es que lo que se
          ve arrastrado sea reconociblemente "la card", no una etiqueta
          genérica (pedido explícito del usuario). */}
      <Animated.View
        className="w-44 flex-row items-center gap-2 rounded-xl border border-primary bg-white px-3 py-2 opacity-90 shadow-lg dark:bg-surface"
        nativeID="session-drag-ghost-card"
        style={[{ position: 'absolute' }, style]}
        testID="session-drag-ghost-card"
      >
        <View className={`h-8 w-8 items-center justify-center rounded-full ${meta.bg}`} nativeID="session-drag-ghost-card-icon" testID="session-drag-ghost-card-icon">
          <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={16} />
        </View>
        <View className="flex-1" nativeID="session-drag-ghost-card-info" testID="session-drag-ghost-card-info">
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="session-drag-ghost-card-label" numberOfLines={1} testID="session-drag-ghost-card-label">
            {draggedExercise.name}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-drag-ghost-card-stat" numberOfLines={1} testID="session-drag-ghost-card-stat">
            {statLine || meta.label}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
