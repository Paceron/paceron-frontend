# Foto de perfil e ícono de equipo — Design

**Fecha:** 2026-09-03
**Estado:** Aprobado, en desarrollo

## Contexto

El backend entregó el contrato de subida de foto de perfil de usuario e
ícono de equipo (`feature/fotos-perfil-equipo`, backend PR #40 — **todavía
sin mergear a `develop` del backend al momento de escribir esta spec**, no
se consultó swagger, se trabaja contra el contrato tal cual lo describió el
usuario). Es la primera subida de archivo real de todo este repo — hoy
`services/api.js` es JSON-only.

Ya existe un picker de ícono de equipo en el wizard de creación
(`hooks/use-team-general-info-form.js#handlePickPhoto`/`photoUri`,
`components/team/team-general-info-fields.jsx`), pero es **local-only** —
nunca sube nada a ningún lado, coincide con el gap ya documentado
("foto de equipo sigue sin persistir entre sesiones", sección Backend de
`CLAUDE.md`). Esta entrega lo reemplaza por completo, no lo extiende.

## Alcance de esta spec

`services/api.js` (soporte multipart), `utils/build-photo-form-data.js`
(nuevo), `services/user.js`/`services/teams.js` (+mocks), `services/normalizers.js`
(`photoUrl`/`iconUrl`), `store/auth-store.js`/`store/team-store.js` (nuevas
acciones), `components/shared/avatar-picker.jsx` (nuevo),
`components/profile/profile-screen.jsx`, `components/team/team-detail-screen.jsx`.
**Elimina** el picker local-only de `hooks/use-team-general-info-form.js` y
`components/team/team-general-info-fields.jsx`, y el merge de `photoUri`
como campo "clientOnly" en `store/team-store.js#updateTeam`.

## Contrato del backend (tal cual lo entregó el usuario, sin verificar contra swagger)

| Método | Path | Quién | Body |
|---|---|---|---|
| PUT | `/api/v1/users/:id/photo` | self only | `multipart/form-data`, campo `photo` |
| DELETE | `/api/v1/users/:id/photo` | self only | — |
| PUT | `/api/v1/teams/:id/icon` | entrenador dueño | `multipart/form-data`, campo `photo` |
| DELETE | `/api/v1/teams/:id/icon` | entrenador dueño | — |

Upload devuelve `{photo_url}`/`{icon_url}`; delete devuelve 204 sin body.
`GET /auth/user` trae `photo_url` (nullable), `GET /teams/:id` trae
`icon_url` (nullable). Validación server-side: máx 5MB, solo
`image/jpeg`/`image/png`/`image/webp` (contenido real del archivo, no
extensión) — 400 `PHOTO_TOO_LARGE`/`PHOTO_INVALID_TYPE`, 403 si no es el
dueño. Cache-busting resuelto del lado backend (`?v=<timestamp>` en la
URL) — el frontend renderiza `photo_url`/`icon_url` tal cual, sin inventar
su propio cache-busting. Sin endpoint de edición — "editar" es volver a
subir (pisa la anterior).

**Gap de infra conocido, no de este repo:** el bucket de Supabase todavía
no está configurado como público del lado del dashboard — la URL devuelta
existe pero devuelve 404 hasta que se resuelva. La UI se construye igual,
con fallback visual — el contrato no cambia cuando se resuelva.

## Decisiones

### Primera subida multipart del repo — `services/api.js` gana soporte, sin romper el resto

`request()` fuerza hoy `Content-Type: application/json` siempre y hace
`JSON.stringify(body)` sin condición. Pasa a omitir ese header cuando
`body` es una instancia de `FormData` (fetch arma el boundary multipart
solo — setearlo a mano rompe el parseo del lado servidor). Nuevo helper
`api.putForm(path, formData)` que manda el `FormData` tal cual, sin
stringify. El resto de los verbos (`get`/`post`/`put`/`patch`/`delete`)
no cambian.

### Armado del `FormData`: split real por plataforma, no cosmético

`utils/build-photo-form-data.js` (nuevo) — dado el URI local que devuelve
`expo-image-picker`:
- **Nativo:** `formData.append('photo', { uri, name: 'photo.jpg', type:
  mimeType ?? 'image/jpeg' })` — el polyfill de `fetch`/`FormData` de React
  Native soporta este shape de objeto directo.
- **Web** (`react-native-web` en un browser real): un browser real no
  acepta `{uri,...}` en `FormData.append` — hace falta el `Blob` real
  primero: `const blob = await fetch(uri).then(r => r.blob()); formData.append('photo', blob, 'photo.jpg')`.

Split por `isWeb` (`utils/platform.js`), no por archivo `.web.js` — es una
función utilitaria, no un componente con árbol de render propio.

### Servicios + mocks: mismo patrón `USE_MOCKS`, el mock "hace como que subió"

`services/user.js#uploadUserPhoto(userId, uri, mimeType)` /
`#deleteUserPhoto(userId)`; `services/teams.js#uploadTeamIcon(teamId, uri,
mimeType)` / `#deleteTeamIcon(teamId)`. Bajo `USE_MOCKS`, el mock de
upload **devuelve el mismo URI local recibido como si fuera la URL
subida** — así en modo mock la foto elegida queda pegada sin backend real,
mismo espíritu que el resto de los mocks de este repo (no un mock que
simplemente no hace nada).

### Normalizers y stores: campos nuevos, sin tocar el JSON general

