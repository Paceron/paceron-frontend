# Investigación: conflicto drag-and-drop vs. scroll en el modal de sesiones

**Fecha:** 2026-09-16
**Rama:** `feature/catalog-redesign`
**Estado:** sin resolver — documento de investigación para decidir cómo seguir, no un plan de acción todavía.
**Autor del documento:** generado por el agente de IA a pedido del usuario, en base al historial completo de esta rama de trabajo.

## Resumen ejecutivo

Se intentó implementar un sistema de drag-and-drop casero (sin librería externa) para el modal de creación/edición de sesiones de entrenamiento, con dos mecanismos:

1. **Cross-container:** arrastrar una card de ejercicio desde un catálogo (panel lateral en desktop, tira horizontal con scroll en mobile/narrow) hacia la lista de ejercicios de la sesión, para agregarlo.
2. **Reordenamiento in-place:** mantener presionada una fila de la lista de ejercicios de la sesión y arrastrarla para reordenar, en reemplazo de botones subir/bajar.

Ambos mecanismos conviven, en las mismas pantallas, con **contenedores scrolleables** (la tira horizontal del catálogo, la lista vertical de ejercicios de la sesión, y el scroll vertical general del modal). El problema central de toda esta investigación es: **gesture-handler no logra arbitrar de forma confiable entre "el usuario quiere arrastrar" y "el usuario quiere scrollear"**, cuando ambos gestos usan el mismo dedo/mouse sobre el mismo contenedor.

Después de múltiples rondas de intentos (detalladas abajo), el estado actual es:
- **Web:** cross-container funciona. El reordenamiento in-place se rompió en el último intento (antes funcionaba).
- **Mobile (Expo Go, dispositivo real):** nada funciona bien — ni cross-container, ni reordenamiento in-place, ni el scroll (horizontal de la tira, vertical de la lista de ejercicios).
- **Dato más raro y sin explicar del todo:** con el teclado en pantalla (lo que reduce el alto visible del modal), **todo functiona perfecto** — cross-container, reordenamiento y ambos scrolls — en cualquier punto de la pantalla. Sin teclado, el scroll vertical de la lista de ejercicios "casi" funciona si el toque arranca sobre un `select`/botón, pero no si arranca sobre el fondo de una fila.

El usuario pidió este documento para investigar por fuera de la sesión de trabajo actual antes de decidir cómo seguir. La intención declarada es migrar la creación de sesiones a una **pantalla dedicada** (en vez de un `Modal`), pero **mantener el sistema de gestos** porque se planea reusarlo para el próximo sub-proyecto (asignación de planes/sesiones a grupos por arrastre, sobre un calendario).

---

## Contexto de plataforma

| Paquete | Versión |
|---|---|
| `expo` | ~54.0.37 |
| `react-native` | 0.81.5 |
| `react-native-gesture-handler` | ~2.28.0 |
| `react-native-reanimated` | ~4.1.1 |
| `react-native-web` | ^0.21.0 |

- **New Architecture (Fabric) habilitada** (`newArchEnabled: true` en `app.config.js`) — relevante porque hay quirks ya documentados de APIs legacy (`measureLayout`) que fallan en silencio bajo Fabric en Android (ver `CLAUDE.md`, sección "Quirks conocidos").
- **Verificación real:** el proyecto tiene un preview web (React Native Web) usable para layout/lógica, pero **no puede simular de forma confiable el timing real de gestos táctiles** (activación de long-press, arbitraje contra scroll nativo) — los eventos de puntero sintéticos disponibles en las herramientas de preview no reproducen con fidelidad suficiente el comportamiento real de un dispositivo. Todo lo reportado como "funciona"/"no funciona" en este documento viene de pruebas manuales del usuario en **Expo Go, dispositivo Android real** (mobile) y en el navegador real (web) — no de la herramienta de preview automatizada.
- **Metodología de trabajo:** por pedido explícito del usuario, en las últimas rondas dejé de usar la herramienta de preview automatizada para verificar (para ahorrar tokens) — el usuario prueba él mismo y reporta.

### Arquitectura relevante de la app

- **`react-native`'s `Modal` en nativo monta su contenido en una superficie nativa SEPARADA** del árbol de vistas de la app — el `GestureHandlerRootView` que envuelve toda la app (`app/_layout.jsx`) no alcanza ahí. Esto ya causó un bug real (modal completamente en blanco en Expo Go) resuelto agregando un `GestureHandlerRootView` propio dentro del `Modal`. En React Native Web, el `Modal` es solo una `View` con estilos (no una superficie nativa aparte) — por eso este tipo de problema nunca se manifiesta ahí de la misma forma.
- **Responsive por JS, no por CSS breakpoints:** la app decide layout ancho vs. angosto con `useWindowDimensions()`/hooks propios (`useIsNarrowWeb`), no con clases `sm:`/`lg:` de Tailwind. El modal de sesiones tiene dos variantes de layout completas (`SessionModalWideBody` para desktop, `SessionModalNarrowBody` para mobile/narrow-web) que comparten la mecánica de drag pero difieren en estructura visual.
- **NativeWind (`className`) sobre `View`/`Pressable` normales funciona bien, pero `Animated.View` de `react-native-reanimated` NO aplica NINGUNA clase de NativeWind** (bug ya documentado y confirmado con `getComputedStyle`) — cualquier estilo en un `Animated.View` de este sistema va en `style` inline, nunca en `className`.

---

## Objetivo original (qué se quiso construir)

Un sistema de drag-and-drop **enteramente casero**, sobre `react-native-gesture-handler` + `react-native-reanimated` directo (sin librería de terceros), reusable a futuro. Piezas:

