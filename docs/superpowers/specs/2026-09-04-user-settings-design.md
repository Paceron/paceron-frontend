# Módulo de settings de usuario — Design

**Fecha:** 2026-09-04
**Estado:** Aprobado — spec completa, implementación parcial en esta rama (bugfix), resto bloqueado por backend

## Contexto

Idea original (ver memoria `settings-module-backlog`): theme default,
rol default, y permitir/no invitaciones — retomada ahora como trabajo
alternativo mientras pagos Fase 1 y búsqueda de equipos están
bloqueados por backend (ver `docs/superpowers/specs/2026-09-03-payments-fase1-tier-upgrade-design.md`
y `docs/superpowers/specs/2026-09-03-team-search-join-requests-design.md`).

**Rol default se descarta** — `activeRole` (`store/auth-store.js`) ya
persiste el último rol usado entre sesiones (`persist()` lo guarda en
cada `switchRole`, se restaura en `login`/`hydrate`). El efecto que se
buscaba ya existe, sin necesidad de construir nada.

**Tema y permitir-invitaciones sí quedan**, pero ambos terminaron
necesitando un campo nuevo en backend (no son solo frontend como se
pensó al principio):

- Tema: la idea original era "recordar el tema elegido", pero el
  usuario aclaró que además lo quiere **cross-dispositivo** — un
  default que viaje con la cuenta, no solo el dispositivo. Eso exige
  backend.
- Invitaciones: ya se sabía desde el principio que necesitaba un
  campo nuevo (`allow_team_invitations`, anti-spam).

**Esta rama entrega spec completa + un bugfix real e independiente**
(persistencia de tema en nativo, ver más abajo) — la pantalla de
Settings y el wiring de los 2 campos nuevos quedan pausados hasta que
el backend los tenga, mismo patrón que las otras dos specs bloqueadas
mencionadas arriba. Cuando el backend esté listo, se retoma esta misma
rama para terminar la implementación.

## Alcance

**Se implementa ya, en esta rama:** bugfix de persistencia de tema en
nativo (`providers/theme-provider.jsx`).

**Diseñado acá, implementación pausada:** pantalla `Settings` nueva
(`components/settings/settings-screen.jsx`, ruta `/settings`), entrada
en el dropdown/drawers del shell, sección "Apariencia" (tema
predeterminado), sección "Notificaciones" (permitir invitaciones a
equipos). `services/user.js#updateUser` gana 2 campos nuevos en el
payload existente — no hace falta un endpoint dedicado.

## Decisiones

### Bugfix — persistencia de tema en nativo (implementación real de esta rama)

Hoy `readInitialThemeMode()` en `theme-provider.jsx` solo lee
`localStorage` en web (`isWeb && typeof window !== 'undefined'`) — en
nativo siempre devuelve `'dark'` hardcodeado, sin importar qué eligió
el usuario la sesión anterior. El toggle (`ThemeToggle`,
`useThemeMode().setThemeMode`) sí cambia el tema en el momento, pero
nunca se guarda en nativo — se pierde en cada reinicio de la app.

Fix: usar `services/storage.js` (`getItem`/`setItem`, el mismo
abstraction que ya usa `auth-store.js` — web usa `localStorage`,
nativo usa `expo-secure-store`) en vez de acceder a `window.localStorage`
directo. Como `getItem` es async, `readInitialThemeMode()` deja de
poder devolver el valor de forma síncrona antes del primer render —
en nativo va a haber un flash muy breve del tema default mientras
resuelve la lectura (aceptado a propósito: mismo tipo de flash que
casi cualquier app nativa tiene al hidratar una preferencia
persistida, no vale la pena una dependencia nueva ni un mecanismo más
complejo solo para evitarlo). Web mantiene el acceso directo a
`localStorage` (sigue siendo síncrono ahí, sin cambio de comportamiento).

No se usa `expo-secure-store` porque el dato sea sensible — no lo es —
sino porque ya es el único storage nativo disponible en el repo hoy y
evita sumar una dependencia nueva (`@react-native-async-storage/async-storage`,
no instalada) solo para esto.

### Entrada a Settings — dropdown/drawer, no colgado de Mi Perfil

Fila "Settings" en el dropdown del user (`app-web-shell.jsx`, junto a
"Ver perfil"/"Cerrar sesión") + fila equivalente en los drawers
narrow-web y mobile — mismo mecanismo ya usado para la campana/fila de
notificaciones (spec de team-search). A diferencia de `tier-upgrade`
(que cuelga de Mi Perfil por ser específico del rol/tier), Settings es
transversal a toda la cuenta, tiene más sentido a la par de
"Cerrar sesión" que dentro del perfil.