`toUserModel` suma `photoUrl: dto.photo_url ?? null`; `toTeamModel` suma
`iconUrl: dto.icon_url ?? null`. `store/auth-store.js` gana
`uploadPhoto`/`deletePhoto` (mismo patrón que `updateUser`: llaman al
servicio, actualizan `user.photoUrl` en el store, persisten).
`store/team-store.js` gana `uploadTeamIcon`/`deleteTeamIcon` (actualizan
`iconUrl` del equipo correspondiente en el array `teams`, mismo criterio
de merge que `updateTeam`). Ninguna de las dos acciones toca el PUT
general de JSON — son endpoints 100% independientes.

### Se elimina el picker local-only existente, no se extiende

Con la decisión explícita del usuario de que la foto **no** se elige
durante la creación (ni de usuario — nunca existió ahí — ni de equipo), el
picker que hoy vive en `TeamGeneralInfoFields` (compartido por
`CreateTeamScreen` y `EditTeamScreen`) se elimina por completo: el bloque
de `photo-wrapper` en el JSX, y `photoUri`/`handlePickPhoto`/el import de
`expo-image-picker` en `useTeamGeneralInfoForm.js`. La fila
`identity-row` (foto + nombre lado a lado) colapsa a solo el campo nombre,
sin wrapper de fila. `store/team-store.js#updateTeam` deja de mergear
`photoUri` como campo "clientOnly" — ya no hay ningún flujo que lo
produzca.

### Dos puntos de entrada únicos: perfil propio y detalle de equipo (dueño)

- **`profile-screen.jsx`** (`HeaderPanel`, variantes desktop y mobile): el
  avatar pasa a ser `<AvatarPicker>` atado a `user.photoUrl` +
  `uploadPhoto`/`deletePhoto` de `auth-store` — siempre editable (es la
  sesión propia).
- **`team-detail-screen.jsx`** (línea ~1028, donde hoy hay un
  `team.photoUri` que nunca se llenó de verdad — se reemplaza por
  `team.iconUrl` real): `<AvatarPicker>` atado a `uploadTeamIcon`/
  `deleteTeamIcon` de `team-store`, editable **solo** cuando
  `canDeleteTeam` (ya existe en el archivo:
  `canManageTeam && team?.ownerId === user?.userId`, exactamente "el
  entrenador dueño"). Para cualquier otro que mire el equipo, se ve de
  solo lectura — sin lápiz ni basurero.
- `edit-team-screen.jsx` **no** gana ningún picker — ni crear ni editar
  tocan la foto, coherente con la decisión de arriba.

### `AvatarPicker` — componente nuevo y compartido

`components/shared/avatar-picker.jsx` — círculo con imagen real si hay
`uri` (con fallback al ícono default vía `onError`, cubre el 404 conocido
del bucket), badge de lápiz superpuesto (mismo patrón visual que ya
existía en el picker viejo), más un ícono de basurero chico aparte que
solo aparece si hay foto cargada. Props: `{ uri, onPick, onRemove,
loading, size, fallbackIcon }` — mismo componente para avatar de usuario
(`fallbackIcon="account"`) e ícono de equipo (`fallbackIcon="account-group"`).

**UI optimista:** al elegir, el avatar muestra el URI local elegido al
instante (con spinner encima) mientras sube. Éxito → se reemplaza por la
URL real (ya trae `?v=` de cache-busting). Error → vuelve al valor
anterior + Toast con `error.message` (mismo patrón que el resto del
repo, sin branch especial por `code` del backend).

**Borrar sin modal de confirmación** — a diferencia de dar de baja
cuenta/equipo (esos sí llevan modal en este repo), borrar una foto es de
bajo riesgo y fácilmente re-subible; el ícono de basurero chico ya es un
tap deliberado.

### Validación client-side: solo lo barato, el resto lo resuelve el servidor

Tamaño: si `expo-image-picker` devuelve `fileSize` en el asset (no
siempre disponible según plataforma), se rechaza antes de intentar
subir. Sin ese dato, se deja pasar y lo resuelve el 400 del backend.
Tipo: `mediaTypes: ['images']` del picker ya restringe la selección a
nivel de SO — no se duplica la validación de contenido real, es trabajo
explícito del backend según el contrato.

## Fuera de alcance

Recorte/edición de imagen antes de subir (el backend ya aclaró que, si se
agrega en el futuro, es responsabilidad del frontend hacerlo antes de
mandar el archivo — no es esta entrega). Mostrar la foto/ícono real en
listas y filas chicas (`teams-list-screen`, filas de roster) — quedan con
el ícono genérico por ahora, se puede sumar después sin tocar el modelo
de datos. Cualquier picker durante los wizards de creación (deliberadamente
sacado, no diferido). Verificación en vivo contra el bucket real de
Supabase (gap de infra conocido, no bloqueante para esta entrega).

## Verificación

Con `EXPO_PUBLIC_USE_MOCKS=true`, en preview **web** se puede probar de
punta a punta sin build nativo: `expo-image-picker` tiene implementación
web real (`<input type="file">` por debajo). Elegir una foto en
`/profile` → se ve al instante, el mock la devuelve como "subida" →
persiste tras reload. Mismo flujo en el detalle de un equipo propio.
Borrar → vuelve al ícono default. Lo específico de nativo (prompt de
permisos del SO, picker nativo) necesita build — no se verifica esta
ronda.

`npm test` y `npm run lint` en verde antes de abrir la PR.