- `SessionDragContext` (React Context): estado compartido del drag cross-container — posición del dedo/mouse (`dragX`/`dragY`, shared values), bounds cacheados del contenedor destino, índice de hover para el indicador de posición, referencia al `ScrollView` destino para autoscroll.
- `DraggableExerciseCard`: envuelve una card del catálogo (ya sea en el panel ancho de escritorio o en la tira horizontal de mobile/narrow) con un gesto `Pan`. Al soltar dentro del contenedor de la lista de la sesión, dispara `onDropped(exercise, insertIndex)`.
- `DragGhost`: overlay visual que sigue al dedo/mouse mientras se arrastra, mostrando una réplica de la card.
- `SessionDropIndicator`: línea que marca la posición estimada de inserción durante un drag cross-container activo.
- `ReorderProvider` / `ReorderableRow`: mecanismo separado para reordenar la lista de ejercicios DE LA SESIÓN mediante mantener-presionado-y-arrastrar sobre la fila entera (sin botones).
- `ReorderDropIndicator`: línea análoga a `SessionDropIndicator`, pero para el reordenamiento in-place.

Archivos principales:
- `components/plans/session-drag-and-drop.jsx` (557 líneas) — toda la mecánica de gestos.
- `components/plans/create-session-modal.jsx` (608 líneas) — el modal en sí, con las dos variantes de layout (ancho/angosto) y las filas de ejercicio.
- `components/plans/session-exercise-panel.jsx` (198 líneas) — el catálogo de origen del drag (panel ancho o tira horizontal).

### Por qué sin librería externa

Se evaluó y descartó `react-native-drax` (v1.1.0) el mismo día que arrancó este trabajo: el gesto de reordenar por drag-handle (`DraxHandle`) nunca se activó con mouse real en 2 pruebas separadas, y coincidió con un crash total del modal en Expo Go (pantalla en blanco). Investigando la librería (leyendo su código compilado, no solo el README), se confirmó que v1.1.0 es una reescritura pensada para **Reanimated 4 y Gesture Handler 3** — pese a declarar `react-native-gesture-handler >=2.0.0` como peer dependency mínima, en la práctica necesita v3. Este proyecto está en gesture-handler v2.28. Se revirtió por completo (`npm uninstall react-native-drax`) y no se volvió a intentar.

---

## Por qué el problema es difícil: dos gestos de "arrastre" compitiendo con scroll real

El núcleo del problema: en **touch (mobile)**, el mismo dedo que arrastra un ejercicio o reordena una fila es el ÚNICO mecanismo de input, y es EL MISMO mecanismo que se usa para scrollear. gesture-handler tiene que decidir, gesto por gesto, "esto es un scroll" vs. "esto es un arrastre" — y esa decisión hay que tomarla ANTES de saber con certeza qué quiso hacer el usuario.

En **web (mouse)**, en cambio, el scroll normalmente NO pasa por el mismo canal que un click-y-arrastre: la rueda del mouse / trackpad dispara eventos `wheel`, que ni siquiera llegan al `Pan` de gesture-handler (que solo reacciona a `pointerdown`/`pointermove`). Esto llevó a una división de estrategia por plataforma (ver más abajo) que en teoría debería simplificar el problema en web — pero en la práctica el reordenamiento in-place se rompió en web también en el último intento, así que esa simplificación no evitó la regresión final.

### La herramienta usada: `Gesture.Pan().activateAfterLongPress(ms)`

API nativa de gesture-handler v2 (no una librería nueva): un gesto `Pan` que no se activa hasta que el dedo se mantiene quieto (dentro de cierta tolerancia) durante `ms` milisegundos. La idea: mientras el Pan "espera" el hold, un movimiento normal de scroll debería "fallar" el gesto y cederle el toque al `ScrollView` contenedor.

Complementos usados para intentar afinar esta arbitraje:
- **`failOffsetX`/`failOffsetY([-N, N])`**: si el dedo se mueve más de `N` px en el eje dado ANTES de cumplirse el hold, el gesto falla de inmediato (en teoría) y libera el toque.
- **`Gesture.Simultaneous(pan, otroGesto)`**: composición que permite que dos gestos se reconozcan "en simultáneo" en vez de que uno bloquee al otro.
- **`Gesture.Native()`**: gesto "vacío" pensado para envolver un componente nativo (ej. un `Pressable`) y dejar que gesture-handler lo reconozca en paralelo a otro gesto activo cerca. Usado genéricamente (sin referenciar nada en particular) en varios intentos.
- **`pan.simultaneousWithExternalGesture(ref)`**: relación EXPLÍCITA (no genérica) entre el `Pan` y otro componente/gesto referenciado por un `ref` real — pensada para reemplazar el `Gesture.Native()` genérico de arriba con algo que gesture-handler pueda resolver de verdad.
- **`pan.runOnJS(true)`**: declara explícitamente que los callbacks del gesto corren en el hilo de JS (no como worklets de UI thread) — agregado para silenciar un warning de gesture-handler ("None of the callbacks in the gesture are worklets"), sin intención de cambiar comportamiento funcional.

---

## Cronología detallada de intentos (con hipótesis, implementación y resultado)

Esta sección es el corazón del documento — cada intento documenta qué se pensó que iba a pasar, qué se hizo, y qué pasó en realidad.

### Intento 0 — Base funcional (antes de esta investigación)

Cross-container drag (catálogo → lista de sesión) funcionando en **web únicamente** (nunca confirmado en dispositivo nativo en esta etapa). Reordenamiento in-place todavía con botones arriba/abajo (sin drag). Esta fue la base sobre la que se construyó todo lo que sigue.

### Intento 1 — Modal completamente en blanco en Expo Go

