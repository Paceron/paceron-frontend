# Sección de roles en Profile — Design

**Fecha:** 2026-07-13
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

`RoleManagementSection` (ver `docs/superpowers/specs/2026-07-11-role-management-ui-design.md`)
ya permite activar el perfil de entrenador y alternar entre corredor/entrenador
desde el dropdown web y la sidebar mobile. Falta exponer lo mismo dentro de
`ProfileScreen` (`components/profile/profile-screen.jsx`), y agregar una
sección de "datos de entrenador" (editable en `EditProfileScreen`) para datos
propios del rol entrenador — por ejemplo un alias de cobro.

Como en el resto del sistema de roles, esto es **100% local por ahora**: el
backend todavía no tiene el modelo de roles ni de datos de entrenador
implementado. Nada de lo que se agrega en esta spec se envía al backend.

## Alcance de esta spec

`ProfileScreen` y `EditProfileScreen` (mobile y web, mismo componente para
ambas plataformas salvo el layout ya existente vía `isWeb`). Cambios de
soporte en `store/auth-store.js`, `role-badge.jsx`, `role-management-section.jsx`
y `role-switch-overlay.jsx` para reutilizar la lógica ya existente sin
duplicarla.

**No** incluye: persistencia real en backend de `trainerAlias`/`trainerCbu`
(se simula localmente; cuando el backend tenga estos campos, se corrige
`toUpdatePayload`/la request de guardado para incluirlos — explícitamente
fuera de alcance ahora). Tampoco incluye remover el botón de gestión de rol
del dropdown/sidebar (mencionado como posible evolución futura, no se toca
en esta spec).

## Decisiones

### Store (`store/auth-store.js`)

- Nuevos campos de estado: `trainerAlias: ''`, `trainerCbu: ''` (junto a
  `activeRole`/`trainerActivated`, mismo mecanismo de `persist()`/`hydrate`).
  Se resetean a `''` en `logout()`, igual que el resto del estado de rol —
  un login nuevo no debe heredar datos de entrenador de otra cuenta.
- Nueva acción `updateTrainerData({ trainerAlias, trainerCbu })`: local-only,
  sin llamada a `services/`, solo `set()` + `persist()`. No pega al backend.
- `switchRole()` acepta un segundo argumento opcional `{ redirectHome = true }`.
  El objeto que guarda en `roleSwitchAnimating` pasa a ser
  `{ role: nextRole, redirectHome }` (antes era solo `{ role: nextRole }`).
- `RoleSwitchOverlay` (`components/shell/role-switch-overlay.jsx`) solo llama
  `router.replace('/')` si `animating.redirectHome !== false`. El resto de la
  animación (fade in/out, `clearRoleSwitchAnimation`) no cambia — sigue
  disparándose siempre que se llama `switchRole()`, sin importar el flag.

### Componentes compartidos

- `RoleBadge` (`components/shell/role-badge.jsx`) suma un prop opcional
  `active` (default `true`). Cuando `active={false}`, usa un estilo apagado
  (`bg-slate-200 dark:bg-slate-700` / `text-slate-500`) en vez del color de
  rol — para distinguir visualmente cuál de los badges es el rol vigente
  cuando se muestran los dos a la vez.
- `RoleManagementSection` (`components/shell/role-management-section.jsx`)
  suma un prop opcional `redirectOnSwitch` (default `true`), que se pasa como
  `switchRole({ redirectHome: redirectOnSwitch })`. El dropdown web y la
  sidebar mobile no cambian su uso actual (quedan en `true`, siguen
  navegando a Inicio al cambiar de rol). El pill/botón y su lógica de
  color/label (`getRoleAction`, `COLOR_BY_KIND`) se reutilizan tal cual, sin
  duplicar código — el mismo componente se usa ahora también desde
  `ProfileScreen`.

### `ProfileScreen` (`components/profile/profile-screen.jsx`)

- **Card "Roles"**: nueva sección usando el componente `Card` ya existente
  en este archivo (icono + título + contenido), ubicada inmediatamente
  después de `HeaderPanel` y antes de la Card "Datos personales". Contenido:
  una fila con badges a la izquierda y el botón de gestión a la derecha.
  - Izquierda: `RoleBadge role="runner" active={activeRole === 'runner'}`
    siempre presente; si `trainerActivated`, además
    `RoleBadge role="trainer" active={activeRole === 'trainer'}`. Cuando solo
    hay un rol (corredor sin entrenador activado), ese badge se muestra
    como `active` (es, por definición, el vigente).
  - Derecha: `<RoleManagementSection redirectOnSwitch={false} />` (sin
    `onClose`, no aplica en este contexto — no hay menú que cerrar). Mismo
    comportamiento que en dropdown/sidebar: si no hay entrenador activado,
    abre `ActivateTrainerModal`; si ya está activado, alterna de inmediato
    disparando la animación fullscreen (`RoleSwitchOverlay`) pero **sin**
    navegar — el usuario se queda en `/profile` viendo el fade de la
    animación por encima.
