# Antigüedad de corredores y gestión de invitaciones — Design

**Fecha:** 2026-07-28
**Estado:** Aprobado, implementado (requisitos charlados y aprobados en el chat, sin plan formal separado)

## Contexto

Dos huecos en la gestión de un equipo ya existente: no había forma de ver
hace cuánto tiempo está un corredor en el equipo, y las invitaciones por
email solo existían durante la creación del equipo (wizard, paso 3) — una
vez creado, no había forma de invitar más gente ni de ver el estado de
las invitaciones ya mandadas.

## Alcance de esta spec

`store/team-store.js` (`joinedAt` en el roster mock, `invitedAt` +
`registered` en las invitaciones, acción `addInvitedEmails`),
`utils/relative-time.js` (nuevo), `components/team/team-detail-screen.jsx`
(antigüedad en `RunnerRow`, botón "Invitar corredores" en la sección
Corredores), `components/team/invite-team-members-screen.jsx` (nuevo),
`app/(tabs)/equipos/[teamId]/invitar.jsx` (nuevo), `__tests__/team-store.test.js`.

## Decisiones

### Antigüedad: texto relativo, no una fecha cruda

`generateMockMembers` suma `joinedAt` a cada corredor mock, escalonado 30
días por integrante (determinista, mismo criterio que el resto del
roster mock) para que no todos muestren la misma antigüedad. Se muestra
como "Hace X meses/años en el equipo" — no la fecha exacta, no aporta
más al entrenador y una fecha cruda pide más lectura. La función
`formatRelativeTime` (`utils/relative-time.js`) es genérica a propósito:
la reutiliza también la pantalla de invitaciones para "hace cuánto se
invitó".

En `RunnerRow` (pestaña Corredores) va como texto plano debajo del email,
no como tag — ya se sacó un tag (nivel) de esta fila hace poco por
crowding en mobile (ver spec de la pantalla de detalle), así que sumar
antigüedad como línea de texto vertical (no compite por ancho horizontal
con los tags de grupo/suscripción) evita repetir ese problema.

### Invitaciones: una sola pantalla, no dos

Se evaluó (y descartó) tener dos botones separados — uno de solo lectura
para "ver invitaciones pendientes" y otro aparte para "invitar" — porque
`EmailListField` (el mismo componente que ya arma el paso 3 del wizard de
creación) ya resuelve ambas cosas junta: muestra lo cargado y deja
agregar más. Decisión final del usuario: **una sola pantalla**
`InviteTeamMembersScreen` (`/equipos/[teamId]/invitar`), con dos
secciones:

1. **Solicitudes pendientes** — listado de solo lectura, más presentable
   que los chips simples del wizard: por cada invitación, email, grupo
   asignado, hace cuánto se hizo (`formatRelativeTime`), y un tag "Usuario
   registrado" / "Sin registrar".
2. **Invitar más corredores** — el mismo `EmailListField` de siempre,
   sobre una lista local que arranca vacía (no reusa el listado de
   arriba); al guardar (`addInvitedEmails`) se suman al equipo sin pisar
   las invitaciones ya existentes.

No se pidió (ni se implementó) cancelar una invitación ya mandada — la
pantalla solo agrega. `EmailListField` seguía permitiendo sacar un chip
de la lista local antes de guardar (eso es "arrepentirse de un email que
todavía no mandaste", no cancelar una invitación real).

### "Usuario registrado" vs. "sin registrar": mock determinista, no un directorio real

No hay backend de equipos ni de invitaciones, y mucho menos un endpoint
para chequear si un email pertenece a un usuario existente. En vez de
inventar una lista global de "usuarios registrados" en el store (otro
dominio aparte, sin necesidad real todavía), `isRegisteredMockEmail`
deriva el estado matemáticamente del email mismo (suma de códigos de
carácter, par/impar) — mismo email siempre da el mismo resultado, así
que sirve para probar la pantalla sin ser una fuente de verdad real. Se
documenta así en el código para que quede claro que es un placeholder,
no una intención de producto.

### Botón "Invitar" vive en la sección/pestaña Corredores, discreto

Mismo lugar que ya tiene sentido para gestión de roster. Gateado por
`canManageTeam` (mismo criterio que "Crear equipo"/editar equipo/editar
grupo: rol entrenador asignado Y activo ahora mismo). Primera versión era
un botón pill grande con ícono y contador de pendientes ("Invitar
corredores · N pendientes"); a pedido del usuario pasó a ser discreto —
solo la palabra "Invitar", texto plano color primario, sin ícono ni
contador, ubicado arriba a la derecha de la card "Corredores", alineado
con el título. Esto no existía como slot en `SectionCard`
(`components/forms/section-card.jsx`) — se le agregó `headerRight`
(nodo opcional que se renderiza al final de la fila del header, el
título ahora con `flex-1` para empujarlo a la derecha), sin cambiar el
comportamiento para el resto de los usos existentes del componente
(profile, register, edit-profile) que no lo pasan.

### `addInvitedEmails`: solo agrega, ignora duplicados

Nueva acción del store, separada de `createTeam` (que arma las
invitaciones iniciales del wizard). Ambas comparten `buildInvitedEmail`
para no duplicar la lógica de resolver el grupo default y completar
`invitedAt`/`registered`. Si un email ya estaba invitado (comparación
case-insensitive), se ignora en vez de duplicarlo o pisar su
`invitedAt` original.

## Fuera de alcance

Cancelar/reenviar una invitación ya mandada, un directorio real de
usuarios registrados, aceptar una invitación y pasar a formar parte del
roster real (sigue siendo mock, ver spec de la pantalla de detalle),
mostrar antigüedad en la pestaña Grupos (se mantiene con nombre + tag de
suscripción nada más, sin sumarle más datos por fila).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse como entrenador activo, abrir el
detalle de "Corredores del Sur" (`team-1`, tiene invitaciones sembradas)
→ en Corredores, cada corredor muestra "Hace X meses en el equipo" debajo
del email; el botón "Invitar corredores · 2 pendientes" navega a
`/equipos/team-1/invitar`, donde "Solicitudes pendientes" muestra las 2
invitaciones sembradas (grupo, antigüedad, registrado/sin registrar) y
"Invitar más corredores" permite cargar y mandar invitaciones nuevas —
al volver al detalle, el contador del botón se actualiza. Con otro
equipo mock sin invitaciones sembradas, la sección muestra el estado
vacío. Con el rol activo en `corredor` (o sin rol de entrenador), el
botón "Invitar corredores" no aparece.

`npm test` → 51/51. `npm run lint` → limpio.