**Síntoma:** al abrir el modal de crear sesión en Expo Go (mobile nativo), solo se veía el título y los botones de acción — ningún campo, ningún contenido, sin ningún error en consola.

**Hipótesis:** al principio se sospechó de código sobrante de la librería `react-native-drax` recién revertida.

**Causa real encontrada:** `react-native`'s `Modal` monta su contenido en una superficie nativa separada del árbol de vistas de la app — el `GestureHandlerRootView` que envuelve toda la app (en `app/_layout.jsx`) no llega ahí en nativo. Sin uno propio adentro del `Modal`, cualquier gesto queda mudo en nativo, sin ningún error. En web esto nunca se manifestó porque el `Modal` de `react-native-web` es solo una `View` con estilos.

**Fix:** agregar un `<GestureHandlerRootView style={{flex: 1}}>` propio, envolviendo todo el contenido del `Modal`.

**Resultado:** el modal volvió a renderizar contenido en Expo Go. Este fix se mantuvo estable durante todo el resto de la investigación (nunca se identificó como causa de problemas posteriores).

### Intento 2 — Primer ida y vuelta con `activateAfterLongPress` + `failOffset`

**Síntoma reportado tras el fix de arriba:** el scroll (horizontal de la tira de catálogo, vertical de la lista de ejercicios de la sesión) quedaba bloqueado apenas se tocaba una card/fila, incluso sin llegar a activarse el drag.

**Hipótesis:** sin `failOffsetX`/`failOffsetY`, un intento de scroll (swipe rápido, sin hold) quedaba atrapado por el `Pan` sin activarse nunca y sin soltar el toque a tiempo para que el `ScrollView` lo tomara.

**Fix:** agregar `failOffsetX([-10, 10])` (tira horizontal) / `failOffsetY([-10, 10])` (lista vertical) al `Pan`.

**Resultado parcial:** mejoró algo, pero surgieron 2 problemas más finos:
- **Controles anidados (`Pressable`, selects) dejaban de responder al tap** dentro de una fila con `GestureDetector` — el `Pan` se quedaba con el toque incluso para un tap corto.
- **Warning cosmético** de gesture-handler sobre workletización de callbacks.

**Fixes aplicados:**
- `Gesture.Simultaneous(pan, Gesture.Native())` en vez de pasar el `Pan` solo al `GestureDetector`.
- `.runOnJS(true)` en el gesto, para declarar explícita la intención y sacar el warning.

### Intento 3 — Confirmado en Expo Go: reorder y scroll vertical "funcionan", scroll horizontal y tap anidado seguían rotos

Con los fixes del intento 2, el usuario confirmó en dispositivo real: el reordenamiento por hold-and-drag y el scroll VERTICAL de la lista de ejercicios de la sesión ya funcionaban. Pero:

- **Scroll horizontal de la tira de catálogo seguía sin funcionar pese a `failOffsetX`.** Causa identificada: `failOffsetX` solo no alcanzaba — hacía falta ADEMÁS `Gesture.Simultaneous(pan, Gesture.Native())` en el propio `DraggableExerciseCard` (que antes solo tenía el `Pan` solo). La diferencia entre "vertical ya andaba" y "horizontal seguía roto" era exactamente esa: a `ReorderableRow` sí se le había agregado el `Simultaneous(pan, Native())`, a `DraggableExerciseCard` no.
- **Controles anidados adentro de una fila reordenable seguían sin responder al tap** (ícono de rol de un ejercicio, confirmado roto por el usuario) pese al `Simultaneous(pan, Native())` a nivel de LA FILA. Ese `Native()` a nivel de fila resolvía el arbitraje con el `ScrollView` hermano (por eso el scroll vertical ya andaba), pero NO alcanzaba para que un `Pressable` anidado varios niveles adentro recibiera el tap — dos problemas de arbitraje distintos.

**Fix aplicado (para el tap anidado):** envolver cada control interactivo puntual (selector de rol, botón de quitar, el wrapper del select de ejercicio) con su PROPIO `<GestureDetector gesture={Gesture.Native()}>`, individual — no alcanzaba con ponerlo una sola vez arriba en la fila.

### Intento 4 — Primera versión de "separar la capa de arrastre del contenido" (sibling-overlay v1), revertida el mismo día

**Idea:** en vez de que el `Pan`/`GestureDetector` envuelva el contenido real de la fila como ANCESTRO, ponerlo en una capa INVISIBLE, HERMANA del contenido (no ancestro) — `position: absolute, inset: 0` sobre un contenedor `position: relative`, confiando en que Yoga la auto-dimensionara copiando el tamaño de su hermano en flujo normal (el contenido real).

**Motivación:** con el sistema de touch nativo, un elemento dibujado ENCIMA (el contenido real, sin ningún `GestureDetector` ancestro) gana el hit-test en ese punto sin competir por ningún gesto — evitando el problema de arbitraje de raíz en vez de intentar resolverlo con más configuración.

**Resultado: rompió el propio arrastre por completo, en web Y en mobile.** No se investigó la causa exacta antes de revertir — la prioridad en ese momento fue restaurar lo que andaba (confirmado funcionando) en vez de seguir iterando a ciegas sobre una hipótesis ya débil.

**Revertido el mismo día** a la versión anterior (un solo `GestureDetector` envolviendo el contenido, `Gesture.Simultaneous(pan, Gesture.Native())`, sin capa separada).

Lo que sí quedó confirmado y NO se tocó en la reversión:
- El hold subido de 300ms a 450ms (motivo: con 300ms, un swipe LENTO deliberado podía tardar más en cruzar el umbral de `failOffsetX/Y` que en llegar al hold, activando el `Pan` como arrastre antes de fallar por movimiento).
- El reordenamiento unificado en ambos layouts (ancho ahora también usa `ReorderableRow` en vez de botones arriba/abajo) — pero como el reordenamiento entero volvió a fallar tras el intento de sibling-overlay, esto tampoco quedó confirmado funcionando en NINGUNO de los dos layouts al momento de esa reversión.

