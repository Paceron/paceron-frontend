import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isWeb } from '../../utils/platform.js';
import { useThemeColors } from '../../theme/colors.js';
import { EXERCISE_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';
import { ESTIMATED_ROW_HEIGHT, estimateIndexFromOffset, clampIndex, reorderList } from './session-reorder-math.js';
import { MOBILE_TOPBAR_HEIGHT } from '../shell/app-mobile-shell.jsx';

export { reorderList };

// Mecánica de arrastre a mano (sin librería de terceros — ver
// docs/superpowers/specs/2026-09-10-sessions-drag-and-drop-design.md
// para el porqué). Estado compartido entre el panel de ejercicios
// (fuente) y la lista de la sesión (destino), vive y muere con el
// modal — no es estado global de la app.
const SessionDragContext = createContext(null);

// Cuánto antes del borde del contenedor (en px de pantalla) empieza a
// autoscrollear, y cuánto scrollea por tick del loop. EDGE chico haría
// falta acercarse demasiado al borde real (mala UX en mobile, donde el
// dedo tapa la zona); STEP grande se siente a los saltos.
const AUTO_SCROLL_EDGE = 56;
const AUTO_SCROLL_STEP = 14;
// Período del loop de autoscroll (ver startAutoScrollLoop) -- ~30
// ticks/s alcanza para que se vea fluido sin saturar el hilo de JS con
// listas largas.
const AUTO_SCROLL_THROTTLE_MS = 33;

// Compartidas entre DraggableExerciseCard (cross-container, catálogo →
// sesión) y ReorderableRow (reordenar DENTRO de la sesión) -- misma
// medición y mismo cálculo de autoscroll, antes solo existían en
// DraggableExerciseCard porque ReorderableRow no lo necesitaba (no
// autoscrolleaba sosteniendo cerca de los bordes mientras reordena un
// ejercicio YA cargado -- bug real, 2026-10-06).
function cacheDropTargetMeasurements(dropTargetRef, targetX, targetY, targetWidth, targetHeight) {
  if (!dropTargetRef.current) return;
  dropTargetRef.current.measureInWindow((x, y, width, height) => {
    targetX.value = x;
    targetY.value = y;
    targetWidth.value = width;
    targetHeight.value = height;
  });
}

function isNearEdge(absoluteY, top, height) {
  const relativeY = absoluteY - top;
  return relativeY < AUTO_SCROLL_EDGE || relativeY > height - AUTO_SCROLL_EDGE;
}

// JS-thread (ambos Pan de este archivo usan `.runOnJS(true)`, así que
// sus callbacks YA corren en el hilo de JS, no como worklets de UI) — el
// offset actual se rastrea por afuera (scrollOffsetRef, actualizado por
// onScroll) porque el ScrollView no tiene forma de preguntar "en qué
// offset estoy ahora", solo de pedirle uno nuevo. scrollOffsetSV se
// actualiza acá también (no solo en onListScroll) para que el indicador
// visual seguro refleje el scroll que ESTE autoscroll programático
// acaba de disparar, sin esperar a que el evento onScroll nativo vuelva.
// compensationSV (opcional): ver startAutoScrollLoop -- solo lo usa
// ReorderableRow, para que la fila arrastrada no se quede atrás del
// contenido que este mismo autoscroll está moviendo.
function maybeAutoScroll(autoScrollRef, scrollOffsetRef, scrollOffsetSV, absoluteY, top, height, compensationSV) {
  if (!autoScrollRef.current) return;
  const relativeY = absoluteY - top;
  let next = null;
  if (relativeY < AUTO_SCROLL_EDGE) {
    next = Math.max(0, scrollOffsetRef.current - AUTO_SCROLL_STEP);
  } else if (relativeY > height - AUTO_SCROLL_EDGE) {
    next = scrollOffsetRef.current + AUTO_SCROLL_STEP;
  }
  if (next === null || next === scrollOffsetRef.current) return;
  const delta = next - scrollOffsetRef.current;
  scrollOffsetRef.current = next;
  scrollOffsetSV.value = next;
  autoScrollRef.current.scrollTo({ y: next, animated: false });
  // El scroll programático mueve TODO el contenido (incluida la fila que
  // se está arrastrando, que es parte de ese mismo contenido) sin que el
  // dedo se haya movido -- sin compensar, la fila se queda "atrás" del
  // punto donde el dedo sigue apoyado en cada tick (bug real reportado,
  // 2026-10-06). Sumar el delta a un offset aparte (no a dragOffsetY
  // directo, que onUpdate pisa con la traslación cruda del dedo en cada
  // evento) cancela ese corrimiento.
  if (compensationSV) compensationSV.value += delta;
}

// Loop de autoscroll continuo, independiente de onUpdate -- antes el
// autoscroll solo se disparaba DENTRO de onUpdate, que gesture-handler
// solo llama cuando el dedo/cursor se MUEVE. Mantenerse quieto cerca de
// un borde (el gesto natural para "quiero seguir scrolleando acá") no
// genera nuevos eventos de movimiento, así que el autoscroll se
// detenía en seco apenas el dedo dejaba de moverse (bug real reportado:
// "va muy trabado" incluso con el throttle ya puesto). Un solo
// setInterval por drag activo (arrancado al entrar a la zona de borde,
// no uno por componente) resuelve esto leyendo la posición MÁS
// RECIENTE conocida del dedo (getPointerY) en cada tick, sin depender
// de que llegue un evento nuevo.
function startAutoScrollLoop(dragCtx, getPointerY, compensationSV) {
  if (dragCtx.autoScrollIntervalRef.current) return;
  dragCtx.autoScrollIntervalRef.current = setInterval(() => {
    maybeAutoScroll(
      dragCtx.autoScrollRef, dragCtx.scrollOffsetRef, dragCtx.scrollOffsetSV,
      getPointerY(), dragCtx.targetY.value, dragCtx.targetHeight.value, compensationSV
    );
  }, AUTO_SCROLL_THROTTLE_MS);
}

function stopAutoScrollLoop(dragCtx) {
  if (dragCtx.autoScrollIntervalRef.current) {
    clearInterval(dragCtx.autoScrollIntervalRef.current);
    dragCtx.autoScrollIntervalRef.current = null;
  }
}

export function SessionDragProvider({ children }) {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Medición del drop target cacheada una vez al empezar el arrastre
  // (no en cada frame) — se usa tanto para el indicador de posición en
  // vivo (isHoveringSV, leído desde un worklet) como para decidir el
  // drop final, sin repetir measureInWindow al soltar.
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const targetWidth = useSharedValue(0);
  const targetHeight = useSharedValue(0);
  const isHoveringSV = useSharedValue(0);
  const [draggedExercise, setDraggedExercise] = useState(null);
  const dropTargetRef = useRef(null);
  // Ref imperativo al ScrollView de la lista destino — para autoscroll.
  // Separado del scroll offset (rastreado por onScroll en el consumidor)
  // porque el ScrollView no tiene forma de preguntar "en qué offset estoy
  // ahora", solo de pedirle uno nuevo (scrollTo).
  const autoScrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  // Mismo offset que scrollOffsetRef, pero como SharedValue -- un ref de
  // JS plano no es legible desde un worklet (onUpdate corre en el hilo de
  // UI). Se usa para corregir el índice de drop final (checkDrop) contra
  // cuánto está scrolleada la lista.
  const scrollOffsetSV = useSharedValue(0);
  // Id del setInterval del loop de autoscroll (ver startAutoScrollLoop) --
  // uno solo compartido entre DraggableExerciseCard y ReorderableRow
  // porque nunca hay dos arrastres activos a la vez.
  const autoScrollIntervalRef = useRef(null);

  return (
    <SessionDragContext.Provider value={{
      dragX, dragY, targetX, targetY, targetWidth, targetHeight, isHoveringSV,
      draggedExercise, setDraggedExercise, dropTargetRef, autoScrollRef, scrollOffsetRef, scrollOffsetSV, autoScrollIntervalRef,
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
  const { autoScrollRef, scrollOffsetRef, scrollOffsetSV } = useContext(SessionDragContext);
  const onListScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = y;
    scrollOffsetSV.value = y;
  };
  return { autoScrollRef, onListScroll };
}

// Estado del hover sobre el target de drop -- ver SessionDropIndicator
// más abajo, se monta una vez dentro del contenedor de ejercicios de la
// sesión.
export function useSessionDropIndicator() {
  const { dragY, targetY, targetHeight, isHoveringSV } = useContext(SessionDragContext);
  return { dragY, targetY, targetHeight, isHoveringSV };
}

const DROP_INDICATOR_HEIGHT = 3;

// Línea horizontal que marca dónde caería el ejercicio si se soltara
// ahora — se monta una sola vez, adentro del `View` con `ref={dropTargetRef}`.
// Sigue la posición real del dedo/cursor (dragY, ya trackeado para
// DragGhost) en vez de "redondear" a un índice de fila estimado -- ese
// cálculo por índice (hoverIndexSV, ya retirado) dependía de
// scrollOffsetSV, que se actualiza con un salto (+14px) en cada
// autoscroll programático en vez de moverse continuo como el scroll
// real: la línea "saltaba" en vez de deslizar (bug real, 2026-10-06,
// "glitchea cerca de los bordes"). Clampeado a [0, altura del
// contenedor] -- sin esto el indicador podía pintarse por fuera del
// contenedor cuando el dedo pasaba el borde (otro bug reportado, mismo
// origen: el índice estimado podía superar la última fila visible).
export function SessionDropIndicator() {
  const colors = useThemeColors();
  const { dragY, targetY, targetHeight, isHoveringSV } = useSessionDropIndicator();
  const style = useAnimatedStyle(() => ({
    opacity: isHoveringSV.value,
    transform: [{ translateY: Math.min(Math.max(dragY.value - targetY.value, 0), Math.max(0, targetHeight.value - DROP_INDICATOR_HEIGHT)) }],
  }));

  return (
    <Animated.View
      nativeID="session-drop-indicator"
      style={[
        { position: 'absolute', left: 8, right: 8, top: 0, height: DROP_INDICATOR_HEIGHT, borderRadius: 2, backgroundColor: colors.primary },
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
  const dragCtx = useContext(SessionDragContext);
  const { dragX, dragY, targetX, targetY, targetWidth, targetHeight, isHoveringSV, setDraggedExercise, dropTargetRef } = dragCtx;

  // Chequeo fresco con la posición final real (absoluteX/Y del propio
  // onEnd), no el `isHoveringSV` acumulado de onUpdate — un arrastre
  // rápido/con pocos frames intermedios puede llegar a onEnd sin que el
  // último onUpdate haya corrido todavía, dejando isHoveringSV desactualizado
  // y el drop se perdía en silencio (bug real: soltar en la lista vacía
  // no cargaba nada). Sigue sin re-medir con measureInWindow — usa los
  // mismos target* cacheados en onStart, solo la comparación es nueva.
  // + scrollOffsetSV.value: mismo ajuste que el indicador visual (ver
  // SessionDropIndicator) -- sin él, el drop real caía en un índice
  // distinto al que la línea mostraba apenas la lista tenía scroll.
  const checkDrop = (absoluteX, absoluteY) => {
    if (targetWidth.value <= 0) return;
    const inside = absoluteX >= targetX.value && absoluteX <= targetX.value + targetWidth.value
      && absoluteY >= targetY.value && absoluteY <= targetY.value + targetHeight.value;
    if (!inside) return;
    const insertIndex = estimateIndexFromOffset((absoluteY - targetY.value) + dragCtx.scrollOffsetSV.value);
    onDropped(exercise, insertIndex);
  };

  // Memoizado (2026-09-16): sin esto, Gesture.Pan() se reconstruye en
  // CADA render y entrega un objeto de gesto nuevo al GestureDetector
  // nativo — inofensivo la mayoría del tiempo, pero si algo dispara un
  // re-render justo después del montaje, el nuevo objeto podía llegar en
  // la ventana crítica de inicialización nativa y desarmar el registro
  // del gesto en silencio (hipótesis del intento 9, ver
  // docs/2026-09-16-session-modal-drag-scroll-investigation.md).
  // Deps: solo lo que el gesto realmente necesita capturar por closure —
  // exercise/onDropped porque van directo en checkDrop, holdMs/
  // scrollViewRef porque cambian la cadena de configuración del Pan.
  const pan = useMemo(() => {
    let p = Gesture.Pan().runOnJS(true);
    if (holdMs) {
      // failOffsetX: si el dedo se mueve más de esto ANTES de cumplirse
      // el hold, el gesto falla de inmediato y libera el toque al
      // ScrollView horizontal (scroll normal de la tira) — sin esto, un
      // swipe rápido para scrollear quedaba capturado por este Pan sin
      // activarse nunca y sin soltar el toque a tiempo para que el
      // ScrollView pudiera scrollear con él (bug real reportado: la tira
      // no scrolleaba nada). activateAfterLongPress solo, sin este tope,
      // no alcanza.
      p = p.activateAfterLongPress(holdMs).failOffsetX([-10, 10]);
      // simultaneousWithExternalGesture: relación EXPLÍCITA con el
      // ScrollView que envuelve esta card (via ref, no un Gesture.Native()
      // genérico sin nada a lo que referenciar) — deja que el ScrollView
      // reconozca el toque en simultáneo desde el primer frame, en vez de
      // esperar pasivamente a que este Pan falle. failOffsetX seguía sin
      // alcanzar solo (bug real: scroll horizontal seguía sin funcionar en
      // mobile incluso con failOffsetX + Gesture.Native() genérico) — sin
      // una relación real hacia el ScrollView específico, gesture-handler
      // no tenía ningún native handler concreto con el que negociar.
      if (scrollViewRef) p = p.simultaneousWithExternalGesture(scrollViewRef);
    }
    return p
      .onStart((e) => {
        stopAutoScrollLoop(dragCtx); // insurance: no debería quedar uno de un drag anterior
        setDraggedExercise(exercise);
        cacheDropTargetMeasurements(dropTargetRef, targetX, targetY, targetWidth, targetHeight);
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
        if (inside && isNearEdge(e.absoluteY, targetY.value, targetHeight.value)) {
          startAutoScrollLoop(dragCtx, () => dragY.value);
        } else {
          stopAutoScrollLoop(dragCtx);
        }
      })
      .onEnd((e) => {
        checkDrop(e.absoluteX, e.absoluteY);
        isHoveringSV.value = 0;
        setDraggedExercise(null);
      })
      .onFinalize(() => {
        stopAutoScrollLoop(dragCtx);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, onDropped, holdMs, scrollViewRef]);

  // Wrapper simple, un solo GestureDetector envolviendo el contenido
  // directo — sin capa de arrastre separada (2026-09-16: la capa
  // separada, con o sin holdMs, nunca llegó a activar el gesto en
  // ningún camino que la usara — ver docs/2026-09-16-session-modal-drag-scroll-investigation.md.
  // Este wrapper simple es el único camino confirmado funcionando desde
  // el principio, panel ancho de escritorio, sin holdMs).
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
// montado — se guarda en un shared value (leído desde onUpdate) y en un
// ref (leído desde onEnd, vía commitReorder) actualizados en cada render
// vía useEffect en ReorderableRow.
export function ReorderProvider({ children }) {
  const activeIndexSV = useSharedValue(-1);
  const targetIndexSV = useSharedValue(-1);
  const dragOffsetY = useSharedValue(0);
  const itemCountSV = useSharedValue(0);
  // Posición absoluta del dedo/cursor mientras se reordena -- separada de
  // dragOffsetY (que es el translateY de la FILA arrastrada, relativo a su
  // propia posición de origen). Se usa solo para pintar
  // ReorderDropIndicator seguido el dedo, igual que SessionDropIndicator.
  const dragAbsoluteY = useSharedValue(0);
  // Corrección acumulada por el autoscroll (ver maybeAutoScroll) -- se
  // SUMA a dragOffsetY al pintar la fila (no se mezcla con dragOffsetY
  // mismo, que onUpdate pisa con la traslación cruda del dedo en cada
  // evento y borraría la corrección en el próximo movimiento).
  const scrollCompensationSV = useSharedValue(0);

  return (
    <ReorderContext.Provider value={{ activeIndexSV, targetIndexSV, dragOffsetY, itemCountSV, dragAbsoluteY, scrollCompensationSV }}>
      {children}
    </ReorderContext.Provider>
  );
}

// Línea que marca dónde caería la fila si se soltara ahora -- mismo
// criterio que SessionDropIndicator (seguir el dedo/cursor en vez de
// redondear a un índice de fila, clampeado al contenedor): acá el salto
// era todavía más notorio porque targetIndexSV es el índice LÓGICO final
// (redondeado al cambiar de fila), no una posición continua -- la línea
// saltaba de fila en fila en vez de deslizar. targetY/targetHeight salen
// de SessionDragContext (mismo contenedor, mismas mediciones que ya
// cachea ReorderableRow#onStart) para poder clampear igual que el otro
// indicador.
export function ReorderDropIndicator() {
  const colors = useThemeColors();
  const { activeIndexSV, dragAbsoluteY } = useContext(ReorderContext);
  const { targetY, targetHeight } = useContext(SessionDragContext);
  const style = useAnimatedStyle(() => ({
    opacity: activeIndexSV.value >= 0 ? 1 : 0,
    transform: [{ translateY: Math.min(Math.max(dragAbsoluteY.value - targetY.value, 0), Math.max(0, targetHeight.value - DROP_INDICATOR_HEIGHT)) }],
  }));

  return (
    <Animated.View
      nativeID="session-reorder-drop-indicator"
      style={[
        { position: 'absolute', left: 8, right: 8, top: 0, height: DROP_INDICATOR_HEIGHT, borderRadius: 2, backgroundColor: colors.primary },
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
  const { activeIndexSV, targetIndexSV, dragOffsetY, itemCountSV, dragAbsoluteY, scrollCompensationSV } = useContext(ReorderContext);
  // SessionDragContext además de ReorderContext (los dos conviven, ver
  // nota de "Contexto propio" más abajo) -- no para el mecanismo de
  // reordenamiento en sí, sino para poder autoscrollear cerca de los
  // bordes del MISMO contenedor que ya mide/scrollea DraggableExerciseCard
  // (dropTargetRef/autoScrollRef/scrollOffsetRef/scrollOffsetSV). Antes
  // de esto, sostener una fila ya cargada cerca del borde del contenedor
  // no hacía nada -- solo el arrastre desde el catálogo autoscrolleaba
  // (bug real, 2026-10-06).
  const dragCtx = useContext(SessionDragContext);
  const { dropTargetRef, targetY, targetHeight, targetX, targetWidth } = dragCtx;
  const onReorderRef = useRef(onReorder);

  useEffect(() => {
    onReorderRef.current = onReorder;
    itemCountSV.value = itemCount;
  });

  // from/to llegan como ARGUMENTOS (leídos en el propio onEnd), no
  // releídos acá adentro desde los shared values — mismo criterio que
  // checkDrop en DraggableExerciseCard. onFinalize corre justo después
  // de onEnd y resetea esos mismos shared values a -1; si esta función
  // los releyera en vez de recibirlos ya capturados, el reset de
  // onFinalize podía dejarlos en -1 antes de que esta función llegara a
  // leerlos — bug real reportado: el reordenamiento no aplicaba en web
  // (visualmente
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
  // Memoizado (2026-09-16), mismo motivo que en DraggableExerciseCard —
  // ver esa nota. Deps: index (necesario en los closures de onStart/
  // onUpdate) y scrollViewRef (cambia la config del Pan); activeIndexSV/
  // targetIndexSV/dragOffsetY/itemCountSV vienen del contexto y son
  // SharedValues estables (su .value se lee fresco en cada worklet sin
  // importar cuándo se memoizó el closure), commitReorder solo reenvía a
  // través de onReorderRef.current (también estable).
  // Compuesto con Gesture.Native() (2026-09-16, vuelta al mecanismo que
  // ya había funcionado en el Intento 3 del dossier de investigación):
  // deja que los controles anidados de SessionExerciseRow (selects,
  // botón de quitar) sigan respondiendo al tap pese a que este Pan
  // envuelve la fila entera como ancestro — gesture-handler reconoce
  // ambos gestos en simultáneo en vez de que el Pan se quede con todo el
  // toque. Reemplaza a la capa de arrastre separada (sibling-overlay,
  // dos intentos entre 2026-09-14 y 2026-09-16): esa capa nunca llegó a
  // activar el gesto en ningún camino que la usara, sin importar el
  // tamaño/timing ajustado — ver docs/2026-09-16-session-modal-drag-scroll-investigation.md.
  const gesture = useMemo(() => {
    let p = Gesture.Pan().runOnJS(true);
    if (!isWeb) {
      p = p.activateAfterLongPress(450).failOffsetY([-10, 10]);
      if (scrollViewRef) p = p.simultaneousWithExternalGesture(scrollViewRef);
    }
    p = p
      .onStart(() => {
        stopAutoScrollLoop(dragCtx); // insurance: no debería quedar uno de un drag anterior
        activeIndexSV.value = index;
        targetIndexSV.value = index;
        dragOffsetY.value = 0;
        scrollCompensationSV.value = 0;
        // Mide el contenedor de la lista -- mismo motivo que
        // DraggableExerciseCard#onStart: sin esto targetY/targetHeight
        // podrían seguir en 0 si todavía no se arrastró nada desde el
        // catálogo en esta sesión del modal/pantalla.
        cacheDropTargetMeasurements(dropTargetRef, targetX, targetY, targetWidth, targetHeight);
      })
      .onUpdate((e) => {
        dragOffsetY.value = e.translationY;
        dragAbsoluteY.value = e.absoluteY;
        // Delta de fila con signo (a diferencia de estimateIndexFromOffset,
        // pensada para una distancia siempre positiva desde el top de un
        // contenedor) — acá el desplazamiento es relativo a la fila propia
        // y puede ir para cualquier lado.
        const rowDelta = Math.round(e.translationY / ESTIMATED_ROW_HEIGHT);
        targetIndexSV.value = clampIndex(index + rowDelta, itemCountSV.value);
        // Autoscroll cerca de los bordes del contenedor -- mismo mecanismo
        // que el cross-container, con la posición ABSOLUTA del dedo
        // (e.absoluteY), no el translationY relativo a la fila de arriba.
        // targetWidth > 0 como guarda: todavía no llegó la medición async
        // de arriba, un alto 0 dispararía el borde inferior en cualquier
        // posición. scrollCompensationSV: ver maybeAutoScroll -- sin esto
        // la fila sostenida se queda atrás del contenido que este mismo
        // autoscroll mueve (bug real reportado).
        if (targetWidth.value > 0 && isNearEdge(e.absoluteY, targetY.value, targetHeight.value)) {
          startAutoScrollLoop(dragCtx, () => dragAbsoluteY.value, scrollCompensationSV);
        } else {
          stopAutoScrollLoop(dragCtx);
        }
      })
      .onEnd(() => {
        commitReorder(activeIndexSV.value, targetIndexSV.value);
      })
      .onFinalize(() => {
        stopAutoScrollLoop(dragCtx);
        activeIndexSV.value = -1;
        targetIndexSV.value = -1;
        dragOffsetY.value = 0;
        scrollCompensationSV.value = 0;
      });
    return Gesture.Simultaneous(p, Gesture.Native());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, scrollViewRef]);
  const rowStyle = useAnimatedStyle(() => {
    const isActive = activeIndexSV.value === index;
    return {
      transform: [{ translateY: isActive ? dragOffsetY.value + scrollCompensationSV.value : 0 }, { scale: isActive ? 1.02 : 1 }],
      zIndex: isActive ? 10 : 0,
      opacity: isActive ? 0.95 : 1,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
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
  // dragX/dragY vienen de e.absoluteX/absoluteY (coordenadas de VENTANA
  // completa). En mobile nativo, este overlay ya no vive dentro de un
  // Modal de pantalla completa (2026-09-16, migrado a pantalla dedicada)
  // — ahora es descendiente de AppMobileShell, cuyo SafeAreaView + barra
  // superior (MOBILE_TOPBAR_HEIGHT) empujan el contenido hacia abajo
  // respecto del borde real de la ventana. Sin descontar ese offset, el
  // fantasma aparecía notoriamente más abajo del dedo real (bug real,
  // reportado tras la migración). En web sigue sin hacer falta: el
  // overlay usa `position: fixed`, que ancla contra el viewport sin
  // importar la jerarquía de ancestros.
  const insets = useSafeAreaInsets();
  const topOffset = isWeb ? 0 : insets.top + MOBILE_TOPBAR_HEIGHT;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - 90 }, { translateY: dragY.value - 24 - topOffset }],
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