### Tema predeterminado — semilla por dispositivo nuevo, no un pisado global

Campo nuevo `default_theme` (`'light' | 'dark'`) en el usuario. Regla
de interacción con el toggle rápido existente (confirmada con el
usuario, es la parte no obvia de este diseño):

- El **toggle rápido** (`ThemeToggle`, ya existe) sigue siendo 100%
  local por dispositivo — tocarlo nunca actualiza `default_theme` en
  el backend.
- El **default sincronizado** se aplica **solo como semilla**: al
  hidratar un dispositivo que todavía no tiene ningún valor guardado
  en su storage local (dispositivo nuevo, o storage limpio), se usa
  `default_theme` del usuario en vez del hardcode `'dark'` actual. Una
  vez aplicado, ese dispositivo ya tiene su propio valor local
  persistido — indistinguible de haber tocado el toggle a mano. Un
  cambio posterior de `default_theme` desde otro dispositivo (vía
  Settings) **no** le pisa el valor a dispositivos que ya tienen el
  suyo.
- Cambiar "Tema predeterminado" **desde la pantalla de Settings** sí
  aplica también al dispositivo actual en el momento (es una elección
  explícita hecha ahí mismo, distinta del toggle rápido de otro
  lugar de la UI).

### Permitir invitaciones a equipos — anti-spam, boolean simple

Campo nuevo `allow_team_invitations` (bool, default `true` — no
romper el flujo de invitaciones existente para cuentas que nunca
tocaron este setting). En `false`, el backend debería rechazar
`POST /teams/{id}/invitations` hacia ese usuario (enforcement real del
lado servidor — un toggle que solo ocultara el botón del lado del
entrenador sin bloquear en el backend sería fácil de saltear). El
frontend solo expone el toggle y refleja el estado; la validación real
vive en el backend.

### Pantalla — extensible por secciones desde el día uno

`SettingsScreen` con `SectionCard`s por tema (mismo patrón que
`profile-screen.jsx`/`edit-profile-screen.jsx`): "Apariencia" (tema
predeterminado, picker Claro/Oscuro) y "Notificaciones" (toggle
permitir invitaciones). Pensada para sumar secciones nuevas después
sin rehacer la pantalla — cada sección es un bloque independiente.

## Contrato de backend propuesto (pendiente, no confirmado)

| Campo | Dónde | Tipo | Default |
|---|---|---|---|
| `default_theme` | payload de `PUT /users/{id}` (existente, `services/user.js#updateUser`) y respuesta de `GET /auth/user` | `'light' \| 'dark'` | `'dark'` |
| `allow_team_invitations` | ídem — mismo payload/respuesta | boolean | `true` |

No hace falta ningún endpoint nuevo — ambos campos se suman al PUT de
perfil ya existente, mismo criterio que `bank_alias` u otros campos de
`UserResponse`. El enforcement de `allow_team_invitations` sí necesita
un chequeo nuevo del lado del backend en `POST /teams/{id}/invitations`
(rechazar si el destinatario tiene el campo en `false`).

## Fuera de alcance

Rol default explícito (se descartó — `activeRole` ya persiste el
último usado). Selector "Sistema/Claro/Oscuro" de 3 vías — el pedido
fue "tema predeterminado", no seguir el tema del SO; si se quiere más
adelante es un tercer valor en el mismo campo, sin rediseño. Cualquier
otro setting no mencionado en esta spec (notificaciones granulares por
tipo, idioma, etc.) — la pantalla queda preparada para sumarlos, pero
no se diseñan ahora sin un pedido concreto.

## Verificación

**Bugfix (esta rama):** en un build nativo (no hay forma de probar
persistencia real en el preview web, que ya persiste desde antes) —
tocar el toggle, cerrar la app por completo (no solo backgroundear),
volver a abrir, confirmar que mantiene el tema elegido en vez de
volver a `'dark'`.

**Resto (rama futura, cuando el backend tenga los 2 campos):** cambiar
"Tema predeterminado" en Settings, loguear desde un dispositivo/browser
nuevo (storage limpio), confirmar que arranca con ese tema. Tocar el
toggle rápido en un dispositivo ya sembrado, cambiar el default desde
otro dispositivo, confirmar que el primero no se mueve. Desactivar
"Permitir invitaciones", intentar invitar a ese usuario desde otra
cuenta entrenador, confirmar rechazo real (no solo UI).

`npm test` y `npm run lint` en verde antes de abrir la PR.