### Intento 5 — El ícono de rol que no abría el menú: NO era arbitraje de gestos

**Contexto:** en paralelo a los intentos de arbitraje de gestos, había un componente custom (`SessionRoleClosedSelect`) con su propio dropdown (`AnimatedDropdown`) para elegir el rol de un ejercicio (entrada en calor / principal / vuelta a la calma) en mobile/narrow. Reportado roto: el ícono no abría el menú.

**Diagnóstico:** un `console.log` del usuario en el handler del botón confirmó que el `onPress` SÍ llegaba — la hipótesis de gestos (tap swallowed por el `Pan` ancestro) estaba descartada de entrada para este caso puntual.

**Causa real:** `AnimatedDropdown` (componente compartido, `components/shared/animated-dropdown.jsx`) se posiciona con `top`/`left` relativos al ANCESTRO POSICIONADO MÁS CERCANO, no a la pantalla — pero `measureInWindow` (usado para calcular esos `top`/`left`) da coordenadas de PANTALLA. El trigger estaba anidado muy profundo (dentro de `ReorderableRow`, con su propio `transform` animado, dentro de una fila, dentro de un `Modal`) — las coordenadas de pantalla, aplicadas tal cual, no correspondían a dónde el panel realmente terminaba renderizado.

**Fix aplicado (parche puntual, luego reemplazado por completo, ver más abajo):** montar `AnimatedDropdown` una sola vez arriba (no por fila), midiendo cada trigger contra un contenedor de referencia estable y restando coordenadas — patrón ya usado en otra pantalla del proyecto (`exercises-catalog-tab.jsx`).

**Reemplazo definitivo:** a pedido del usuario ("no se puede usar el componente que ya tenemos para que en mobile use un select mobile como el resto de la app y en web un select normal"), se eliminó `SessionRoleClosedSelect` y `SessionRoleSegmentedPicker` por completo, reemplazados por el `ResponsiveSelectField` compartido de todo el proyecto (regla estricta ya existente en `CLAUDE.md`: ningún componente fuera de `forms/fields.jsx`/`responsive-select-field.jsx` debe armar su propio selector). **Esto resolvió el problema del ícono de rol de raíz** (confirmado por el usuario) y de paso simplificó bastante el código, eliminando ~114 líneas. Limitación aceptada y anotada como pulido futuro: un `<select>` nativo (web) no puede mostrar íconos en el estado cerrado ni dentro de las opciones — es una limitación dura del elemento HTML, no algo que falte implementar.

### Intento 6 — División de estrategia por plataforma: hold solo en nativo

**Hipótesis del usuario (correcta, confirmada):** en touch, el mismo dedo que arrastra es el que scrollea, de ahí la necesidad del hold. En web, el mouse no tiene ese problema — la rueda/trackpad scrollea vía eventos `wheel`, que ni pasan por el `Pan` de gesture-handler. En web, el click-y-arrastrar debería activarse de inmediato, sin hold, como cualquier drag-and-drop de escritorio (Trello, Notion, etc. tampoco piden mantener presionado con mouse).

**Fix:** condicionar `activateAfterLongPress`/`failOffsetX`/`failOffsetY` a `!isWeb`, tanto en `DraggableExerciseCard` como en `ReorderableRow`. En web, el `Pan` queda sin hold, activación inmediata.

**Resultado reportado por el usuario:** "en web quedo todo bien" (cross-container y reordenamiento funcionando, con un comentario menor sobre que el indicador de posición se ve "un poco raro" pero aceptable). En mobile, sin cambios (el hold en nativo se mantuvo igual, 450ms).

### Intento 7 — `simultaneousWithExternalGesture`, primer intento de relación explícita con el `ScrollView`

**Contexto:** el `Gesture.Native()` genérico usado hasta acá (sin referenciar nada en particular) no establece ninguna relación real con el `ScrollView` específico que envuelve la card/fila — se sospechó que por eso el scroll en mobile seguía necesitando un gesto brusco para funcionar alguna vez.

**Fix:** pasar un `ref` real (`useRef(null)`, colgado del `ScrollView` de gesture-handler vía `ref={miRef}`) hacia la card/fila, y llamar `pan.simultaneousWithExternalGesture(miRef)` — API de gesture-handler v2, acepta directo un ref a un componente (no hace falta `.withRef()` ni relación legacy). Se quitó el `Gesture.Native()` genérico, reemplazado por esta relación explícita en ambos componentes.

**Resultado reportado:** sin mejora — "en mobile no funcionan bien ni el scroll horizontal ni el vertical". El scroll vertical fallaba salvo que arrancara desde un input/select/botón; el horizontal solo con un movimiento muy brusco, o "funcionaba bien" de forma rara cuando el teclado en pantalla achicaba el modal.

### Intento 8 — Diagnóstico: ¿timing o relación rota?

Ante la ambigüedad (¿es una carrera contra el timer del hold, o la relación con el `ScrollView` simplemente no funciona?), se propuso un experimento diagnóstico: subir el hold a un valor absurdo (5000ms) temporalmente. Si con eso el scroll funcionaba perfecto en cualquier punto, sería timing (arreglable con mejor configuración). Si seguía fallando igual, la relación no estaría funcionando en absoluto.

**Resultado del experimento:** con 5000ms de margen, el scroll SEGUÍA fallando exactamente igual — vertical solo funcionando si arrancaba desde un input/select/botón, horizontal solo con movimiento brusco. **Esto descartó definitivamente que fuera un problema de timing/carrera.**

