# Equipos: rutas en inglés + backend real + selects consistentes (Etapa 1 de 3) — Design

**Fecha:** 2026-07-28
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El compañero terminó las pantallas de equipos/grupos/invitaciones (`components/team/*`), pero todo corre 100% en memoria contra `store/team-store.js` (`MOCK_TEAMS`) — nada pega contra el backend, que mientras tanto sumó endpoints reales para equipos, grupos, miembros e invitaciones. Además quedaron dos inconsistencias a corregir: las rutas de `equipos/` están en español (único lugar de toda la app con rutas en español) y algunos selects en web (nivel de equipo, plan de entrenamiento) usan el picker modal de mobile en vez del `<select>` nativo que ya usan los campos de ubicación.

El trabajo es grande (equipos + grupos + invitaciones), así que se aborda en 3 etapas, cada una en su propia rama: **esta etapa es solo Equipos** — Grupos y las invitaciones (bloqueadas en parte por huecos de backend) quedan para etapas siguientes, una vez cerrada esta.

Revisando el swagger del backend contra lo que ya construyó el compañero, aparecieron varios huecos reales (campos/endpoints que la interfaz ya necesita y el backend todavía no tiene) — se documentan en un archivo nuevo (`docs/BACKEND_API_GAPS.md`) en vez de intentar inventar soluciones alternativas del lado del front. Un resumen más narrativo de estos huecos, pensado para que el equipo de backend arme sus propias specs, se compartió por fuera del repo.

## Alcance

**Dentro:** rename de rutas `equipos/` → `teams/` (toda la subárbol, incluidas las pantallas de grupos/invitaciones que todavía no se conectan a datos reales en esta etapa), capa de servicio real para equipos (`services/teams.js`), wiring de `store/team-store.js` para crear/leer/actualizar equipos contra el backend real, fix del picker de nivel de equipo en web, documentación de huecos de backend.

**Fuera:** wiring de datos de grupos (`updateGroup`) e invitaciones (`addInvitedEmails`) — quedan local-only, Etapa 2/3. Roster de miembros del equipo (`team.members`) sigue siendo sintético (no se conecta `getTeamUsers` a la UI todavía). Plan de entrenamiento por grupo, aceptar/rechazar invitación — bloqueados por huecos de backend, documentados pero no resueltos acá.

## Decisiones

### Menú de equipos del shell: solo administrados

