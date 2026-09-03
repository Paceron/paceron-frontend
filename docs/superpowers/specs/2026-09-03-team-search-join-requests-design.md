# Búsqueda de equipos + solicitudes de ingreso — Design

**Fecha:** 2026-09-03
**Estado:** Aprobado — diseño de interfaz previo a spec de backend, sin implementación todavía

## Contexto

Hoy la única forma de que un corredor entre a un equipo es que un
entrenador lo invite (`services/invitations.js`, flujo ya implementado).
Esta spec agrega el camino inverso: el corredor busca equipos públicos y
pide unirse; el entrenador acepta o rechaza. Es simétrico al de
invitaciones — mismo dominio (relación equipo↔corredor), visto desde el
otro lado.

**Esta spec define el frontend primero, sin backend real todavía.** No
hay contrato entregado — la sección "Contrato de backend propuesto" es
lo que este frontend necesita, para llevárselo al backend como pedido,
no una confirmación de algo ya existente (a diferencia de specs
anteriores donde el contrato ya venía dado). La implementación real
espera a que esos endpoints existan; hasta entonces esto queda como
documento de diseño.

Geolocalización real (búsqueda por distancia, no por país/provincia/
ciudad) queda **fuera de esta spec a propósito** — el usuario la ligó a
un problema más grande (tracking en vivo de sesiones de entrenamiento
presencial, que exige buena precisión/latencia) que amerita su propio
diseño cuando se aborde. Ver `docs/BACKEND_API_GAPS.md` para dejarlo
anotado como gap futuro propio.

Un sistema genérico de notificaciones (tipos, leído/no-leído,
extensible a eventos futuros) también queda fuera — esta spec resuelve
la campana/badge con la métrica puntual que hace falta hoy (pendientes
de invitaciones/solicitudes), sin construir infraestructura genérica.

## Alcance de esta spec

**Nuevo:** `app/(tabs)/teams/search.jsx` + `components/team/team-search-screen.jsx`,
`app/(tabs)/notifications.jsx` + `components/notifications/notifications-screen.jsx`
(reemplaza `app/(tabs)/invitations.jsx` + `components/invitations/received-invitations-screen.jsx`),
`hooks/use-team-search.js`, `hooks/use-join-requests.js`,
`services/join-requests.js` (+ mock), `components/team/team-requests-tab.jsx`.

**Modificado:** `routes/catalog.js` (saca `invitationsRoute`),
`components/shell/app-web-shell.jsx` / `app-web-shell-narrow.jsx` /
`app-mobile-shell.jsx` (campana/fila de notificaciones con badge, en vez
del tab de Invitaciones), `components/team/teams-list-screen.jsx` (botón
de búsqueda + dot de novedad por equipo), `components/team/team-detail-screen.jsx`
(tab "Solicitudes"), `components/team/edit-team-screen.jsx` (checkboxes
de visibilidad/privacidad), `services/normalizers.js` (`toTeamModel`
suma `visible`/`isPublic`, nuevo `toJoinRequestModel`).

## Decisiones

### Modelo de datos nuevo

Equipo suma 2 campos, mismo criterio que `showGroupsToRunners`
(edit-only, no aparecen en el wizard de creación — se configuran
después desde `edit-team-screen.jsx`):

- `visible` (bool) — aparece o no en resultados de búsqueda.
- `isPublic` (bool) — "privacidad" del equipo. Público habilita el botón
  "Solicitar unirse"; privado lo deja deshabilitado (el equipo se ve en
  la búsqueda igual si `visible: true`, pero no se puede pedir entrar —
  solo por invitación).

Solicitud de ingreso — objeto nuevo, sin equivalente hoy:
`{ id, teamId, teamName, runnerId, runnerName, status, createdAt }`,
`status` en `'pending' | 'accepted' | 'rejected'`. A diferencia de la
invitación (que sí elige grupo al mandarla), el corredor no conoce la
estructura interna de grupos del equipo — al aceptar, se asigna directo
al grupo default del equipo (mismo que ya existe desde la creación). El
entrenador puede reasignarlo a otro grupo después con la acción "mover"
que ya existe en el roster (`RunnerActionsMenu`).

### Búsqueda — pantalla nueva, entrada desde `/teams`

Botón de búsqueda (ícono lupa) arriba a la derecha en
`teams-list-screen.jsx`, visible solo para corredor (mismo criterio que
hoy usa `canCreateTeam` para mostrar "Crear equipo" solo a entrenador) →
navega a `/teams/search`.

