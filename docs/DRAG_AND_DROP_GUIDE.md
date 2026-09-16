# Drag-and-drop / hold-to-drag casero — guía de referencia

**Estado:** resuelto en `feature/catalog-redesign` (2026-09-16), para el módulo de sesiones (`components/plans/session-drag-and-drop.jsx`).

Este documento es la referencia permanente para cualquier trabajo futuro de arrastre/reordenamiento en la app — el próximo caso conocido es el calendario de asignaciones a grupos (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md`), que va a reusar este mismo mecanismo. Complementa (no reemplaza) el historial detallado, minuto a minuto, de `docs/2026-09-16-session-modal-drag-scroll-investigation.md` — ese documento es el "cómo se llegó acá", este es el "qué hacer de acá en adelante".

## Resumen del problema

El drag-and-drop de sesiones (arrastrar del catálogo, reordenar la lista) vivía dentro de un `Modal` con dos capas de `ScrollView` anidadas de la misma orientación. En mobile nativo (Android, Expo Go), el scroll (horizontal del catálogo, vertical de la lista) fallaba de forma persistente durante ~10 rondas de ajuste de gestos, y una "solución" intermedia (separar la superficie de arrastre del contenido visual) rompió la activación del drag en todos los caminos que la usaban, en ambas plataformas.

## Causas raíz confirmadas (dos problemas distintos, no uno)

### 1. Scroll roto en mobile: el `Modal` + `ScrollView`s anidados

`Modal` en React Native monta su contenido en una superficie nativa **separada** del árbol de vistas de la app (confirmado, no solo teórico). Tener un `ScrollView` de la lista (vertical) anidado DENTRO de otro `ScrollView` general del modal (también vertical) es un antipatrón clásico de React Native, independiente de cualquier gesto custom — el arbitraje de touch nativo entre ambos scrolls queda roto a un nivel que ningún ajuste de `activateAfterLongPress`/`failOffset`/`simultaneousWithExternalGesture` puede arreglar, porque el problema no es la configuración del gesto, es la superficie donde vive.

**Confirmado empíricamente:** migrar la creación/edición de sesiones de `Modal` a una pantalla dedicada (sin ningún cambio de gestos en el mismo commit) resolvió el scroll horizontal y vertical en mobile de punta a punta. Un dato adicional que apuntaba en la misma dirección desde antes de la migración: con sonido de sistema activado, cualquier touch dentro del modal producía el sonido de "click" de Android en el `ACTION_UP` **sin importar el movimiento intermedio** — señal de que el ciclo de touch se resolvía como tap a nivel nativo, no que el gesto tardara en activarse.

### 2. Drag/reorder nunca se activaba: la capa de arrastre separada ("sibling-overlay")

En un momento de la investigación (mientras se sospechaba que el problema de arriba era de gestos, no del Modal), se intentó separar la superficie que escucha el `Pan` del contenido visual real — una `View`/`Animated.View` invisible, `position: absolute`, hermana del contenido (no ancestro), pensada para que los controles anidados (selects, botón de quitar) no compitieran por el mismo `GestureDetector` que el fondo de la fila/card.

**Este patrón nunca funcionó, en ningún intento (2 rondas, con distintas estrategias de medición de tamaño) ni en ninguna plataforma.** El único camino que SIEMPRE activó el drag correctamente fue el más simple: un solo `GestureDetector` como ANCESTRO, envolviendo el contenido directo — sin ninguna capa separada. La causa exacta de por qué el sibling-overlay no llegaba a recibir el toque inicial no se confirmó con instrumentación (no se llegó a medir con logs nativos), pero la hipótesis más consistente con la evidencia es orden de pintado/stacking: en React Native (y en React Native Web, donde además toda `View` es `position: relative` por default), un hermano declarado DESPUÉS en el JSX pinta/intercepta el toque por encima de un hermano `position: absolute` declarado antes, salvo que se fuerce explícitamente lo contrario — el contenido visual (declarado segundo) quedaba encima de la capa de arrastre invisible (declarada primero), así que el toque nunca llegaba al `GestureDetector`.

## La solución que quedó funcionando

Ver `components/plans/session-drag-and-drop.jsx` como referencia de código — acá el resumen de las piezas:

1. **Pantalla dedicada en vez de `Modal`, para cualquier flujo con listas scrolleables + drag en mobile.** `components/plans/create-session-screen.jsx`/`edit-session-screen.jsx` (rutas bajo `app/(tabs)/training-plans/sessions/`), mismo patrón que `create-training-plan-screen.jsx`. Web sigue usando el `Modal` (`create-session-modal.jsx`) sin este problema, porque el mouse no compite por el mismo gesto que el scroll (ver punto 4).

2. **Un solo `GestureDetector` como ancestro, sin capas separadas.** `DraggableExerciseCard` y `ReorderableRow` envuelven el contenido directo. Para que los controles anidados (select de rol/ejercicio, botón de quitar) sigan respondiendo al tap pese al `Pan` ancestro, `ReorderableRow` compone `Gesture.Simultaneous(pan, Gesture.Native())` — esta combinación específica ya estaba confirmada funcionando antes de los intentos de sibling-overlay, y se volvió a confirmar al revertir.

3. **`Gesture.Pan()` memoizado con `useMemo`, con dependencias acotadas.** Sin memoizar, el objeto de gesto se reconstruye en cada render; si algo dispara un re-render justo después del montaje (ej. un `setState` en un `onLayout`), el `GestureDetector` nativo puede recibir un gesto "nuevo" en la ventana crítica de inicialización y desarmar el registro en silencio. Cualquier medición de layout que alimente el comportamiento del gesto (alto de fila, tamaño de card) debe guardarse en un `useSharedValue`, nunca en `useState` — escribir un SharedValue no dispara re-render de React.

4. **Configuración del `Pan` diferenciada por plataforma, no la estructura del componente.** En touch, el mismo dedo que arrastra es el que scrollea — hace falta `activateAfterLongPress(ms)` + `failOffsetX/Y([-10,10])` para distinguir intención, y `simultaneousWithExternalGesture(scrollViewRef)` para que el `ScrollView` correspondiente reconozca el toque en simultáneo. En mouse, la rueda/trackpad scrollea vía eventos `wheel` que ni pasan por el `Pan` de gesture-handler — no hace falta hold ni failOffset, el click-y-arrastrar se activa de inmediato. Esto se resuelve con un `if (!isWeb) { ... }` sobre la construcción del `Pan`, **no** con dos implementaciones de componente distintas — la estructura del `GestureDetector`/wrapper es la misma en ambas plataformas.

5. **Overlays que siguen el dedo con coordenadas absolutas de ventana (`e.absoluteX/Y`): verificar SIEMPRE contra qué ancestro se posicionan.** `DragGhost` usa `position: 'fixed'` en web (ancla al viewport, sin importar la jerarquía) pero `position: 'absolute'` en nativo (ancla al ancestro posicionado más cercano). Antes de la migración a pantalla dedicada, ese ancestro era el host de pantalla completa del `Modal` — coincidía exactamente con la ventana, sin offset. Al migrar a una pantalla normal (bajo `AppMobileShell`, que agrega `SafeAreaView` + una barra superior de altura fija), ese ancestro ya NO arranca en el borde real de la ventana — hubo que restar explícitamente ese offset (`useSafeAreaInsets().top + MOBILE_TOPBAR_HEIGHT`) de las coordenadas antes de aplicarlas como `transform`. Mismo patrón general que ya existía para `AnimatedDropdown`/`RunnerMenu` en otras partes del código: **medir/conocer el offset real entre "coordenadas de ventana" y "coordenadas del ancestro donde se posiciona algo", nunca asumir que son iguales.**

## Lineamientos para el próximo trabajo de drag-and-drop (ej. calendario de asignaciones)

- **No uses `Modal` para un flujo con listas scrolleables + drag/hold-and-drag en mobile.** Si el flujo ya tiene (o va a tener) más de un `ScrollView` en la misma jerarquía, evaluá una pantalla dedicada desde el diseño, no como arreglo posterior.
- **Empezá siempre por el mecanismo más simple: un solo `GestureDetector` ancestro envolviendo el contenido, sin capas separadas.** Si hace falta que controles anidados sigan respondiendo al tap, probá `Gesture.Simultaneous(pan, Gesture.Native())` primero — es la combinación que demostradamente funciona en este código. No inventes una capa de arrastre separada salvo que tengas evidencia concreta (no solo una sospecha) de que el ancestro simple no alcanza, y si la probás, validala en dispositivo real ANTES de asumir que resuelve algo.
- **Memoizá cualquier `Gesture.Pan()`/gesto compuesto con `useMemo`**, con dependencias acotadas a lo que el gesto realmente necesita capturar por closure. Cualquier medición de layout que alimente al gesto va en `useSharedValue`, nunca en `useState`.
- **Diferenciá por plataforma la CONFIGURACIÓN del gesto (hold, failOffset, simultaneousWithExternalGesture), no la estructura del componente.** Un `if (!isWeb) {...}` sobre la construcción del `Pan` alcanza — no hace falta (ni conviene) un componente distinto por plataforma.
- **Todo overlay con `position: absolute` posicionado con coordenadas de ventana necesita que confirmes explícitamente contra qué ancestro se ancla**, y restar cualquier offset real (safe area, barras de navegación/chrome propio) antes de aplicar esas coordenadas como transform/estilo.
- **La verificación real en dispositivo es obligatoria para cualquier cambio de gestos — el preview web no alcanza.** Los eventos sintéticos de puntero no reproducen de forma confiable el timing/arbitraje real de un gesto. Cambios en esta área se prueban en Expo Go (o dispositivo real) antes de darlos por resueltos.

## Referencias de código

- `components/plans/session-drag-and-drop.jsx` — mecánica de gestos completa (`SessionDragProvider`, `DraggableExerciseCard`, `DragGhost`, `SessionDropIndicator`, `ReorderProvider`, `ReorderableRow`, `ReorderDropIndicator`).
- `components/plans/create-session-screen.jsx` / `edit-session-screen.jsx` — pantallas dedicadas nativas, patrón a replicar para cualquier flujo similar futuro.
- `components/plans/create-session-modal.jsx` — sigue usando `Modal` en web, sin el problema de scroll/drag descripto acá.
- `components/shell/app-mobile-shell.jsx` — `MOBILE_TOPBAR_HEIGHT`, exportado para cualquier cálculo de offset contra la ventana completa en pantallas nativas.
- `docs/2026-09-16-session-modal-drag-scroll-investigation.md` — historial completo, minuto a minuto, de los ~10 intentos fallidos previos a la solución de arriba.
- `docs/superpowers/specs/2026-09-16-session-dedicated-screen-design.md` / `docs/superpowers/plans/2026-09-16-session-dedicated-screen.md` — spec y plan de la migración a pantalla dedicada.