**Conclusión:** `simultaneousWithExternalGesture` no estaba logrando una relación real de convivencia — el `Pan`, al envolver directamente el contenido interactivo como ancestro, sigue reteniendo el toque indefinidamente salvo que el toque arranque sobre un control nativo (que esquiva el `Pan` de entrada por ganar el hit-test al estar dibujado encima).

### Intento 9 — Segunda versión de "separar la capa de arrastre" (sibling-overlay v2, con `onLayout`), rompió TODO de nuevo

**Hipótesis revisada:** quizás el sibling-overlay v1 (intento 4) rompió todo porque Yoga no resolvía bien la auto-medición de la capa invisible (`inset: 0`) contra su hermano en un solo pase de layout. Esta vez, en vez de confiar en esa auto-medición, medir el tamaño real del contenido con `onLayout` y aplicarlo explícito (`height`/`width`) a la capa de arrastre — nada que Yoga tuviera que inferir.

**Implementación:** tanto `ReorderableRow` como `DraggableExerciseCard` (cuando tiene `holdMs`, o sea, en el layout mobile/narrow) pasaron a tener: un contenedor `position: relative`, una capa `GestureDetector` + `View` invisible `position: absolute` con tamaño explícito (`rowHeight`/`cardSize`, guardados en `useState`), y el contenido real como hermano normal con un `onLayout` que actualiza ese estado.

**Resultado: volvió a romper todo, de nuevo, en ambas plataformas.** Reportado por el usuario: en web se rompió el reordenamiento in-place (cross-container seguía andando). En mobile, "es aun peor" — ni cross-container ni reordenamiento in-place funcionan, y el scroll sigue con los mismos síntomas de antes (vertical solo desde inputs/selects, horizontal solo con teclado en pantalla).

**Hipótesis actual (sin confirmar) para por qué esto también rompió todo:** `onLayout` dispara un `setState` (`rowHeight`/`cardSize`), lo que fuerza un re-render. El objeto `Gesture.Pan()` se reconstruye desde cero en cada render (no está memoizado) — si `onLayout` dispara ese `setState` una vez por fila/card justo después de montar (casi simultáneo en una lista con varios ítems), el `GestureDetector` recibe un objeto de gesto NUEVO poco después del montaje inicial, lo que podría estar desarmando el registro nativo del gesto justo en ese momento. Esto explicaría por qué se rompió TODO (no solo el scroll) y por qué el ÚNICO camino que sigue andando (cross-container en el panel ancho de escritorio, sin `holdMs`) es también el ÚNICO que NO usa este patrón de `onLayout` + `setState`.

**Esta hipótesis no fue investigada más a fondo — es el punto donde se decidió pausar y pedir este documento.**

---

### Intento 10 — Memoización (`useSharedValue` + `useMemo`) para la hipótesis del intento 9, y un dato empírico nuevo que reabre la investigación

**Contexto:** tras research externa (dos rondas, documentadas más abajo en "Hallazgos de una research externa"), la hipótesis del intento 9 subió de confianza con una explicación técnica concreta: `Gesture.Pan()` sin memoizar se reconstruye en cada render; el `setState` de `onLayout` dispara ese re-render justo después del montaje, entregando un gesto nuevo al `GestureDetector` nativo en la ventana crítica.

**Implementación:** `rowHeight`/`cardSize` migraron de `useState` a `useSharedValue` (escribir un SharedValue no dispara re-render de React); la capa de arrastre pasó de `View` con `style` estático a `Animated.View` con `useAnimatedStyle` leyendo esos SharedValues; el propio `Gesture.Pan()` de `DraggableExerciseCard` y `ReorderableRow` se envolvió en `useMemo` (deps acotadas a lo que el gesto realmente necesita: `index`/`scrollViewRef`, y `exercise`/`onDropped`/`holdMs`/`scrollViewRef` respectivamente). `npm test` (296/296) y `npm run lint` en verde.

**Resultado: sigue sin funcionar bien en mobile.** Pero el usuario aportó un dato empírico nuevo, no reportado en ninguna ronda anterior, que cambia el diagnóstico:

> Con el sonido del sistema activado, se detectó que **al soltar el dedo después de mantenerlo apretado Y scrollear, Android reproduce el sonido de "click/tap"** — como si TODO el gesto (sin importar cuánto se mantuvo presionado ni cuánto se movió el dedo) se resolviera como un toque simple al momento del `ACTION_UP`. Esto pasa "durante todo el scroll", no según cuánto se sostenga.

Persisten además, sin cambios respecto a rondas anteriores: el scroll horizontal de la tira del catálogo solo funciona con un movimiento muy brusco (que no llega a "sentirse" como toque sostenido), y con el teclado en pantalla (modal más chico) todo funciona perfecto en cualquier punto.

**Por qué este dato es significativo:** un sonido de click en el `ACTION_UP` de Android, independiente del movimiento intermedio, es un síntoma de que el ciclo de touch completo (down→move→up) se está resolviendo como un TAP a nivel del sistema de touch nativo — no es cuestión de que nuestro `Pan` tarde en fallar o negocie mal con el `ScrollView`; es que en algún punto de la jerarquía, el movimiento simplemente no se está registrando como tal, y el `ACTION_UP` cae en el camino de "esto fue un tap". Esto es consistente con (y refuerza) la hipótesis 1 (conflicto de dos sistemas de touch coexistiendo) y la hipótesis 3 (`ScrollView`s anidados de la misma orientación dentro de un `Modal`) — pero apunta a algo más profundo que "el `Pan` tarda en ceder": sugiere que el arbitraje está roto a nivel de responder chain nativo, no solo a nivel de configuración de gesture-handler. El fix de memoización de este intento no estaba mal (elimina una causa real de gestos "recreados a destiempo"), pero convivía con este problema de fondo, no lo reemplaza.

