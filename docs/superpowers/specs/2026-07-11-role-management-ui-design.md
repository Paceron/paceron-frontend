# Gestión visual de rol (corredor/entrenador) — Design

**Fecha:** 2026-07-11
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El backend todavía no tiene sistema de roles (rol base al registrarse = corredor;
activación de perfil entrenador es una user story pendiente del lado backend).
Se avanza con la UI/UX completa en el frontend usando estado **local-only**,
persistido en el mismo storage del auth store, de forma que cuando el backend
tenga esto implementado, sea un reemplazo de la fuente de datos sin tocar
la UI que ya la consume.

Referencias visuales del usuario (screenshots de otra app, estilos a adaptar):
sección "Role Management" con action-row de cambio de rol coloreado según
destino, badge de rol en el pill de usuario, switch de tema tipo iOS real.

## Alcance de esta spec

Solo la capa visual/interacción: badges, dropdown/drawer, modal de
confirmación de activación, switch de tema rediseñado, animación de cambio.
**No** incluye ninguna llamada real a backend (no existe endpoint). Cuando el
backend tenga roles, se reemplaza la fuente del estado — fuera de alcance
de esta spec.

## Estado (store)

`store/auth-store.js` suma:
- `activeRole`: `'runner'` (default) | `'trainer'`
- `trainerActivated`: `boolean`, default `false`

Ambos persistidos junto al resto de la sesión (mismo `persist()`/`STORAGE_KEY`
ya existente). Se resetean a default en `logout()` (no tiene sentido que un
nuevo login herede el rol de otra cuenta).

Acciones nuevas:
- `activateTrainerProfile()`: setea `trainerActivated: true`, `activeRole`
  permanece `'runner'` (arranca como corredor recién activado). Persiste.
- `switchRole()`: alterna `activeRole` entre `'runner'`/`'trainer'`. Solo
  tiene efecto si `trainerActivated` es `true` (no-op si no — la UI no debería
  llamar esto sin haber activado antes, pero la acción es defensiva).

Ambas son síncronas (no hay red real todavía) pero mantienen la firma
`async` para que reemplazar por una llamada real al backend después no
cambie la interfaz que consumen los componentes.

## Badge de rol

Nuevo componente `components/shell/role-badge.jsx`:
- Props: `role` (`'runner'` | `'trainer'`).
- Corredor: fondo `bg-primary/15`, texto `text-primary`, label "Corredor".
- Entrenador: fondo ámbar (`bg-amber-500/15`), texto ámbar (`text-amber-600
  dark:text-amber-400`), label "Entrenador".
- Pill chico (`rounded-full px-2 py-0.5 text-xs font-semibold`), no
  interactivo (solo display).

## Ubicación del badge

- **Web** (`TopBar` en `app-web-shell.jsx`): entre el nombre y el chevron del
  pill de usuario.
- **Mobile** (`NavigationDrawer` en `app-mobile-shell.jsx`): reestructura de
  dos niveles. Hoy el header del drawer tiene una sola fila (avatar + brand +
  nombre). Pasa a:
  1. Header propio arriba: solo `PaceronBrand`, fila separada, con su propio
     padding/border-bottom.
  2. Debajo, sección de usuario: avatar + nombre + `RoleBadge`, en su propia
     fila con border-bottom — visualmente equivalente al pill web.
  Estado invitado (sin sesión) no muestra badge (no aplica rol).

## Sección "Gestión de rol"

Nuevo componente `components/shell/role-management-section.jsx`, consumido
por ambos (dropdown web, drawer mobile) — misma lógica y estilos, solo el
contenedor que lo aloja difiere (ya existe esa separación hoy con
`DropdownMenu`/`NavigationDrawer`).

Label de sección: "Gestión de rol" (estilo texto pequeño mayúscula, como
labels de sección ya usados en otros lados del proyecto).

Un solo action-row, contenido condicional sobre `trainerActivated`/`activeRole`:

| Estado | Texto | Ícono | Color |
|---|---|---|---|
| `!trainerActivated` | "Activar perfil de entrenador" | `whistle` | ámbar |
| `trainerActivated && activeRole === 'runner'` | "Cambiar a Entrenador" | `whistle` | ámbar |
| `trainerActivated && activeRole === 'trainer'` | "Cambiar a Corredor" | `run-fast` | verde (`primary`) |

Al tocar:
- Si `!trainerActivated` → abre `ActivateTrainerModal` (mismo patrón que
  `DeactivateAccountModal` ya existente: modal simple, confirmar/cancelar,
  sin campos). Confirmar → `activateTrainerProfile()` + cierra modal +
  cierra dropdown/drawer.
- Si ya activado → `switchRole()` directo, sin modal (acción reversible, no
  destructiva). Cierra dropdown/drawer.

Esta sección va **primero** en el dropdown/drawer, antes de "Ver perfil".

## Animación de cambio de rol

El action-row anima color de fondo/ícono/texto al cambiar de estado
(cross-fade ~150-200ms), usando el mismo mecanismo Reanimated
(`useSharedValue`+`withTiming`) ya usado en `AnimatedDropdown`. No hay layout
shift — mismo tamaño de row en los 3 estados.

## Switch de tema — rediseño

Reemplaza `components/theme/theme-toggle.jsx` (hoy: 2 botones sol/luna lado
a lado). Nuevo diseño: pill horizontal única, thumb circular que se desliza
entre posición izquierda (claro, ícono sol) y derecha (oscuro, ícono luna).
Un solo `Pressable` cubre todo el ancho del pill — cada tap alterna
(`toggleThemeMode()`), no selecciona un lado específico. Thumb anima su
posición con Reanimated. Label "Tema" pasa a vivir arriba, centrado, en el
contenedor que lo aloja (antes estaba a la izquierda en la misma fila que
los botones) — ancho completo del dropdown/drawer.

Mismo componente para web y mobile (ya era compartido).

## Fuera de alcance

Cualquier lógica real de backend (roles, activación, permisos). Contenido
del futuro form/modal más completo de activación (mencionado por el usuario
como posible evolución) — por ahora el modal es solo confirmar/cancelar.
Rutas/dashboards diferenciados por rol (`getRoutesByRole` ya existe pero
sigue devolviendo solo "Inicio" hasta que haya contenido real por rol).

## Verificación

Web preview: togglear rol y tema, confirmar badge/action-row/switch
reflejan el estado correcto y persisten tras reload. Mobile: verificación
visual del usuario (device).
