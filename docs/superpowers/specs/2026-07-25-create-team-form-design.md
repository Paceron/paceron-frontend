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

`store/team-store.js` (acción `createTeam` + tope de integrantes por tier
+ grupos + grupo default), `components/forms/fields.jsx` (`InputField`
con `multiline`/`hint`/`dense`, `PickerField` con `dense`, nuevo
`EmailListField` con selector de grupo por invitación),
`components/team/create-team-screen.jsx` (nuevo, incluye la sección de
grupos), `app/(tabs)/equipos/crear.jsx` (nuevo), los tres shells
(`app-web-shell.jsx`, `app-web-shell-narrow.jsx`, `app-mobile-shell.jsx`
— cambia el `handleCreateTeam` de toast a navegación),
`package.json`/`app.config.js` (nueva dependencia `expo-image-picker`).

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

### Grupos del equipo

Un equipo puede tener varios grupos. Se arman en el mismo formulario:
nombre + combobox de plan de entrenamiento (`TRAINING_PLAN_OPTIONS`, mock
local — no existe todavía el dominio de planificación de entrenamientos,
ver `FUNCTIONAL_PROPOSE.md`), botón "Agregar grupo", lista de chips
removibles debajo. `store/team-store.js` no persiste nada de esto hasta
el submit final (`createTeam` recibe el array de grupos armado).

**Regla de negocio: no hay integrante sin grupo.** Todo equipo, al
crearse, suma automáticamente un grupo adicional invisible para el
usuario como tal — a nivel de datos es un grupo más (con `isDefault:
true`), pero su nombre visible es literalmente **"Sin grupo"**
(`DEFAULT_GROUP_NAME`). No se crea ni se edita desde este formulario, lo
agrega `createTeam` siempre, al margen de los grupos que arme el
entrenador. Si se borra un grupo recién creado en el formulario, las
invitaciones que apuntaban a él vuelven a "Sin grupo" (no quedan
huérfanas apuntando a un grupo que ya no existe).

### Invitar corredores por email

`EmailListField`, primitivo nuevo en `components/forms/fields.jsx` (mismo
archivo que el resto de los campos compartidos). Reutiliza
`validateEmailFormat` de `utils/email-validators.js` — no se reimplementa
la validación. Cada invitación es `{ email, groupId }`: el campo tiene un
selector de grupo entre el input de email y el botón "Agregar" (recibe
`groups`, los grupos armados hasta ese momento en el mismo formulario) —
si no se elige ninguno, `groupId` queda `''` y se resuelve al grupo
default recién en `createTeam`, nunca antes. El envío real de las
invitaciones es tarea del backend — no existe ningún servicio de envío
de mails en este repo (se revisó `services/`, no hay nada parecido). Por
ahora los emails cargados solo se guardan junto con el resto de los
datos del equipo en `createTeam`; cuando exista el endpoint de equipos,
ese payload ya está armado para mandarse tal cual.

### Pantalla vs modal

Pantalla completa con ruta propia (`/equipos/crear`), mismo patrón que
`RegisterScreen`/`EditProfileScreen`/`ActivateTrainerScreen` — no hay
ningún formulario grande en la app que use un modal, así que no se
introduce ese patrón nuevo acá.

### Wizard de 3 pasos, no 3 rutas

El formulario se dividió en 3 pasos (1. Datos del equipo, 2. Grupos, 3.
Invitar corredores) dentro de la misma ruta `/equipos/crear` — no son 3
pantallas/rutas separadas. Se eligió así en vez de rutas independientes
porque no hay precedente en el proyecto de un wizard multi-ruta (habría
necesitado un estado de "borrador" compartido entre pantallas, nuevo y
más complejo), mientras que un wizard de un solo componente con estado
interno (`step`) es una extensión directa del patrón de secciones
colapsables que ya usa `RegisterScreen`.

- Paso 1 valida (nombre, nivel, cantidad de integrantes) antes de dejar
  avanzar a "Siguiente".
- Paso 2 (Grupos) es **completamente opcional** — "Siguiente" avanza
  exista o no algún grupo cargado, sin validación bloqueante.
- Paso 3 (Invitar) es el único con el botón final "Crear".
- Volver con "Atrás" conserva todo lo cargado en los pasos anteriores
  (el estado vive en `CreateTeamScreen`, no se pierde entre pasos).

**Si no se creó ningún grupo, el paso de invitar no muestra el selector
de grupo.** `EmailListField` ahora sólo renderiza el `InlinePicker` de
grupo cuando `groups.length > 0` — con cero grupos no tiene sentido
mostrar un combobox cuya única opción posible sería "Sin grupo". Mismo
criterio en los chips: solo muestran el grupo si hay más de uno posible.

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
integrantes por equipo, no cantidad de equipos), dominio real de planes
de entrenamiento (el combobox usa un catálogo mock), UI de gestión de
grupos post-creación (renombrar/borrar grupos de un equipo ya creado,
mover integrantes entre grupos desde una pantalla de equipo — el flag
`isDefault` ya deja la puerta abierta para esa protección a futuro).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse, abrir "Equipos" (dropdown en web
ancho, drawer angosto en web narrow, drawer en mobile) → "Crear equipo"
navega a `/equipos/crear` en los tres casos. Completar nombre, nivel y
una cantidad de integrantes dentro del tope (10 por default, mock
`tier: 'base'`) → "Crear" muestra el toast de éxito y vuelve atrás. Cargar
una cantidad de integrantes mayor al tope → error inline, no permite
enviar. Agregar/quitar emails con el campo de invitación, incluyendo un
email inválido y un duplicado, verificando los mensajes de error
correspondientes. Crear uno o más grupos con y sin plan asignado,
invitar un email a un grupo puntual y otro sin elegir grupo, borrar un
grupo con una invitación asignada y confirmar que esa invitación vuelve
a "Sin grupo". Confirmar que el paso 2 se puede pasar sin cargar ningún
grupo, que "Atrás" conserva los datos ya cargados, y que sin grupos
creados el paso 3 no muestra ningún selector de grupo junto al email.

`npm test` → 39/39. `npm run lint` → limpio.
