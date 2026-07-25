# Formulario de creación de equipo — Design

**Fecha:** 2026-07-25
**Estado:** Aprobado, implementado (sin plan formal separado — alcance acotado en la charla previa, decisiones ambiguas resueltas con el usuario antes de escribir código)

## Contexto

"Crear equipo" en el menú de Equipos (web ancho, web angosto y mobile — los
tres puntos de entrada ya existentes, ver `docs/superpowers/specs/2026-07-21-teams-menu-design.md`)
mostraba un toast "todavía no disponible". Pasa a abrir un formulario real
que crea el equipo en el store local (sigue sin backend de equipos, ver
`docs/BACKEND_DEFINITIONS.md`).

## Alcance de esta spec

`store/team-store.js` (acción `createTeam` + tope de integrantes por tier),
`components/forms/fields.jsx` (`InputField` con `multiline`, nuevo
`EmailListField`), `components/team/create-team-screen.jsx` (nuevo),
`app/(tabs)/equipos/crear.jsx` (nuevo), los tres shells (`app-web-shell.jsx`,
`app-web-shell-narrow.jsx`, `app-mobile-shell.jsx` — cambia el
`handleCreateTeam` de toast a navegación), `package.json`/`app.config.js`
(nueva dependencia `expo-image-picker`).

## Decisiones

### Tope de integrantes por plan

No hay todavía un sistema de tiers más allá de `base`/`premium` en el
mock de roles (`services/__mocks__/roles-mock.js` siempre asigna `tier:
'base'`), pero el negocio ya define tres: **base 10, pro 50, premium
300**. Se agrega `TEAM_MEMBER_LIMITS` + `getTeamMemberLimit(tier)` en
`store/team-store.js` con esos tres valores y fallback a `base` para
cualquier tier desconocido o ausente — listo para cuando el sistema de
tiers crezca, sin tener que tocar esta pantalla de nuevo.

El campo de cantidad máxima muestra el tope en el propio label ("hasta N
en tu plan") y lo valida en el submit (entero, ≥ 1, ≤ tope). Sin mínimo
más allá de eso, tal como se pidió.

### Requerimientos de entrada

Campo de texto libre (`InputField multiline`) por ahora. Queda comentado
en el código que a futuro pasa a ser una selección de requerimientos
estandarizados (combobox) en vez de texto libre — cambio de UI, no de
alcance de esta spec.

### Foto de perfil del equipo

Nueva dependencia `expo-image-picker` (`~17.0.11`, instalada con `npx expo
install` para asegurar la versión compatible con SDK 54). Se agrega el
plugin a `app.config.js` con el mensaje de permiso de fotos
(`photosPermission`). Usa la API actual de `mediaTypes: ['images']` (no
`MediaTypeOptions`, deprecado). Sin edición ni recorte más allá de
`allowsEditing` + `aspect: [1, 1]` nativo de la librería — no se construye
un editor de imagen propio.

### Invitar corredores por email

`EmailListField`, primitivo nuevo en `components/forms/fields.jsx` (mismo
archivo que el resto de los campos compartidos). Reutiliza
`validateEmailFormat` de `utils/email-validators.js` — no se reimplementa
la validación. Flujo: escribir un email, botón "Agregar" lo valida
(formato + no duplicado) y lo suma como chip debajo del campo, con botón
de quitar por chip. El envío real de las invitaciones es tarea del
backend — no existe ningún servicio de envío de mails en este repo
(se revisó `services/`, no hay nada parecido). Por ahora los emails
cargados solo se guardan junto con el resto de los datos del equipo en
`createTeam`; cuando exista el endpoint de equipos, ese payload ya está
armado para mandarse tal cual.

### Pantalla vs modal

Pantalla completa con ruta propia (`/equipos/crear`), mismo patrón que
`RegisterScreen`/`EditProfileScreen`/`ActivateTrainerScreen` — no hay
ningún formulario grande en la app que use un modal, así que no se
introduce ese patrón nuevo acá.

### Después de crear

`createTeam` agrega el equipo al store y lo selecciona (`selectedTeamId`).
La pantalla muestra un toast de éxito (distinto texto si se cargaron
emails, aclarando que las invitaciones se mandan cuando exista el backend)
y hace `router.back()` — no hay pantalla de detalle de equipo todavía a
la cual navegar (esa es la que se está diseñando aparte con Stitch).

## Fuera de alcance

Pantalla de detalle del equipo recién creado, combobox de requerimientos
estandarizados, envío real de invitaciones (backend), recorte/editor de
imagen propio, límites de equipos totales por entrenador (solo se valida
integrantes por equipo, no cantidad de equipos).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse, abrir "Equipos" (dropdown en web
ancho, drawer angosto en web narrow, drawer en mobile) → "Crear equipo"
navega a `/equipos/crear` en los tres casos. Completar nombre, nivel y
una cantidad de integrantes dentro del tope (10 por default, mock
`tier: 'base'`) → "Crear" muestra el toast de éxito y vuelve atrás. Cargar
una cantidad de integrantes mayor al tope → error inline, no permite
enviar. Agregar/quitar emails con el campo de invitación, incluyendo un
email inválido y un duplicado, verificando los mensajes de error
correspondientes.

`npm test` → 37/37. `npm run lint` → limpio.
