import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isWeb } from '../../utils/platform.js';
import { useThemeColors } from '../../theme/colors.js';
import { EXERCISE_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';
import { ESTIMATED_ROW_HEIGHT, estimateIndexFromOffset, clampIndex, reorderList } from './session-reorder-math.js';

export { reorderList };

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
  // Ref imperativo al ScrollView de la lista destino — para autoscroll.
  // Separado del scroll offset (rastreado por onScroll en el consumidor)
  // porque el ScrollView no tiene forma de preguntar "en qué offset estoy
  // ahora", solo de pedirle uno nuevo (scrollTo).
  const autoScrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  return (
    <SessionDragContext.Provider value={{
      dragX, dragY, targetX, targetY, targetWidth, targetHeight, hoverIndexSV, isHoveringSV,
      draggedExercise, setDraggedExercise, dropTargetRef, autoScrollRef, scrollOffsetRef,
    }}
    >
      {children}
    </SessionDragContext.Provider>
  );
}

// DragGhost ya no se automonta dentro de SessionDragProvider — necesita
// montarse como hijo DIRECTO del <Modal> (hermano de la tarjeta/backdrop,
// no anidado adentro), para que su `position: 'absolute'` en nativo
// ancle contra la vista de host del modal (pantalla completa) en vez de
// contra algún ancestro con padding/centrado. Antes esto no importaba
// porque SessionDragProvider solo se montaba en el layout ancho (solo
// web, donde `position: 'fixed'` ignora la jerarquía de todos modos);
// ahora que la rama angosta también usa arrastre (mobile nativo
// incluido), el caso nativo pasa a ejercitarse de verdad — ver
// CreateSessionModal.
export { DragGhost };

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
// holdMs (opcional): si viene, el arrastre solo se activa después de
// mantener presionado ese tiempo (`activateAfterLongPress` de
// gesture-handler) — necesario cuando la card vive dentro de un
// ScrollView cuyo gesto de scroll competiría por el mismo movimiento
// (ej. la tira horizontal del catálogo en mobile/narrow); sin holdMs
// (undefined) el arrastre se activa de inmediato, comportamiento
// original sin cambios (panel ancho de escritorio, confirmado
// funcionando, no se toca).
// scrollViewRef (opcional, va junto con holdMs): ref al mismo
// ScrollView de gesture-handler que envuelve esta card — ver
// `.simultaneousWithExternalGesture` más abajo para el porqué.
export function DraggableExerciseCard({ exercise, onDropped, children, holdMs, scrollViewRef }) {
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
    const insertIndex = estimateIndexFromOffset(absoluteY - targetY.value);
    onDropped(exercise, insertIndex);
  };

  let pan = Gesture.Pan().runOnJS(true);
  if (holdMs) {
    // failOffsetX: si el dedo se mueve más de esto ANTES de cumplirse
    // el hold, el gesto falla de inmediato y libera el toque al
    // ScrollView horizontal (scroll normal de la tira) — sin esto, un
    // swipe rápido para scrollear quedaba capturado por este Pan sin
    // activarse nunca y sin soltar el toque a tiempo para que el
    // ScrollView pudiera scrollear con él (bug real reportado: la tira
    // no scrolleaba nada). activateAfterLongPress solo, sin este tope,
    // no alcanza.
    pan = pan.activateAfterLongPress(holdMs).failOffsetX([-10, 10]);
    // simultaneousWithExternalGesture: relación EXPLÍCITA con el
    // ScrollView que envuelve esta card (via ref, no un Gesture.Native()
    // genérico sin nada a lo que referenciar) — deja que el ScrollView
    // reconozca el toque en simultáneo desde el primer frame, en vez de
    // esperar pasivamente a que este Pan falle. failOffsetX seguía sin
    // alcanzar solo (bug real: scroll horizontal seguía sin funcionar en
    // mobile incluso con failOffsetX + Gesture.Native() genérico) — sin
    // una relación real hacia el ScrollView específico, gesture-handler
    // no tenía ningún native handler concreto con el que negociar.
    if (scrollViewRef) pan = pan.simultaneousWithExternalGesture(scrollViewRef);
  }
  pan = pan
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
        hoverIndexSV.value = estimateIndexFromOffset(e.absoluteY - targetY.value);
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

