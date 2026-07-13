# Sidebar mobile fullscreen — Design

**Fecha:** 2026-07-13
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El drawer de navegación mobile (`NavigationDrawer` dentro de
`components/shell/app-mobile-shell.jsx`) ocupa hoy `Math.min(SCREEN_WIDTH * 0.8, 360)`
de ancho, dejando una franja lateral cubierta por un backdrop con
`backgroundColor: 'black'` hardcodeado (línea 81). En dark mode ese negro no
hace fade correctamente y se ve como un rectángulo negro apareciendo/
desapareciendo en vez de una transición suave — el bug reportado de "fondo
totalmente negro".

En vez de parchear el color del backdrop, se decide que el sidebar pase a
ocupar el 100% de la pantalla, eliminando la necesidad de backdrop.

## Alcance de esta spec

Solo el comportamiento de la sidebar mobile (`NavigationDrawer` +
`TopAppBar` en `app-mobile-shell.jsx`). **No** incluye: rediseño de una barra
de accesos/toolbar inferior — se menciona como posible evolución futura,
explícitamente fuera de alcance ahora. La arquitectura resultante no debe
bloquear esa migración futura, pero no se construye nada especulativo para
soportarla hoy.

## Decisiones

- **Ancho**: `DRAWER_WIDTH` pasa de `Math.min(SCREEN_WIDTH * 0.8, 360)` a
  `SCREEN_WIDTH` (fullscreen).
- **Backdrop**: se elimina por completo (el `Animated.View` con
  `backgroundColor: 'black'` y su `Pressable` de cierre por tap-fuera,
  líneas 79-84). Al ocupar toda la pantalla no hay nada detrás que cubrir ni
  espacio para "tap fuera para cerrar".
- **Cierre**: un solo botón, ubicado en el `TopAppBar` (mismo botón que hoy
  abre el drawer). Cambia de ícono según estado: `menu` (drawer cerrado) ↔
  `close` (drawer abierto). Mismo handler, togglea `drawerOpen`.
- **Persistencia del TopAppBar**: el `TopAppBar` queda siempre visible por
  encima del drawer (zIndex mayor al del drawer), tanto abierto como
  cerrado — no se duplica ni se oculta.
- **Header duplicado dentro del drawer**: se elimina (el bloque con
  `PaceronBrand`, líneas 94-96) ya que el `TopAppBar` persistente cumple esa
  función. El contenido del drawer arranca con padding-top equivalente a la
  altura del `TopAppBar` (60px) para no quedar tapado.
- **Animación**: se mantiene igual — `translateX` de `-DRAWER_WIDTH` a `0`,
  280ms, `Easing.out(Easing.cubic)`, vía Reanimated
  (`useSharedValue`/`withTiming`). Ya es slide izquierda→derecha como se
  pidió, no requiere cambios.
- **Resto del contenido del drawer** (perfil de usuario, `RoleManagementSection`,
  `ThemeToggle`, listado de rutas, logout) no cambia de lugar ni de lógica,
  solo se re-acomoda debajo del nuevo padding-top.

## Fuera de alcance

Barra de accesos/toolbar inferior (mencionada como posible evolución futura).
Cualquier cambio a la versión web del shell (`app-web-shell.jsx`) — esta
spec es exclusiva de `app-mobile-shell.jsx`.

## Verificación

Web preview en viewport mobile: abrir sidebar (botón `menu` en `TopAppBar`),
confirmar que ocupa 100% del ancho/alto, que no aparece ningún rectángulo
negro de fondo, que el ícono del botón cambia a `close`, y que al presionarlo
cierra con el mismo slide animado. Confirmar que navegar a una ruta desde el
drawer también lo cierra correctamente (comportamiento ya existente,
`goTo`/`onClose`).