Filtrar del lado del cliente por `owner_id === user.userId` sobre el resultado de `GET /teams` (que devuelve todo el sistema sin filtro — no existe `GET /users/{id}/teams`). Los equipos donde el usuario es corredor no se pueden listar todavía (hueco de backend #1), quedan afuera del menú por ahora en vez de traer el catálogo completo del sistema a un menú personal.

### Secuenciación de creación de equipo: dirección es una llamada aparte

El backend modela la dirección del equipo como un endpoint separado (`PUT /teams/{id}/address`, no parte de `POST /teams`) — decisión ya tomada del lado de backend, se acepta tal cual está. El flujo de creación hace `POST /teams` y, si el usuario cargó algún campo de dirección, encadena inmediatamente `PUT /teams/{id}/address`.

**Si la segunda llamada falla** (el equipo ya existe, sin dirección): se trata como éxito parcial — toast de éxito + aviso secundario de que la dirección no se pudo guardar y se puede agregar después desde Editar equipo. Nunca error duro (reintentar toda la creación duplicaría el equipo).

### Campos sin backend: quedan funcionando pero sin persistir

`showGroupsToRunners` (toggle de privacidad) y la foto de equipo no tienen campo en el backend (huecos #2 y #3). Ambos siguen funcionando del lado del cliente (se pueden tocar/elegir) pero se descartan antes de pegarle al backend — se pierden al recargar. El toggle de privacidad, por ser un dato sensible, lleva un texto chico visible avisando que todavía no se guarda entre sesiones. La foto queda silenciosa (solo un comentario en el código) — perder una foto elegida es menos grave que un dato de privacidad no guardado sin aviso.

### Huecos de backend confirmados (documentados, no resueltos acá)

1. Sin endpoint "mis equipos" (administrados o donde participo) — `GET /teams` devuelve todo sin filtro.
2. Sin campo `show_groups_to_runners` en el equipo.
3. Sin campo de foto ni endpoint de upload de archivos (para ningún recurso del sistema).
4. Sin campo de plan de entrenamiento en el grupo (Etapa 2).
5. Sin endpoint para listar invitaciones pendientes de un equipo (Etapa 3).
6. Sin mecanismo de aceptar/rechazar invitación (Etapa 3 — el más grande, bloquea "sumarse por invitación").

Van a `docs/BACKEND_API_GAPS.md` (formato: qué hace falta / por qué / a qué bloquea / workaround actual / estado), con una línea de referencia agregada a la sección "Backend" de `CLAUDE.md`.

### Rename de rutas

| Antes | Después |
|---|---|
| `app/(tabs)/equipos/crear.jsx` | `app/(tabs)/teams/create.jsx` |
| `app/(tabs)/equipos/[teamId]/index.jsx` | `app/(tabs)/teams/[teamId]/index.jsx` |
| `app/(tabs)/equipos/[teamId]/editar.jsx` | `app/(tabs)/teams/[teamId]/edit.jsx` |
| `app/(tabs)/equipos/[teamId]/invitar.jsx` | `app/(tabs)/teams/[teamId]/invite.jsx` |
| `app/(tabs)/equipos/[teamId]/grupos/[groupId]/editar.jsx` | `app/(tabs)/teams/[teamId]/groups/[groupId]/edit.jsx` |

`[teamId]`/`[groupId]` no cambian. Los componentes (`components/team/*.jsx`) no se mueven, solo las rutas — misma profundidad de import relativo en todos los casos. Nombre de función exportada sigue el patrón ya usado en rutas renombradas (`app/(tabs)/profile/activate-trainer.jsx` exporta `ProfileActivateTrainer`, PascalCase de los segmentos del path sin los grupos `(tabs)`).

Call sites que hardcodean `/equipos/...` a actualizar (confirmado por grep, re-verificar antes de cerrar la tarea por si una rama en paralelo agregó algo nuevo): `app-web-shell.jsx`, `app-web-shell-narrow.jsx`, `app-mobile-shell.jsx` (2 ocurrencias cada uno), `team-detail-screen.jsx` (3 ocurrencias), `routes/catalog.js` (la entrada `name: 'equipos'`/`href: '/equipos'`, comparada por 3 shells vía `route.name === 'equipos'`). El `label: 'Equipos'` visible al usuario no cambia — es un rename de clave de ruta, no una traducción de la interfaz.

### Capa de servicio: `services/teams.js`

Mismo patrón que `services/roles.js`/`services/user.js` (rama `USE_MOCKS`, si no `api.*` directo):

```
createTeam(payload)                          // POST /teams
getTeam(teamId)                              // GET /teams/{id}
listTeams()                                  // GET /teams (todo el sistema, sin filtro)
updateTeam(teamId, updates)                  // PUT /teams/{id} (parcial)
updateTeamAddress(teamId, address)           // PUT /teams/{id}/address
deleteTeam(teamId, userId)                   // DELETE /teams/{id}?user_id=
getTeamUsers(teamId)                         // GET /teams/{id}/users
addTeamUser(teamId, userId, roleInTeam)      // POST /teams/{id}/users
removeTeamUser(teamId, userId)               // DELETE /teams/{id}/users/{user_id}
```

`addTeamUser`/`removeTeamUser` no tienen consumidor en la UI de Etapa 1 pero se agregan igual — espejo 1:1 barato del contrato ya documentado, matching la instrucción de dar funcionalidad real donde el backend la soporte.

Mapeo camelCase (front) ↔ snake_case (backend) vive en `services/normalizers.js` (no como helpers privados en `services/teams.js`) — mismo lugar que `toUserModel`/`toRegisterPayload`/`toUpdatePayload`, mismo patrón de omitir campos opcionales vacíos. Nuevas funciones: `toTeamModel(dto)`, `toCreateTeamPayload(form)`, `toUpdateTeamPayload(form)` (descarta `showGroupsToRunners`/`photoUri`), `toAddressPayload(form)`.

Mock: `services/__mocks__/teams-mock.js`, patrón stateful como `services/__mocks__/roles-mock.js` (array en memoria) — necesario para probar crear→listar→editar de punta a punta con `EXPO_PUBLIC_USE_MOCKS=true`. Los 3 equipos mock actuales se mudan acá como semilla (el store deja de tener datos hardcodeados). Respuestas con la misma forma snake_case que el backend real.

### `store/team-store.js`

Pasan a ser reales (devuelven `{success, team?/error?}`, mismo contrato que `auth-store.js`): `createTeam` (async, encadena `updateTeamAddress` si hay campos de dirección), `updateTeam` (mismo tratamiento), `fetchTeams()` (nueva), `fetchTeam(teamId)` (nueva, para deep-links). Selector nuevo para "equipos que administro".

Quedan local-only: `updateGroup`, `addInvitedEmails`, `selectTeam`/`selectedTeamId`, catálogos de tiers/planes, generación de roster sintético (se sigue completando `team.members`/`team.invitedEmails` sobre la respuesta real del equipo, con comentario explícito apuntando al hueco).

Loading state local a cada pantalla (`useState`), no en el store — mismo patrón que `activate-trainer-screen.jsx`.

### Fix de select: nivel de equipo

`team-general-info-fields.jsx` — el picker de "Nivel del equipo" pasa de `PickerField` incondicional al mismo ternario `isWeb ? <SelectField> : <PickerField>` que ya usan país/provincia/localidad en el mismo archivo. `isWeb`/`SelectField` ya están importados.

## Archivos

### Nuevos
- `services/teams.js`
- `services/__mocks__/teams-mock.js`
- `docs/BACKEND_API_GAPS.md`

### Modificados
- `services/normalizers.js` (+ `toTeamModel`, `toCreateTeamPayload`, `toUpdateTeamPayload`, `toAddressPayload`)
- `store/team-store.js`
- `components/team/team-general-info-fields.jsx` (fix picker de nivel)
- `components/team/create-team-screen.jsx`, `edit-team-screen.jsx`, `team-detail-screen.jsx` (async submit, loading, fetch-on-mount para deep-links, avisos de campos no persistidos)
- `components/shell/app-web-shell.jsx`, `app-web-shell-narrow.jsx`, `app-mobile-shell.jsx` (rutas)
- `routes/catalog.js` (rename de clave de ruta)
- `CLAUDE.md` (línea apuntando a `docs/BACKEND_API_GAPS.md`)
- `__tests__/routes.catalog.test.js`, `__tests__/team-store.test.js`

### Renombrados
- Los 5 archivos de ruta bajo `app/(tabs)/equipos/` → `app/(tabs)/teams/` (tabla completa arriba).

## Notas de implementación

- `__tests__/team-store.test.js` se reescribe para mockear `services/teams.js` directo vía `jest.mock(...)`, mismo patrón que ya usa `__tests__/auth-store.test.js` para `services/auth.js`/`services/roles.js`/`services/user.js` — no depende de `USE_MOCKS`.
- Se implementa en la misma rama, commits chicos por pieza — mismo criterio que el resto de esta sesión.

## Verification

- `npm test` y `npm run lint` en verde en todo momento.
- Preview: rutas nuevas navegables sin 404 (directas y vía nav real), picker de nivel renderiza `<select>` en web/`PickerField` en mobile, flujo mock completo de punta a punta (crear con dirección → aparece en menú → detalle por deep-link → editar → persiste), mismo flujo contra backend real, aviso de dirección parcial, no-persistencia de toggle/foto confirmada como esperada.
