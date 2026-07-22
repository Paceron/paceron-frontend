# Submenu de Equipos en el nav — Design

**Fecha:** 2026-07-21
**Estado:** Aprobado, implementado (sin plan formal — diseño acotado, iterado en vivo con el usuario antes de la spec)

## Contexto

`routes/catalog.js` solo exponía `homeRoute` en `navigationRoutes` — no había
ninguna entrada de "Equipos" en el nav (web: tabs en el `TopBar`; mobile:
lista del `NavigationDrawer`). Se agrega una sección "Equipos", pero sin
backend de equipos todavía (`docs/BACKEND_DEFINITIONS.md` no define ese
dominio) — el alcance es solo el disparador de navegación con datos mock,
no una pantalla de gestión real.

Se evaluó primero una pantalla propia estilo grid (cajas cuadradas por
equipo + caja "Crear equipo", similar a selector de perfiles de Xbox),
implementada y probada en vivo. Se descartó: el usuario no espera que una
persona tenga más de un par de equipos, así que una pantalla completa es
demasiado para la cantidad de opciones — un submenu alcanza.

## Alcance de esta spec

`routes/catalog.js` (nueva entrada `teamsRoute`), `store/team-store.js`
(nuevo), `components/shell/app-web-shell.jsx`, `components/shell/app-mobile-shell.jsx`.
Sin cambios de backend ni de servicios — no existe endpoint de equipos.

## Decisiones

### Datos

`store/team-store.js`: store Zustand nuevo, mismo criterio que
`activeRole` en `auth-store.js` (100% local hasta que exista backend de
equipos). Expone `teams` (mock: 3 equipos fijos), `selectedTeamId` y
`selectTeam(id)`. Sin `services/team.js` — no hay ninguna llamada real que
mockear (a diferencia de roles, que sí pega contra `/auth/permissions`).

### Catálogo de rutas

`teamsRoute` se agrega a `navigationRoutes` con `name: 'equipos'`, pero su
`href` no se usa para navegar — es solo metadata (label/icon). Ambos
shells detectan `route.name === 'equipos'` y renderizan el disparador de
submenu en vez del `Pressable` de navegación estándar.

### Web (`AppWebShell`)

- `AnimatedDropdown` (ya existía para el menú de usuario) pasa a recibir
  `anchorStyle` como prop en vez de tener la posición hardcodeada — se
  reusa para los dos dropdowns (usuario a la derecha, equipos anclado bajo
  su propio tab).
- `TeamsTab`: mide su posición real en pantalla con `measureInWindow` al
  presionar, y esa posición ancla el dropdown (`left`, `top` = borde
  inferior del tab + 8px). Necesario porque los tabs viven centrados en un
  `ScrollView` horizontal — no hay una posición fija conocida de antemano.
- `TeamsMenu`: mismo patrón visual que el `DropdownMenu` de usuario ya
  existente (card `rounded-xl`, nub triangular, secciones separadas por
  borde). Lista los equipos (ícono + nombre, check si es el seleccionado)
  y una fila final "Crear equipo".

### Mobile (`AppMobileShell`)

No se abre un dropdown nuevo sobre el drawer (ya es un overlay fullscreen,
apilar otro se sentía pesado). En cambio, el item "Equipos" del
`NavigationDrawer` se vuelve un acordeón: al tocarlo alterna
`teamsExpanded` y despliega los equipos + "Crear equipo" como filas
indentadas debajo, con el mismo tratamiento visual que el resto del
drawer (no es un componente nuevo, es JSX inline condicional). Colapsa
automáticamente cada vez que se cierra el drawer.

### Comportamiento al seleccionar

Ni elegir un equipo ni "Crear equipo" navegan a ninguna pantalla — no
existe pantalla de detalle ni de creación todavía. Ambas acciones cierran
el menú/acordeón y muestran un `Toast` tipo `info` ("La vista de equipo
todavía está en construcción" / "Este flujo todavía no está disponible").
Elegir un equipo sí persiste la selección en `team-store` (para que el
check se mantenga la próxima vez que se abra el menú).

## Fuera de alcance

Pantalla de detalle de equipo, flujo de creación de equipo, backend de
equipos, límite real de equipos por usuario (el mock tiene 3 fijos sin
paginar ni validar cantidad).

## Verificación

Web: iniciar sesión (mock, `EXPO_PUBLIC_USE_MOCKS=true`), tocar "Equipos"
en el header abre el dropdown anclado bajo el tab con los 3 equipos mock +
"Crear equipo"; tocar cualquiera cierra el dropdown y muestra el toast
correspondiente.

Mobile: abrir el drawer, tocar "Equipos" expande la lista inline sin
cerrar el drawer; tocar un equipo o "Crear equipo" cierra el drawer entero
y muestra el toast.

`npm test` → 33/33 verde.