**No se hizo ningún cambio de código adicional todavía** — se decidió, a pedido explícito del usuario ("vayamos con cautela antes de seguir haciendo cambios"), levantar este dato en el documento de investigación y proponer UN diagnóstico barato (sin código) antes de decidir el próximo paso: reproducir el mismo scroll (mantener y arrastrar) en una lista scrolleable de la app que NO esté dentro de un `Modal` ni use el `Pan` custom (ej. el roster de un equipo, o la lista de la pestaña "Ejercicios" fuera del modal de sesión) y confirmar si el mismo sonido de click aparece ahí también.
- Si aparece ahí también → el problema es sistémico (Android/Expo Go/RN, posiblemente relacionado a `soundEffectsEnabled` o al comportamiento default de accesibilidad de Android en CUALQUIER scroll de la app), no específico de este modal — replantea el diagnóstico completo.
- Si NO aparece ahí, solo dentro del modal de sesiones → confirma con alta confianza que el `Modal` + `ScrollView`s anidados de la misma orientación es la causa real, y que la migración a pantalla dedicada (ya decidida) probablemente resuelve esto de raíz, sin necesitar más ajuste fino de gestos dentro de la arquitectura actual.

**Este diagnóstico está pendiente de ejecutarse — es el punto donde se decidió pausar de nuevo antes de seguir cambiando código.**

---

## Estado actual exacto (al momento de escribir este documento)

### Web
- ✅ Cross-container (arrastrar del catálogo a la lista de la sesión): funciona.
- ❌ Reordenamiento in-place (mantener click y arrastrar una fila de la lista de la sesión): roto (regresión del intento 9).
- Nota menor, no bloqueante: el indicador de posición de drop se ve "un poco raro" mientras se arrastra, pero aceptado como está.

### Mobile (Expo Go, dispositivo Android real)
- ❌ Cross-container: roto.
- ❌ Reordenamiento in-place: roto.
- ❌ Scroll vertical de la lista de ejercicios de la sesión: solo "casi" funciona si el toque arranca sobre un input/select/botón dentro de una fila; si arranca sobre el fondo de la fila, no funciona.
- ❌ Scroll horizontal de la tira de catálogo: solo funciona con un movimiento muy brusco al inicio (a veces manda el scroll al otro extremo de golpe); en otros casos parece no tomar el toque salvo que se mantenga presionado.
- 🤔 **Con el teclado en pantalla** (lo que reduce el alto visible del modal): **todo funciona perfecto** — ambos scrolls, en cualquier punto, sin necesidad de gestos bruscos. Esta pista no está explicada y no se investigó a fondo.

### Deuda/pulidos ya anotados como pendientes (no bloqueantes, en memoria del proyecto, no en este documento)
- Reflow en vivo de las filas vecinas durante el reordenamiento (hoy solo se ve una línea indicadora estática) — pulido para versión final.
- Grid de 2 columnas en el catálogo de ejercicios de la pestaña "Ejercicios" en mobile — **ya resuelto** en esta misma rama (no relacionado con este problema).
- Íconos en el selector de rol (hoy solo texto, por la limitación de `<select>` nativo) — pulido para versión final.

---

## Hipótesis de causa raíz candidatas (sin confirmar ninguna al 100%)

1. **Conflicto estructural entre dos sistemas de touch coexistiendo en el mismo subárbol.** `react-native-gesture-handler` (nuestro `Pan`) y el sistema de touch/responder nativo de React Native (usado por `Pressable`, `PickerField`, y el `ScrollView` nativo cuando no es el de gesture-handler) no siempre negocian de forma predecible cuando conviven en la misma jerarquía de vistas — especialmente dentro de un `ScrollView`. La evidencia más fuerte: tocar un control nativo (`Pressable`/select) dentro de una fila "esquiva" el problema (esos tocan primero, ganan el hit-test), mientras que tocar el fondo de la misma fila (que sí cae directo en nuestro `Pan`) no.

2. **`onLayout` + `setState` desarmando el gesto nativo poco después del montaje** (hipótesis del intento 9, sin confirmar). Si el objeto `Gesture.Pan()` no está memoizado y se reconstruye en cada render, y `onLayout` dispara un re-render casi inmediatamente después de montar cada fila/card, el `GestureDetector` podría estar recibiendo un gesto "nuevo" en un momento crítico, rompiendo el registro nativo. Explicaría por qué CUALQUIER variante de "separar la capa de arrastre" ha roto todo hasta ahora — ambas variantes (v1 sin `onLayout`, v2 con `onLayout`) usan `useState` en algún punto de su ciclo de vida cerca del montaje.

3. **`ScrollView`s anidados de la misma orientación.** La lista de ejercicios de la sesión (un `ScrollView` de gesture-handler, vertical, alto fijo) vive DENTRO de otro `ScrollView` (el scroll general del modal, también vertical) DENTRO de un `Modal`. Los `ScrollView`s anidados de la MISMA orientación son un problema clásico y bien documentado de React Native, independiente de gesture-handler — puede que una parte de lo que se atribuyó a "nuestro `Pan` compitiendo mal" sea en realidad el `ScrollView` exterior compitiendo con el interior, sin que nuestro código de drag tenga nada que ver.

4. **El misterio del teclado.** No hay una hipótesis sólida todavía. Ideas sueltas, ninguna confirmada:
   - Cualquier evento de layout "fuerte" (como el resize que dispara el teclado) podría estar forzando una re-sincronización de algo que normalmente queda en un estado inconsistente al montar.
   - Podría no tener nada que ver con gestos en absoluto, y ser una pista falsa/correlación casual con otra cosa que cambia cuando el teclado está en pantalla (foco de un `TextInput`, tamaño del modal, etc.).