Filtros: nombre (texto), nivel (reusa `LEVEL_OPTIONS`, ya existe en
`team-general-info-fields.jsx`), país→provincia→ciudad (reusa
`useAddressCascade`, mismo hook que ya arma el cascade en el alta de
equipo). Búsqueda explícita con botón "Buscar" — no auto-search en cada
tecla, consistente con que "Cargar más" (ver paginación abajo) también
es una acción explícita del usuario, no automática.

Resultados como cards paginadas, "Cargar más" acumula (no hay
precedente de paginación en el repo hoy — primer caso, ver sección
Estado del servidor). Cada card: nombre, ícono (`AvatarPicker` de solo
lectura, `fallbackIcon="account-group"`, mismo componente que ya se usa
en `team-detail-screen.jsx`), nivel, ubicación (ciudad/provincia), cupo
(miembros actuales / `maxMembers`), nombre del entrenador dueño, botón
"Solicitar unirse" con 4 estados:

1. Habilitado — equipo público, con cupo, sin solicitud previa.
2. Deshabilitado, "Equipo completo" — cupo lleno.
3. Deshabilitado, "No acepta solicitudes" — `isPublic: false`.
4. Deshabilitado, "Solicitud enviada" — ya hay una solicitud propia
   pendiente a ese equipo (se puede cancelar desde `/notifications`, no
   desde acá).

Equipos donde el corredor ya es miembro quedan excluidos de los
resultados. `visible: false` nunca aparece, sin importar el resto de
filtros.

### Lado entrenador — tab "Solicitudes" en el equipo, no en notificaciones

Las solicitudes de ingreso a un equipo se resuelven (aceptar/rechazar)
desde una 4ta tab en `team-detail-screen.jsx` ("Solicitudes"), junto a
General/Corredores/Grupos — mismo gate que ya existe para dueño
(`canDeleteTeam`, `canManageTeam && team?.ownerId === user?.userId`).
Cada fila: nombre del corredor + botones aceptar/rechazar, sin modal de
confirmación (mismo patrón que `received-invitations-screen.jsx` hoy —
tap directo, Toast si falla).

`/notifications` (ver abajo) es donde el entrenador **se entera** que
hay solicitudes pendientes (agregado entre todos sus equipos), pero no
resuelve nada ahí — cada ítem linkea a la tab Solicitudes del equipo
correspondiente.

**Dot de novedad en el listado de equipos:** en `teams-list-screen.jsx`,
la card de un equipo administrado con solicitudes pendientes sin
resolver muestra un punto rojo (mismo tipo de indicador que ya existe
para el badge de invitaciones en el drawer mobile,
`mobile-drawer-route-invitations-badge`). Pensado extensible a futuros
tipos de "novedad" en el equipo, no solo solicitudes — por ahora la
única fuente es esta.

### Notificaciones — reemplaza el tab "Invitaciones", sin dropdown

`routes/catalog.js` pierde `invitationsRoute` — deja de ser un tab de
navegación. En su lugar:

- **Web ancho** (`app-web-shell.jsx`): ícono de campana en el `TopBar`,
  a la derecha del user pill, con badge si hay pendientes. `onPress` →
  `router.push('/notifications')`.
- **Narrow-web y mobile** (drawer-based, sin topbar-right ni mecanismo
  de dropdown hoy): fila "Notificaciones" en el drawer, mismo lugar
  donde hoy renderiza el nav-route de Invitaciones, mismo badge.

Los 3 casos navegan a una pantalla propia (`/notifications`), no abren
un dropdown — evita duplicar el fetch de datos en un panel aparte y da
paridad real entre las 3 plataformas (un dropdown solo existiría en el
shell wide-web). Queda anotado como posible mejora futura si el
contenido crece lo suficiente como para justificar un preview rápido
sin salir de la pantalla actual.

`notifications-screen.jsx` reemplaza a
`received-invitations-screen.jsx` — mismo contenido de invitaciones
recibidas (con su accept/reject ya implementado) más:

- **Corredor:** sección nueva "Mis solicitudes enviadas" — lista de
  solicitudes propias con su estado, botón "Cancelar" en las
  `pending`. Sin badge propio (no requieren acción del corredor,
  a diferencia de una invitación recibida) — el badge sigue siendo
  solo por invitaciones recibidas pendientes, igual que hoy
  (`myInvitationsCount`).
- **Entrenador:** sección "Solicitudes pendientes" — agregado de todos
  sus equipos con solicitudes sin resolver, cada ítem linkea a la tab
  Solicitudes del equipo. El badge de la campana/drawer para entrenador
  cuenta este agregado.