// Reordenamiento por mantener-presionado dentro de la MISMA lista —
// mecanismo separado del cross-container de arriba (arrastra un
// ejercicio ya cargado a otra posición, no trae uno nuevo del catálogo).
// Contexto propio (no SessionDragContext) porque la semántica es
// distinta: no hay medición de un contenedor destino externo, el
// desplazamiento es relativo a la fila que se está moviendo, no a
// coordenadas absolutas de pantalla — evita competir con el autoscroll
// del cross-container y mantiene los dos sistemas independientes.
const ReorderContext = createContext(null);

// itemCount se pasa por prop en cada fila (no como prop del Provider)
// porque la lista puede crecer/achicarse mientras el Provider ya está
// montado — se guarda en un shared value (leído desde el worklet de
// onUpdate) y en un ref (leído desde runOnJS) actualizados en cada
// render vía useEffect en ReorderableRow.
export function ReorderProvider({ children }) {
  const activeIndexSV = useSharedValue(-1);
  const targetIndexSV = useSharedValue(-1);
  const dragOffsetY = useSharedValue(0);
  const itemCountSV = useSharedValue(0);

  return (
    <ReorderContext.Provider value={{ activeIndexSV, targetIndexSV, dragOffsetY, itemCountSV }}>
      {children}
    </ReorderContext.Provider>
  );
}

// Línea que marca dónde caería la fila si se soltara ahora, mismo
// criterio visual que SessionDropIndicator pero leyendo del
// ReorderContext — se monta una vez, adentro del contenedor con las
// filas de la lista de la sesión (mismo `View` que ya tiene
// SessionDropIndicator montado, ambos inactivos salvo que su propio
// gesto esté en curso).
export function ReorderDropIndicator() {
  const colors = useThemeColors();
  const { activeIndexSV, targetIndexSV } = useContext(ReorderContext);
  const style = useAnimatedStyle(() => ({
    opacity: activeIndexSV.value >= 0 ? 1 : 0,
    transform: [{ translateY: targetIndexSV.value * ESTIMATED_ROW_HEIGHT }],
  }));

  return (
    <Animated.View
      nativeID="session-reorder-drop-indicator"
      style={[
        { position: 'absolute', left: 8, right: 8, top: 0, height: 3, borderRadius: 2, backgroundColor: colors.primary },
        style,
      ]}
      testID="session-reorder-drop-indicator"
    />
  );
}