Ninguna de estas hipótesis fue confirmada de forma concluyente con evidencia directa (ej. logs nativos, profiling, inspección con Flipper/React DevTools) — todo el diagnóstico hasta ahora se basó en cambiar código y pedirle al usuario que probara en su dispositivo, lo cual es lento (un ciclo por mensaje) y no permite instrumentación fina.

---

## Restricciones y objetivos para la decisión futura

- **No se quiere depender de una librería externa de DnD** — ya se evaluó y descartó `react-native-drax` por incompatibilidad de versión con gesture-handler (necesita v3, el proyecto tiene v2.28). No se ha reevaluado si otras librerías (ej. `react-native-draggable-flatlist`, que probablemente tenga su propia solución a este exacto problema) serían compatibles con v2.28 — **esto podría valer la pena investigar** en la fase de research, en vez de asumir que hay que seguir con la solución 100% casera.
- **Migrar la creación/edición de sesiones a una pantalla dedicada (mismo patrón que `create-training-plan-screen.jsx`) es DEFINITIVO en mobile** (decisión confirmada 2026-09-16, ya no condicional a la investigación). En web, la dirección también es una interfaz dedicada (no `Modal`) — manteniendo la MISMA distribución/layout de columnas y el mismo comportamiento que hoy, solo removiendo la superficie de `Modal`. La motivación no es solo estética: **remueve una capa de anidamiento de `ScrollView`s** (Modal → scroll general del modal → scroll de la lista de ejercicios), lo que podría eliminar de raíz parte del problema (ver hipótesis 3 arriba).
- **Es indispensable mantener el sistema de gestos funcionando** (no descartarlo ni reemplazarlo por completo con botones) porque se planea reusarlo para el próximo sub-proyecto: **asignación de planes/sesiones a grupos, por arrastre, sobre un calendario** (ver `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` para el diseño de backend de ese sub-proyecto, todavía sin empezar del lado frontend). Si el mecanismo de drag no se puede estabilizar acá, el mismo problema va a reaparecer ahí, probablemente agravado (un calendario tiene aún más superficie de scroll compitiendo con drag).
- **Se aceptó, como concesión temporal, degradar el reordenamiento in-place a botones arriba/abajo** (mecanismo simple, ya probado, cero riesgo) mientras se resuelve esto — pero esa decisión quedó pausada a la espera de esta investigación, no se implementó todavía.

## Preguntas abiertas para la investigación

1. ¿Es un problema conocido y ya resuelto por la comunidad de `react-native-gesture-handler` — arbitraje entre un `Pan` con `activateAfterLongPress` y un `ScrollView` (propio o anidado)? ¿Hay un patrón recomendado oficialmente que no se haya probado acá (ej. `manualActivation(true)` con activación manual vía `state.activate()`/`state.fail()` en un `onTouchesMove`, en vez de depender de `failOffset`/hold nativos)?
2. ¿La hipótesis de `onLayout` + `setState` rompiendo el gesto tiene sentido para alguien con más experiencia en gesture-handler? ¿Hay una forma correcta de medir el tamaño de un elemento sin re-renderizar el `GestureDetector` padre (ej. memoizando el objeto `Gesture` con `useMemo`, o usando un `Animated`/`SharedValue` en vez de `useState` para el tamaño medido)?
3. ¿Vale la pena reevaluar `react-native-draggable-flatlist` (u otra librería popular con este patrón resuelto) contra gesture-handler v2.28 específicamente, en vez de seguir iterando sobre una solución casera? ¿Qué versión de esa librería (si alguna) es compatible con v2.28 sin forzar una migración a v3?
4. ¿Migrar a una pantalla dedicada (sin `Modal`, sin `ScrollView` anidado del mismo eje) resuelve esto de raíz, o el problema de fondo (arbitraje `Pan`-vs-`ScrollView` para hold-to-drag) persiste igual con una sola capa de scroll?
5. ¿Qué explica el comportamiton con el teclado en pantalla? ¿Es reproducible de forma consistente, o fue una observación puntual? (Vale la pena que el usuario intente reproducirlo de nuevo, de forma más controlada, antes de descartarlo como pista.)

## Hallazgos de una research externa (2026-09-16, post-documento inicial)

Tras compartir este documento para investigación externa, volvieron recomendaciones concretas. Se verificaron contra el registro de npm antes de aceptarlas — mismo criterio que ya se aplicó con `react-native-drax` (no confiar en el rango de peer-dep declarado sin chequear evidencia real).

### `react-native-draggable-flatlist` — mismo patrón de riesgo que `drax`, no adoptar sin prototipo aislado

Candidata propuesta como alternativa a la solución casera (pregunta abierta 3). Verificado vía `npm view`:

- `peerDependencies` de la v4.0.3 (la más reciente): `react-native-gesture-handler: ">=2.0.0"`, `react-native-reanimated: ">=2.8.0"`.
- **Historial de publicación real:** `4.0.0` → 2022-11-20, `4.0.1` → 2023-02-22, luego un salto de más de 2 años hasta `4.0.2` (2025-04-03) y `4.0.3` (2025-05-06). El diff de código entre `4.0.1` y `4.0.3` es mínimo (parches, no reescritura) — la lógica interna del paquete es efectivamente de 2023.
- El piso de `react-native-reanimated` declarado (`>=2.8.0`) es una versión muy anterior a la `4.1.1` que usa este proyecto — reanimated 3 y 4 tuvieron cambios internos de worklets relevantes; un piso tan bajo sugiere que nunca se validó contra reanimated 4.x ni contra New Architecture/Fabric de forma explícita.

