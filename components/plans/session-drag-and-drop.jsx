import { createContext, useContext, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isWeb } from '../../utils/platform.js';
import { useThemeColors } from '../../theme/colors.js';
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

// Cuánto antes del borde del contenedor (en px de pantalla) empieza a
// autoscrollear, y cuánto scrollea por frame de arrastre. EDGE chico
// haría falta acercarse demasiado al borde real (mala UX en mobile,
// donde el dedo tapa la zona); STEP grande se siente a los saltos.
const AUTO_SCROLL_EDGE = 56;
const AUTO_SCROLL_STEP = 14;

export function SessionDragProvider({ children }) {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Medición del drop target cacheada una vez al empezar el arrastre
  // (no en cada frame) — se usa tanto para el indicador de posición en
  // vivo (hoverIndexSV/isHoveringSV, leídos desde un worklet) como para
  // decidir el drop final, sin repetir measureInWindow al soltar.
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const targetWidth = useSharedValue(0);
  const targetHeight = useSharedValue(0);
  const hoverIndexSV = useSharedValue(0);
  const isHoveringSV = useSharedValue(0);
  const [draggedExercise, setDraggedExercise] = useState(null);
  const dropTargetRef = useRef(null);
  // Ref al componente de lista (FlatList, vía el prop `ref` que DraxList
  // reenvía) — imperativo, para autoscroll. Separado del scroll offset
  // (rastreado por onScroll en el consumidor) porque scrollToOffset no
  // tiene forma de preguntar "en qué offset estoy ahora".
  const autoScrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  return (
    <SessionDragContext.Provider value={{
      dragX, dragY, targetX, targetY, targetWidth, targetHeight, hoverIndexSV, isHoveringSV,
      draggedExercise, setDraggedExercise, dropTargetRef, autoScrollRef, scrollOffsetRef,
    }}
    >
      {children}
      <DragGhost />
    </SessionDragContext.Provider>
  );
}

// El contenedor de la lista de la sesión (destino del drop) se registra
// acá.
export function useSessionDropTarget() {
  const { dropTargetRef } = useContext(SessionDragContext);
  return dropTargetRef;
}

// Ref imperativo al ScrollView de la lista + callback de scroll — para
// autoscroll cerca de los bordes mientras se arrastra desde el
// catálogo. `onListScroll` se cablea al `onScroll` del ScrollView
// consumidor.
export function useSessionAutoScrollTarget() {
  const { autoScrollRef, scrollOffsetRef } = useContext(SessionDragContext);
  const onListScroll = (e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; };
  return { autoScrollRef, onListScroll };
}

// Índice estimado (y si hay arrastre activo sobre el target) para
// pintar un indicador de "acá va a caer" — ver SessionDropIndicator más
// abajo, se monta una vez dentro del contenedor de ejercicios de la
// sesión.
export function useSessionDropIndicator() {
  const { hoverIndexSV, isHoveringSV } = useContext(SessionDragContext);
  return { hoverIndexSV, isHoveringSV };
}

// Línea horizontal que marca dónde caería el ejercicio si se soltara
// ahora — se monta una sola vez, adentro del `View` con `ref={dropTargetRef}`.
// Position absolute + top animado en vez de una fila más de la lista:
// más simple que insertar/sacar una fila fantasma en cada frame de
// arrastre.
export function SessionDropIndicator() {
  const colors = useThemeColors();
  const { hoverIndexSV, isHoveringSV } = useSessionDropIndicator();
  const style = useAnimatedStyle(() => ({
    opacity: isHoveringSV.value,
    transform: [{ translateY: hoverIndexSV.value * ESTIMATED_ROW_HEIGHT }],
  }));

  return (
    <Animated.View
      nativeID="session-drop-indicator"
      style={[
        { position: 'absolute', left: 8, right: 8, top: 0, height: 3, borderRadius: 2, backgroundColor: colors.primary },
        style,
      ]}
      testID="session-drop-indicator"
    />
  );
}

