# Auth-store: split sesión (Zustand) / perfil (TanStack Query) — diseño

## Contexto

Tercer y último sub-proyecto de la migración de estado de servidor iniciada con equipos/grupos/invitaciones (PR #123, `docs/superpowers/specs/2026-09-09-team-store-tanstack-query-migration-design.md`). Orden acordado con el usuario: auth (este documento, "core de todas las funcionalidades") → `exercise-store.js`/`session-store.js` → `training-plan-store.js` (último, porque su diseño "todavía puede cambiar").

`store/auth-store.js` hoy mezcla dos dominios en un solo Zustand store, persistidos juntos como un blob en `paceron.auth` (storage):

- **Sesión**: `token`, `refreshToken`, `expiresAt`, `activeRole`, `hydrated`, `roleSwitchAnimating`. Puramente local — `services/api.js` lee `token`/`refreshToken` sincrónicamente fuera de React en cada request (`useAuthStore.getState()`), por eso este dominio **no migra** (Query es hook-based, no sirve para lectura sincrónica fuera de componentes).
- **Perfil**: `user`, `roles`, `rolesLoaded` — datos que vienen del backend (`GET /auth/permissions`, `getUser`) y se re-piden con cada `login`/`fetchPermissions`/mutation. Esto sí es estado de servidor real, candidato a Query igual que equipos/grupos.

## Alcance

**Migra a `hooks/use-user.js` (TanStack Query):**
- Lectura: `user` (perfil completo), `roles` (permisos reales).
- Mutations: `updateUser`, `uploadPhoto`, `deletePhoto`, `deactivateAccount`, `activateTrainerRole`, `deactivateTrainerRole`.

**Queda en `store/auth-store.js` (Zustand, sin cambio de patrón):**
- `token`, `refreshToken`, `expiresAt`, `activeRole`, `hydrated`, `roleSwitchAnimating`.
- **`userId` — campo nuevo** (ver "Sesión: por qué necesita `userId`" abajo).
- Acciones: `hydrate`, `login`, `register`, `logout`, `refreshSession`, `switchRole`, `clearRoleSwitchAnimation`, más una acción chica nueva `resetActiveRoleIfInvalid(hasTrainerRole)` (ver "Efecto reactivo activeRole↔roles").

**Fuera de alcance, sin cambios en este sub-proyecto:**
- `services/api.js` — sigue leyendo `token`/`refreshToken` de Zustand igual que hoy. Solo se le agrega el `queryClient` global (ver más abajo) para el caso del logout forzado por 401.
- `training-plan-store.js`/`exercise-store.js`/`session-store.js` — sub-proyectos futuros, sin fecha, no tocados acá.

## Sesión: por qué necesita `userId`

`getUser({id})` (perfil) y `getPermissions(userId)` (roles) necesitan el id del usuario para pedirlo. Hoy ese id sale de `user.userId`, que después de este cambio vive en el cache de Query — problema: para el fetch *inicial* de `useUser()`/`usePermissions()` (cache vacío, recién hidratado desde storage) hace falta un id que no dependa del propio resultado de Query.

Se agrega `userId` como campo liviano de **sesión** (no de perfil) — se setea en `login()` (viene en la respuesta) y se restaura en `hydrate()` (viene del blob persistido), nunca cambia salvo `logout()`. `useUser(userId)`/`usePermissions(userId)` lo reciben como parámetro (leído de Zustand por el caller, mismo patrón que `useGroups(teamId, userId)` ya usa) y gatean su fetch con `enabled: Boolean(userId)`.

## Persistencia

**Decisión: solo sesión persiste.** El blob en `paceron.auth` pasa a tener únicamamente `token`/`refreshToken`/`expiresAt`/`activeRole`/`userId` — ya no `user`/`roles`. El perfil se re-pide del backend en cada arranque vía `useUser()`/`usePermissions()` (gateados por `userId` recién restaurado). Trade-off aceptado: un parpadeo breve (loading) en frío hasta que el perfil resuelve, a cambio de no tener que sincronizar dos fuentes de verdad (storage + cache de Query) para el mismo dato.

`hydrate()` queda puramente sincrónico con storage — ya no encadena `fetchPermissions()` (eso lo dispara solo `usePermissions()` al montarse). `seedDefaultTheme(user?.defaultTheme)`, que hoy vive dentro de `hydrate()` y necesita el `user` completo, se mueve a un efecto separado (en el mismo lugar donde se llama `hydrate()` hoy, `app/(tabs)/_layout.jsx`) que espera a que `useUser()` resuelva — un frame más tarde que hoy, sin impacto visible.

## Hooks (`hooks/use-user.js`)

Mismo patrón que `hooks/use-teams.js`/`hooks/use-invitations.js`: hooks de lectura devuelven `{data, loading}`, mutations nunca tiran, siempre `{success, error?}`.

```
useUser(userId) → { user, loading }              // queryKey: ['user', userId]
usePermissions(userId) → { roles, loading }        // queryKey: ['permissions', userId]

useUserMutations() → {
  updateUser({ id, payload, currentPassword }), isUpdating,
  uploadPhoto({ uri, mimeType }), isUploadingPhoto,
  deletePhoto(), isDeletingPhoto,
  deactivateAccount(), isDeactivating,
  activateTrainerRole({ bankAlias, password }), isActivatingTrainer,
  deactivateTrainerRole(), isDeactivatingTrainer,
}
```

Invalidación por mutation:
- `updateUser`/`uploadPhoto`/`deletePhoto` → invalidan `['user', userId]`.
- `deactivateAccount` → en éxito, llama `useAuthStore.getState().logout()` (cruza a sesión, mismo patrón que `acceptInvitation` cruza a roster) — no hace falta invalidar nada más, `logout()` ya limpia todo el cache (ver más abajo).
- `activateTrainerRole`/`deactivateTrainerRole` → invalidan `['user', userId]` **y** `['permissions', userId]` (cambian alias de perfil y conjunto de roles a la vez).

`login()`/`register()` (Zustand, sesión) siembran el cache directamente con el `user` que ya viene en la respuesta del login (`queryClient.setQueryData(['user', userId], user)`) — evita un round-trip extra a `getUser` inmediatamente después de loguear. Como `login`/`register` no son hooks (vienen de `useAuthStore.getState()` en varios call sites, incluyendo fuera de componentes), reciben el `queryClient` como parámetro desde el caller.

## `queryClient` global (única excepción al patrón "el caller decide")

Hasta ahora (equipos/grupos/invitaciones) el criterio fue: quien tiene el `queryClient` (un componente, vía `useQueryClient()`) decide cuándo invalidar/limpiar — ningún store importa el `queryClient` directo. Acá aparece un caso real que ese patrón no cubre: el logout forzado por refresh token vencido (`services/api.js`, interceptor de 401) llama `useAuthStore.getState().logout()` desde un **service**, sin ningún componente de por medio.

Se agrega `lib/query-client.js` (nuevo, chico): exporta una única instancia de `QueryClient` (la misma config que hoy vive inline en `providers/app-providers.jsx`). `AppProviders` pasa a importarla en vez de crearla con `useState(createQueryClient)`. `services/api.js` la importa para este caso puntual.

Con esa instancia disponible, `logout()` (Zustand) pasa a limpiar el cache **él mismo** (`queryClient.clear()`) antes de resetear la sesión — consolida el caso manual (3 shells, botón "Cerrar sesión") y el caso automático (401) en un solo lugar, sin que cada call site tenga que acordarse de limpiar Query por separado.

## Efecto reactivo `activeRole` ↔ `roles`

Hoy, al final de `fetchPermissions()`, hay una corrección inline: si `activeRole === 'trainer'` pero los roles recién traídos no incluyen `'entrenador'` (sesión vieja persistida con un rol que ya no tiene, o revocado desde otra sesión), se fuerza `activeRole` a `'runner'`. Con `roles` viviendo en Query y `activeRole` en Zustand, esta corrección no puede seguir inline en el fetch.

Se agrega un hook chico, `useRoleReconciliation()`, montado una vez en `app/(tabs)/_layout.jsx` (al lado de `hydrate()`): usa `usePermissions(userId)` y `activeRole`/`resetActiveRoleIfInvalid` de Zustand; con un `useEffect` que corre cuando `roles` cambia, si `activeRole === 'trainer'` y `!hasTrainerRole` llama `resetActiveRoleIfInvalid()`. `resetActiveRoleIfInvalid` (acción nueva y chica en `auth-store.js`) hace exactamente lo que hacía el bloque inline: `set({activeRole: 'runner'})` + re-persistir sesión.

## Impacto en consumidores

Grep real contra el árbol de `components/`/`app/`/`hooks/`:

| Campo | # archivos | Patrón de cambio |
|---|---|---|
| `user` | 28 | `useAuthStore((s) => s.user)` → `useUser(userId).user` — mecánico. La mayoría (create-team, invite-team-members, assign-training-plan, catálogos de ejercicios/sesiones, etc.) solo usan `user.userId`/`user.email` para alimentar otro hook. Un grupo más chico renderiza perfil de verdad: `profile-screen.jsx`, `edit-profile-screen.jsx`, los 3 shells (avatar/iniciales/nombre), `authenticated-home-screen.jsx` (saludo), `require-auth.jsx` (guard). |
| `roles` | 11 | `useAuthStore((s) => s.roles)` → `usePermissions(userId).roles` — mecánico. |
| `activeRole` | 9 | **Sin cambio** — sigue en Zustand. |
| Mutations (`updateUser`/`uploadPhoto`/`deletePhoto`/`deactivateAccount`/`activateTrainerRole`/`deactivateTrainerRole`) | 5 (`profile-screen.jsx`, `edit-profile-screen.jsx`, `tier-upgrade-screen.jsx`, `settings-screen.jsx`, `activate-trainer-screen.jsx`) | `useAuthStore((s) => s.X)` / `useAuthStore.getState().X(...)` → `useUserMutations().X(...)` — firma cambia de posicional a objeto en algunos casos (`updateUser(id, payload, currentPassword)` → `updateUser({id, payload, currentPassword})`), mismo criterio que `useTeamMutations`. |
| `hydrate`/`hydrated` | 2 (`app/(tabs)/_layout.jsx`, `components/payments/checkout-web-page.jsx`) | `hydrate()` sin cambio de firma — sigue siendo el mismo call, solo que ahora no dispara el fetch de perfil por dentro. |
| `fetchPermissions`/`refreshUser` | 2 (`tier-upgrade-screen.jsx`, `profile-screen.jsx`) | `fetchPermissions()` manual → `queryClient.invalidateQueries(['permissions', userId])`. `refreshUser()` manual → `queryClient.invalidateQueries(['user', userId])`. |
| `logout` | 3 (los 3 shells) | Sin cambio de firma — `logout()` ahora también limpia Query por dentro (ver sección de arriba). |

Total: más superficie que equipos (11 pantallas) — compensado porque cada cambio individual es más simple (un selector por otro), no hay lógica nueva de UI.

## Testing

`__tests__/auth-store.test.js` existe hoy, cubre las ~13 acciones actuales del store combinado. Se recorta a lo que queda en Zustand (`login`/`register`/`logout`/`refreshSession`/`switchRole`/`hydrate`/`resetActiveRoleIfInvalid`) — mismo criterio que se aplicó a `team-store.test.js` en la migración anterior. Las mutations nuevas de `useUserMutations` no llevan test dedicado (sin precedente en el repo — ningún hook de Query lo tiene, `hooks/use-teams.js` tampoco); la lógica de servicio que sí importa la cubren `user-mock.test.js`/`roles-mock.test.js`, ya existentes y sin cambios.

## Self-review

**Placeholders:** ninguno — cada sección tiene decisión concreta, sin "a definir" pendiente.

**Consistencia interna:** `queryClient` global se introduce por el caso 401 pero termina usándose también para consolidar el logout manual — explícitamente señalado como la única excepción al patrón "el caller decide" del resto de esta migración, no una contradicción silenciosa.

**Alcance:** un solo store (`auth-store.js`), un hook nuevo (`use-user.js`), un módulo chico nuevo (`lib/query-client.js`). Foco correcto para un plan de implementación único — no hace falta descomponer en sub-proyectos.

**Ambigüedad:** el orden `userId` en `queryKey` (`['user', userId]` vs `['user']` con `userId` implícito en el `queryFn`) queda explícito — sigue el mismo patrón que `['team-users', teamId]`/`['groups', teamId]` ya usan en el resto del código migrado, para mantener consistencia de queryKey shape en toda la base.
