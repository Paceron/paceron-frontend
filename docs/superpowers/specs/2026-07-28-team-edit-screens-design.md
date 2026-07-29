# Editar equipo y editar grupo — Design

**Fecha:** 2026-07-28
**Estado:** Aprobado, implementado (requisitos charlados y aprobados en el chat, sin plan formal separado)

## Contexto

La pantalla de detalle de equipo (`docs/superpowers/specs/2026-07-28-team-detail-screen-design.md`)
era de solo lectura. No existía forma de editar los datos generales de un
equipo ni los datos de un grupo puntual — ninguna de las dos pantallas
existía todavía.

## Alcance de esta spec

`hooks/use-team-general-info-form.js` (nuevo),
`components/team/team-general-info-fields.jsx` (nuevo),
`components/team/create-team-screen.jsx` (refactor: el paso 1 pasa a usar
el hook y el componente compartidos, sin cambio de comportamiento),
`components/team/edit-team-screen.jsx` (nuevo),
`components/team/edit-group-screen.jsx` (nuevo),
`components/team/team-detail-screen.jsx` (lápiz "editar equipo" en el
header, sección Grupos ampliada con miembros + lápiz "editar grupo" por
fila), `store/team-store.js` (`updateTeam`, `updateGroup`), reestructura
de rutas (`app/(tabs)/equipos/[teamId].jsx` → `[teamId]/index.jsx` +
`[teamId]/editar.jsx` + `[teamId]/grupos/[groupId]/editar.jsx`),
`__tests__/team-store.test.js`.

## Decisiones

### Editar equipo: solo datos generales, mismos campos que el paso 1 del wizard

`EditTeamScreen` es una pantalla de un solo paso (no un wizard) con
exactamente los mismos campos que el paso 1 de "Crear equipo": nombre,
foto, país/provincia/localidad, descripción, nivel, cupo máximo,
requisitos. Grupos e invitaciones quedan fuera — grupos ya se gestionan
en su propia pantalla nueva (`EditGroupScreen`, ver abajo) y no existe
(todavía) un flujo para re-editar invitaciones después de creado el
equipo. Elegido explícitamente por el usuario en vez de reusar el wizard
completo en modo edición.

Para no duplicar los campos (foto, cascada de ubicación, descripción,
nivel/cupo, requisitos) entre `CreateTeamScreen` (paso 1) y
`EditTeamScreen`, se extrajeron a:

- `hooks/use-team-general-info-form.js` — estado de los campos,
  selector de foto (`expo-image-picker`) y validación
  (`validateStep1` original, ahora `validate()`), parametrizado por
  `initial` (vacío al crear, el equipo real al editar) y `maxAllowed`
  (tope de integrantes del plan del entrenador).
- `components/team/team-general-info-fields.jsx` — el JSX de esos
  campos, recibe el `form` del hook de arriba. `idPrefix` distingue los
  nativeID/testID de los wrappers entre las dos pantallas (nunca están
  montadas a la vez, pero mantiene los ids legibles).

`CreateTeamScreen` se refactorizó para usar ambos en su paso 1 — mismo
comportamiento visual y de validación que antes, sin cambios de
producto, solo se movió el código a un lugar compartido.

### Editar grupo: pantalla propia, mismos 3 campos que "agregar grupo"

`EditGroupScreen` es un formulario chico (nombre + descripción + plan de
entrenamiento) — mismos campos que `GroupListEditor` para agregar un
grupo nuevo al crear un equipo. La descripción no existía en ninguno de
los dos lugares antes de esta vuelta (los grupos solo tenían nombre y
plan) — se sumó a la vez a `GroupListEditor` (crear) y `EditGroupScreen`
(editar) para no dejar la asimetría de "se puede describir un grupo
editándolo pero no al crearlo". No permite editar membresía (mover
corredores de grupo es "fuera de alcance" desde la spec original de la
pantalla de detalle, sigue sin implementarse) ni tocar el grupo default
"Sin grupo" — no tiene sentido renombrar el bucket al que cae todo
corredor sin grupo elegido, así que ese grupo en particular no muestra
el lápiz de edición en la pestaña Grupos.