// Tarjeta arrastrable del panel de ejercicios. `onDropped(exercise, index)`
// se llama solo si el punto de soltado cae dentro del contenedor
// registrado en dropTargetRef, con el índice estimado de inserción.
export function DraggableExerciseCard({ exercise, onDropped, children }) {
  const {
    dragX, dragY, targetX, targetY, targetWidth, targetHeight, hoverIndexSV, isHoveringSV,
    setDraggedExercise, dropTargetRef, autoScrollRef, scrollOffsetRef,
  } = useContext(SessionDragContext);

  const cacheTargetMeasurements = () => {
    if (!dropTargetRef.current) return;
    dropTargetRef.current.measureInWindow((x, y, width, height) => {
      targetX.value = x;
      targetY.value = y;
      targetWidth.value = width;
      targetHeight.value = height;
    });
  };

  // Autoscroll: JS-thread, llamado desde el worklet de onUpdate vía
  // runOnJS — el offset actual se rastrea por afuera (scrollOffsetRef,
  // actualizado por onScroll) porque el ScrollView no tiene forma de
  // preguntar "en qué offset estoy ahora", solo de pedirle uno nuevo.
  const maybeAutoScroll = (absoluteY, top, height) => {
    if (!autoScrollRef.current) return;
    const relativeY = absoluteY - top;
    let next = null;
    if (relativeY < AUTO_SCROLL_EDGE) {
      next = Math.max(0, scrollOffsetRef.current - AUTO_SCROLL_STEP);
    } else if (relativeY > height - AUTO_SCROLL_EDGE) {
      next = scrollOffsetRef.current + AUTO_SCROLL_STEP;
    }
    if (next === null || next === scrollOffsetRef.current) return;
    scrollOffsetRef.current = next;
    autoScrollRef.current.scrollTo({ y: next, animated: false });
  };

  // Chequeo fresco con la posición final real (absoluteX/Y del propio
  // onEnd), no el `isHoveringSV` acumulado de onUpdate — un arrastre
  // rápido/con pocos frames intermedios puede llegar a onEnd sin que el
  // último onUpdate haya corrido todavía, dejando isHoveringSV desactualizado
  // y el drop se perdía en silencio (bug real: soltar en la lista vacía
  // no cargaba nada). Sigue sin re-medir con measureInWindow — usa los
  // mismos target* cacheados en onStart, solo la comparación es nueva.
  const checkDrop = (absoluteX, absoluteY) => {
    if (targetWidth.value <= 0) return;
    const inside = absoluteX >= targetX.value && absoluteX <= targetX.value + targetWidth.value
      && absoluteY >= targetY.value && absoluteY <= targetY.value + targetHeight.value;
    if (!inside) return;
    const insertIndex = Math.max(0, Math.round((absoluteY - targetY.value) / ESTIMATED_ROW_HEIGHT));
    onDropped(exercise, insertIndex);
  };

  const pan = Gesture.Pan()
    .onStart((e) => {
      runOnJS(setDraggedExercise)(exercise);
      runOnJS(cacheTargetMeasurements)();
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
    })
    .onUpdate((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      const inside = targetWidth.value > 0
        && e.absoluteX >= targetX.value && e.absoluteX <= targetX.value + targetWidth.value
        && e.absoluteY >= targetY.value && e.absoluteY <= targetY.value + targetHeight.value;
      isHoveringSV.value = inside ? 1 : 0;
      if (inside) {
        hoverIndexSV.value = Math.max(0, Math.round((e.absoluteY - targetY.value) / ESTIMATED_ROW_HEIGHT));
        runOnJS(maybeAutoScroll)(e.absoluteY, targetY.value, targetHeight.value);
      }
    })
    .onEnd((e) => {
      runOnJS(checkDrop)(e.absoluteX, e.absoluteY);
      isHoveringSV.value = 0;
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
  const colors = useThemeColors();
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
          genérica (pedido explícito del usuario). Todo en `style`, nada
          en `className` acá — mismo bug ya documentado en
          theme-toggle.jsx: un Animated.View de reanimated no aplica
          NINGUNA clase de NativeWind (confirmado con getComputedStyle),
          así que un className acá se ve como si no tuviera card/caja en
          absoluto, solo ícono+texto flotando (bug real reportado por el
          usuario). */}
      <Animated.View
        nativeID="session-drag-ghost-card"
        style={[
          {
            position: 'absolute',
            width: 176,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 8,
            opacity: 0.9,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          },
          style,
        ]}
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