// Fila reordenable — envuelve el contenido real (SessionExerciseRow) con
// el gesto de mantener-presionado-y-arrastrar. `activateAfterLongPress`
// (gesture-handler) hace que el Pan solo se active tras el hold: antes
// de eso, un movimiento del dedo lo cede al ScrollView vertical que
// contiene la lista, que puede scrollear con normalidad. `Gesture.
// Simultaneous(pan, Gesture.Native())` es lo que permite que ScrollView
// hermano recupere el toque a tiempo para un swipe (confirmado
// funcionando por el usuario). Intento de sacar el Pan del ancestro de
// los controles anidados (capa invisible hermana, 2026-09-14) revertido
// el mismo día: rompió el propio arrastre en web Y mobile — no se
// investigó a fondo por qué, prioridad fue restaurar lo que andaba. El
// problema de "el ícono de rol no abre el menú" pese al tap registrando
// (confirmado con console.log por el usuario) parece NO ser arbitraje
// de gestos — más probable un problema de stacking/z-index del
// AnimatedDropdown anidado tan profundo, a investigar por separado. Solo
// la fila activa se traduce visualmente seteando su propio offset
// (dragOffsetY, compartido en el contexto porque solo una fila se
// arrastra por vez); las demás no se reacomodan en vivo — la línea de
// ReorderDropIndicator ya comunica el destino.
export function ReorderableRow({ index, itemCount, onReorder, children, scrollViewRef }) {
  const { activeIndexSV, targetIndexSV, dragOffsetY, itemCountSV } = useContext(ReorderContext);
  const onReorderRef = useRef(onReorder);

  useEffect(() => {
    onReorderRef.current = onReorder;
    itemCountSV.value = itemCount;
  });

  // from/to llegan como ARGUMENTOS (leídos en el propio worklet de
  // onEnd, antes de diferir a JS con runOnJS), no releídos acá adentro
  // desde los shared values — mismo criterio que checkDrop en
  // DraggableExerciseCard. onFinalize corre justo después de onEnd y
  // resetea esos mismos shared values a -1; si esta función los
  // releyera en vez de recibirlos ya capturados, una carrera entre el
  // runOnJS diferido y el reset síncrono de onFinalize podía dejarlos en
  // -1 antes de que esta función llegara a leerlos — bug real
  // reportado: el reordenamiento no aplicaba en web (visualmente
  // arrastraba bien, pero al soltar no reordenaba).
  const commitReorder = (from, to) => {
    if (from === -1 || to === -1 || from === to) return;
    onReorderRef.current(from, to);
  };

  // Hold SOLO en nativo (2026-09-15): en touch, el mismo dedo que
  // reordena es el que scrollea la lista, hace falta la espera para
  // distinguir una intención de la otra. En web el mouse no tiene ese
  // problema — la rueda/trackpad scrollea vía eventos wheel, que ni
  // pasan por este Pan de gesture-handler (solo reacciona a
  // pointerdown/move) — así que ahí el click-y-arrastrar puede
  // reordenar de inmediato, sin esperar nada, igual que cualquier
  // drag-and-drop de escritorio (Trello, Notion, etc. tampoco piden
  // mantener presionado con mouse).
  // Antes esto estaba fijo en 450ms para ambas plataformas — en web no
  // hacía falta, y de paso perdía sensibilidad: con 300ms, un scroll
  // LENTO deliberado tardaba más en cruzar el umbral de failOffsetY que
  // en llegar al hold, activándose como arrastre en vez de ceder al
  // scroll (motivo original de subirlo a 450, ya no aplica en web al no
  // usarse ninguno de los dos acá).
  let pan = Gesture.Pan().runOnJS(true);
  if (!isWeb) {
    pan = pan.activateAfterLongPress(450).failOffsetY([-10, 10]);
    // simultaneousWithExternalGesture (2026-09-15): relación EXPLÍCITA
    // con el ScrollView vertical que contiene esta fila (via ref) — el
    // Gesture.Native() genérico que había antes acá no apuntaba a nada
    // concreto, y de hecho el scroll seguía sin funcionar bien en mobile
    // real pese a él (bug real reportado). Con esta relación el
    // ScrollView reconoce el toque en simultáneo desde el primer frame
    // en vez de esperar pasivamente a que este Pan falle. El tap en
    // controles anidados (selector de rol, quitar) ya no depende de
    // esto — se resolvió aparte con la capa de arrastre invisible
    // hermana del contenido real (ver el return de este componente).
    if (scrollViewRef) pan = pan.simultaneousWithExternalGesture(scrollViewRef);
  }
  pan = pan
    .onStart(() => {
      activeIndexSV.value = index;
      targetIndexSV.value = index;
      dragOffsetY.value = 0;
    })
    .onUpdate((e) => {
      dragOffsetY.value = e.translationY;
      // Delta de fila con signo (a diferencia de estimateIndexFromOffset,
      // pensada para una distancia siempre positiva desde el top de un
      // contenedor) — acá el desplazamiento es relativo a la fila propia
      // y puede ir para cualquier lado.
      const rowDelta = Math.round(e.translationY / ESTIMATED_ROW_HEIGHT);
      targetIndexSV.value = clampIndex(index + rowDelta, itemCountSV.value);
    })
    .onEnd(() => {
      runOnJS(commitReorder)(activeIndexSV.value, targetIndexSV.value);
    })
    .onFinalize(() => {
      activeIndexSV.value = -1;
      targetIndexSV.value = -1;
      dragOffsetY.value = 0;
    });
  const rowStyle = useAnimatedStyle(() => {
    const isActive = activeIndexSV.value === index;
    return {
      transform: [{ translateY: isActive ? dragOffsetY.value : 0 }, { scale: isActive ? 1.02 : 1 }],
      zIndex: isActive ? 10 : 0,
      opacity: isActive ? 0.95 : 1,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View nativeID={`reorderable-exercise-row-${index}`} style={rowStyle} testID={`reorderable-exercise-row-${index}`}>
        {children}
      </Animated.View>
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