### Sección "Grupos" ampliada: datos del grupo + sus corredores

Cada grupo pasa a mostrar, además de nombre/plan/cantidad, la lista de
corredores que lo integran (nombre + tag de estado de suscripción, mismo
criterio de color que en Corredores). En web, con espacio de sobra, la
lista va siempre visible debajo de cada grupo. En mobile es una card
expandible — mismo patrón que `RunnerRow` (ver spec de la pantalla de
detalle): colapsada por default (solo nombre/plan/cantidad + chevron),
tocarla muestra los corredores. El lápiz de edición es un botón aparte
(hermano del `Pressable` que expande, no anidado) para que tocarlo no
dispare también el expand/collapse.

### Quién puede editar: mismo criterio que "Crear equipo"

Sin modelo de dueño de equipo todavía (cualquier equipo es editable por
cualquier entrenador, no solo por quien lo creó — limitación conocida,
igual que en el resto del dominio de equipos). El lápiz de "editar
equipo" en el header y los lápices de "editar grupo" en la pestaña
Grupos usan el mismo gate que ya existía para el botón "Crear equipo" en
los shells: `hasTrainerRole && activeRole === 'trainer'` (rol asignado
Y activo ahora mismo, no alcanza con tenerlo asignado nada más).

### Reestructura de rutas

`app/(tabs)/equipos/[teamId].jsx` (archivo) pasa a
`app/(tabs)/equipos/[teamId]/index.jsx` (mismo contenido, misma ruta
`/equipos/[teamId]`) para poder anidar rutas hijas bajo el mismo segmento
dinámico — Expo Router no permite que `[teamId]` sea archivo y carpeta a
la vez. Rutas nuevas: `/equipos/[teamId]/editar` (`EditTeamScreen`) y
`/equipos/[teamId]/grupos/[groupId]/editar` (`EditGroupScreen`).

### `updateTeam` / `updateGroup` en el store

Ambas acciones hacen un merge superficial de los campos recibidos sobre
el equipo/grupo encontrado por id — no tocan nada más (`updateTeam` no
toca `groups`/`members`/`invitedEmails`/`status`; `updateGroup` no toca
membresía). Mismo patrón inmutable que `createTeam` ya usaba
(`teams.map(...)`, sin mutar el estado anterior).

## Fuera de alcance

Editar invitaciones ya enviadas, mover un corredor de grupo, borrar un
grupo (ni siquiera el default), reasignar el nivel/cupo más allá de
validarlo contra el plan del entrenador, modelo de "dueño" de equipo
(cualquier entrenador activo puede editar cualquier equipo hoy), crear
un grupo nuevo desde la pantalla de detalle de un equipo ya existente
(la pestaña Grupos sigue sin botón "Agregar grupo" — `GroupListEditor`
ya está preparado para ese caso de uso a futuro, ver su comentario, pero
no se pidió en esta vuelta).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse como entrenador (rol activo
`trainer`), abrir el detalle de cualquier equipo → aparece un lápiz
junto al nombre del equipo (header) que navega a `/equipos/[teamId]/editar`
con los mismos campos que el paso 1 del wizard, precargados con los
datos del equipo; guardar vuelve al detalle con los cambios reflejados.
En la pestaña/sección Grupos, cada grupo (menos "Sin grupo") tiene su
propio lápiz que navega a `/equipos/[teamId]/grupos/[groupId]/editar`
(nombre + plan, precargados); guardar refleja el cambio en el detalle.
En mobile, cada grupo arranca colapsado (nombre + cantidad + plan) y se
expande al tocarlo mostrando sus corredores; en web la lista de
corredores de cada grupo va siempre visible. Con el rol activo en
`corredor` (o sin rol de entrenador), ningún lápiz aparece.

`npm test` → 49/49. `npm run lint` → limpio.