**Conclusión: mismo patrón que `drax`** (peer-dep amplio "de papel", sin evidencia de mantenimiento activo ni validación contra las versiones reales de este proyecto). No es un descarte automático — a diferencia de drax no hay un reporte conocido de crash inmediato — pero **no se recomienda adoptar directo**; si se quiere evaluar, hacerlo como spike aislado en una rama/branch de prueba chica (un solo `FlatList` reordenable, sin el resto del modal), medir si el gesto se activa con mouse real y con touch real, antes de comprometerse. Si falla o se comporta raro, mismo desenlace que drax: descartar y volver a la solución casera con la información nueva de abajo.

### `onLayout` + `setState` recreando `Gesture.Pan()` — hipótesis 2 sube de confianza, con fix concreto

La explicación técnica recibida coincide exactamente con la hipótesis 2 ya escrita arriba, y la completa con la causa raíz más probable: si `Gesture.Pan()` no está envuelto en `useMemo`, se reconstruye en cada render de React — un objeto de gesto distinto en cada pasada. Cuando `onLayout` dispara el `setState` de `rowHeight`/`cardSize` justo después de montar, ese re-render entrega un `Gesture.Pan()` NUEVO al `GestureDetector` nativo en la ventana de inicialización, lo que puede desarmar el registro del gesto sin ningún error visible.

Fix concreto sugerido, dos variantes (ninguna probada todavía en este código):
1. Reemplazar el `useState` de `rowHeight`/`cardSize` por un `useSharedValue` (Reanimated) — actualizar un shared value no dispara re-render de React, así que el `Gesture.Pan()` nunca se reconstruye por esta vía.
2. Envolver la definición completa del gesto en `useMemo(() => Gesture.Pan()..., [deps])`, para que sobreviva a re-renders no relacionados aunque el componente sí vuelva a renderizar.

Esto es más barato de probar que un cambio estructural nuevo — si la hipótesis es correcta, el sibling-overlay v2 (intento 9) podría funcionar sin cambiar su arquitectura, solo memoizando/moviendo el estado de medición fuera de React state. Vale la pena probarlo aislado ANTES de decidir si hace falta la migración a pantalla dedicada para resolver esto en particular (aunque la migración a pantalla dedicada sigue siendo definitiva por las otras razones ya documentadas — nesting de `ScrollView`s, simplicidad general).

### Activación manual del gesto (`manualActivation(true)`) — alternativa casera válida a `activateAfterLongPress`/`failOffset`

API real de gesture-handler v2 (no una función inventada): `Gesture.Pan().manualActivation(true)` con `onTouchesDown`/`onTouchesMove`/`onTouchesUp`, donde el segundo argumento del callback (`state` o `manager` según la versión exacta de la API) expone `state.activate()`/`state.fail()`. En vez de depender de umbrales pasivos (`activateAfterLongPress` + `failOffsetX/Y`, que ya demostraron ser insuficientes en varias rondas), esto da control explícito: medir tiempo transcurrido y desplazamiento acumulado a mano en `onTouchesMove`, y decidir activar (arrastre) o fallar (liberar el toque al `ScrollView`) con lógica propia en vez de la heurística interna de la librería.

No se implementó ni probó en este código todavía — queda como alternativa concreta si se decide seguir con la solución casera (sin librería externa) en la pantalla dedicada nueva, en vez de reevaluar `react-native-draggable-flatlist`.

### El misterio del teclado — hipótesis plausible, sigue sin confirmar

Explicación recibida: el resize abrupto que dispara el teclado fuerza a Yoga/Fabric a recalcular layout y el `ScrollView` a resincronizar su `contentSize` nativo, lo que de paso podría estar reiniciando la "responder chain" de touch y limpiando algún bloqueo sutil que haya quedado del montaje inicial (ej. el `Pan` mal registrado por la razón de arriba). Es consistente con la hipótesis 2 (si el `Gesture.Pan()` quedó "roto" tras un re-render temprano, un reset de layout fuerte podría re-sincronizar todo) pero sigue siendo especulativo — no se intentó reproducir de forma controlada (ej. forzar el mismo resize sin abrir el teclado, para aislar si es el resize en sí o algo específico del teclado).

## Referencias de código (estado actual, previo a cualquier cambio posterior a este documento)

- `components/plans/session-drag-and-drop.jsx` — toda la mecánica de gestos (`SessionDragProvider`, `DraggableExerciseCard`, `DragGhost`, `SessionDropIndicator`, `ReorderProvider`, `ReorderableRow`, `ReorderDropIndicator`). 557 líneas.
- `components/plans/create-session-modal.jsx` — el modal, ambos layouts (`SessionModalWideBody`/`SessionModalNarrowBody`), la fila de ejercicio (`SessionExerciseRow`). 608 líneas.
- `components/plans/session-exercise-panel.jsx` — el catálogo de origen del drag (panel ancho / tira horizontal). 198 líneas.
- `components/plans/session-reorder-math.js` — matemática pura de estimación de índice/reordenamiento, sin dependencia de reanimated/gesture-handler (la única parte de este sistema con test unitario, `__tests__/session-reorder-math.test.js`).
- `CLAUDE.md`, sección "Stack" → bloque "Drag-and-drop" — documentación viva de todo este historial, mantenida en paralelo a este documento (más resumida, pensada como referencia rápida para trabajo futuro en el repo; este documento es la versión extendida, pensada para investigación externa).
- `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` — spec de backend del sub-proyecto futuro (calendario de asignaciones) que reusaría este mecanismo.

---

*Este documento describe el estado del problema al momento de su redacción. No incluye ninguna recomendación de solución final — esa decisión queda pendiente de la investigación del usuario.*