Sin sistema de leído/no-leído en esta versión — el badge es un conteo
de pendientes (mismo criterio que ya usa `myInvitationsCount` hoy), no
un contador de "no vistos".

### Estado del servidor — TanStack Query, no Zustand

Por convención ya escrita en `CLAUDE.md` ("nuevo trabajo sobre datos de
servidor en equipos/grupos/invitaciones puede seguir este patrón"):
búsqueda y solicitudes son estado de servidor nuevo, van con Query, no
se extiende el Zustand de `store/team-store.js`.

- `hooks/use-team-search.js` — `useQuery` con `queryKey: ['team-search',
  filters, page]`, mismo criterio de cache-por-key que ya usa
  `use-team-roster.js` (primer uso real de Query en el repo). "Cargar
  más" incrementa `page` y concatena resultados client-side (no hace
  falta `useInfiniteQuery` para un caso de una sola dirección de scroll
  con botón explícito).
- `hooks/use-join-requests.js` — `useQuery` para "mis solicitudes
  enviadas" y para "solicitudes de un equipo" (tab del entrenador),
  `useMutation` para crear/cancelar/aceptar/rechazar, invalidando las
  queries relacionadas al resolver.

### Servicio y mocks

`services/join-requests.js` (nuevo), mismo molde que el resto de
`services/teams.js`/`services/invitations.js` (gate por `USE_MOCKS`):
`searchTeams(filters, page)`, `createJoinRequest(teamId)`,
`cancelJoinRequest(requestId)`, `listMyJoinRequests()`,
`listTeamJoinRequests(teamId)`, `respondJoinRequest(requestId, accept)`.
Mock correspondiente en `services/__mocks__/join-requests-mock.js`
sobre datos en memoria (mismo criterio que el resto de los mocks del
repo — útil standalone, no un no-op).

## Contrato de backend propuesto (pendiente, no confirmado)

| Método | Path | Quién | Notas |
|---|---|---|---|
| GET | `/api/v1/teams/search` | cualquiera autenticado | query params: `name`, `level`, `country`, `province`, `city`, `page`. Filtra por `visible: true` server-side. Devuelve equipo + `owner_name` + conteo de miembros. |
| POST | `/api/v1/teams/{id}/join-requests` | corredor | crea solicitud propia, `pending`. |
| DELETE | `/api/v1/join-requests/{id}` | corredor dueño de la solicitud | cancela mientras esté `pending`. |
| GET | `/api/v1/join-requests/mine` | corredor | solicitudes propias, cualquier estado. |
| GET | `/api/v1/teams/{id}/join-requests` | entrenador dueño | solicitudes pendientes de ese equipo. |
| POST | `/api/v1/join-requests/{id}/accept` | entrenador dueño | asigna al corredor al grupo default del equipo. |
| POST | `/api/v1/join-requests/{id}/reject` | entrenador dueño | — |
| PATCH | `/api/v1/teams/{id}` | entrenador dueño | suma `visible`/`is_public` al payload ya existente. |

Falta además una forma de contar solicitudes pendientes agregadas por
entrenador (para el badge) sin traer el detalle completo de cada
equipo — a definir con el backend si es un endpoint propio
(`GET /join-requests/pending-count`) o se resuelve client-side sumando
`GET /teams/{id}/join-requests` por cada equipo administrado (más
simple de arrancar, pero N requests si el entrenador tiene varios
equipos).

## Fuera de alcance

Geolocalización real (distancia, GPS) — queda para cuando se aborde
junto con tracking en vivo de sesiones. Sistema genérico de
notificaciones (tipos, leído/no-leído, extensible) — el badge de esta
spec es puntual, no una infraestructura reusable todavía. Dropdown de
notificaciones en el topbar wide-web — se navega a pantalla completa
en las 3 plataformas por ahora. Elegir grupo al aceptar una solicitud
— siempre va al grupo default, sin selector.

## Verificación

Con `EXPO_PUBLIC_USE_MOCKS=true`: buscar equipos con distintos filtros
en `/teams/search`, pedir unirse, ver el estado cambiar a "Solicitud
enviada". Desde una segunda cuenta (o mock de datos de otro equipo)
verificar la tab Solicitudes del entrenador, aceptar/rechazar, y que el
corredor termine en el grupo default. Cancelar una solicitud propia
desde `/notifications`. Dot de novedad en `teams-list-screen.jsx`
cuando hay solicitudes pendientes sin resolver.

`npm test` y `npm run lint` en verde antes de abrir la PR — cuando se
implemente, una vez confirmado el contrato real contra el backend.