- **Sección "Datos de entrenador"**: nuevo componente local al archivo (mismo
  patrón visual que `DangerZone` pero en ámbar en vez de rojo — borde/fondo
  `amber-300`/`amber-50` claro, `amber-900/50`/`amber-950/20` oscuro).
  Renderizada solo si `trainerActivated`, justo después de la Card "Roles"
  (o donde quede mejor entre las cards existentes — decisión de
  implementación, no cambia el comportamiento). Dos campos de solo lectura
  vía el helper `display()` ya existente en el archivo (guion `—` si están
  vacíos): "Alias de pagos" y "CBU/CVU", leídos de
  `trainerAlias`/`trainerCbu` del store.

### `EditProfileScreen` (`components/profile/edit-profile-screen.jsx`)

- Nueva `SectionTitle` "Datos de entrenador" (mismo componente ya usado para
  "Datos personales"/"Dirección"), renderizada solo si `trainerActivated`,
  después de la sección "Dirección". Dos `InputField` (Alias de pagos,
  CBU/CVU) con el mismo `Row`/`Col` que el resto del form. **Sin validación
  estricta** — texto libre, campos opcionales, sin regex ni longitud fija
  (a diferencia de DNI/email). Precargados desde
  `trainerAlias`/`trainerCbu` del store vía `useState`, igual que el resto
  de los campos del form.
- **Estos dos campos NO se agregan a `toUpdatePayload` ni a la request que
  `updateUser` manda al backend** — el backend todavía no tiene el modelo de
  datos de entrenador. En `handleSubmit`, junto al `updateUser` existente
  (backend, datos personales), se llama por separado
  `useAuthStore.getState().updateTrainerData({ trainerAlias, trainerCbu })`
  (local-only, síncrono/sin red). Un solo botón "Guardar cambios", un solo
  toast de éxito — ambas actualizaciones (backend + local) ocurren en el
  mismo submit. Cuando el backend implemente estos campos, se corrige
  `toUpdatePayload`/la request para incluirlos — explícitamente pospuesto,
  no se hace en esta spec.

## Fuera de alcance

Persistencia real en backend de datos de entrenador (alias/CBU). Remover el
botón de gestión de rol del dropdown/sidebar. Validación de formato para
CBU/CVU (22 dígitos u otro estándar) — texto libre por ahora. Cambios a
`app-web-shell.jsx`/`app-mobile-shell.jsx` (ya cubiertos por specs previas).

## Verificación

Web preview (`EXPO_PUBLIC_USE_MOCKS=true`), logueado:

1. **Solo corredor** (estado inicial): Card "Roles" muestra un solo badge
   "Corredor" (resaltado) a la izquierda y el botón "Activar perfil de
   entrenador" a la derecha. No aparece la sección "Datos de entrenador" en
   la vista ni en editar.
2. Activar entrenador desde esa Card (modal de confirmación, igual que en
   el dropdown) → aparecen los dos badges (Corredor + Entrenador), el
   badge "Entrenador" queda resaltado como activo (es el rol recién
   asignado tras activar). Aparece la sección ámbar "Datos de entrenador"
   con Alias/CBU en `—`.
3. Cambiar de rol desde esa Card (sin modal, directo) → se dispara la
   animación fullscreen de cambio de rol, pero al terminar el usuario
   sigue en `/profile` (no navegó a Inicio), y el badge resaltado cambió
   de lado.
4. Ir a "Editar datos" → sección "Datos de entrenador" con los dos campos
   editables, vacíos. Completar Alias/CBU, guardar → toast de éxito,
   vuelve a `/profile`, la sección ámbar ahora muestra los valores
   cargados (no guion).
5. Confirmar en las devtools de red (o inspeccionando el payload) que la
   request de `updateUser` **no** incluye `trainerAlias`/`trainerCbu`.
6. Confirmar que el dropdown web y la sidebar mobile siguen navegando a
   Inicio al cambiar de rol desde ahí (comportamiento sin cambios,
   `redirectOnSwitch` sigue en `true` por default).

`npm test` sigue en verde (32/32 + los tests nuevos que sume el Task de
store).
