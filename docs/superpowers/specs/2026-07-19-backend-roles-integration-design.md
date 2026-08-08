# Roles/tiers/permisos respaldados por backend + activación de entrenador — Design

**Fecha:** 2026-07-19
**Estado:** Aprobado, plan de implementación en `docs/superpowers/plans/2026-07-19-backend-roles-integration.md`

## Contexto

El sistema de roles (corredor/entrenador) es 100% local-only (Zustand +
storage del dispositivo) desde que se construyó, estructurado
deliberadamente para poder reemplazarse por datos reales del backend sin
cambiar la interfaz que consumen los componentes. El backend (Go/Gin,
repo separado, lo mantiene otra persona del equipo) acaba de implementar
ese sistema real. Confirmado en vivo contra el swagger de producción
(`https://paceron-backend.onrender.com/swagger/doc.json?env=production`)
y requests GET reales (todo de solo lectura, sin mutaciones):

- `GET /api/v1/roles` (público) → seedeado: `{id:1,name:"corredor"}`,
  `{id:2,name:"entrenador"}`.
- `GET /api/v1/tiers` (público) → cada rol tiene variante de tier "base" y
  "premium" (entrenador/premium otorga el permiso extra `ver_reportes` en
  los datos de muestra).
- `POST /api/v1/users/{id}/roles` `{role_id, tier_id?}` → asigna un rol;
  omitir `tier_id` usa el tier base del rol por default. 409 = ya
  asignado. No existe endpoint de desasignación (DELETE).
- `GET /api/v1/auth/permissions?user_id=` → única forma de leer los roles
  actuales de un usuario: `{user_id, roles:[{id,name,tier,permissions[]}]}`.
  Funcionó sin header de auth al probarlo en vivo (puede ser intencional
  del backend o no — no es responsabilidad de este repo).
- `bank_alias` ahora es un campo string plano directamente en la entidad
  User — presente en `UserResponse` (`/auth/login`, `/auth/user`) y en
  `UserUpdateRequest`/`UserUpdateResponse` (`PUT /users/{id}`). Ausente en
  `RegisterRequest` (no se puede setear al registrarse).

## Alcance de esta spec

Reemplazar el estado de roles local-only por el API real, y persistir de
verdad la activación de entrenador (asignación de rol + alias bancario)
en el backend. Toca: `services/normalizers.js`, nuevo
`services/roles.js` + `services/__mocks__/roles-mock.js`,
`services/__mocks__/auth-mock.js`, `store/auth-store.js`,
`components/profile/activate-trainer-screen.jsx`,
`components/profile/edit-profile-screen.jsx`,
`components/profile/profile-screen.jsx`,
`components/shell/role-management-section.jsx`,
`components/shell/role-switch-overlay.jsx`,
`components/shell/app-web-shell.jsx`, `components/shell/app-mobile-shell.jsx`,
`__tests__/auth-store.test.js`.

## Decisiones

### Tiers

Siempre se asigna el tier **base** del rol (se omite `tier_id` en el
POST). La selección de tier/upsell a premium (mencionada como posible
banner futuro fuera de la sección de perfil) queda explícitamente fuera
de alcance ahora.

### Auto-asignación de corredor al registrarse

Se asume que el backend ya asigna `corredor` al registrar un usuario.
Esto se **verifica empíricamente como primer paso de la implementación**
(registrar un usuario de prueba real, chequear `/auth/permissions` para
ese usuario) antes de decidir si hace falta el fallback defensivo en el
frontend. No se escribe código para ambos casos de antemano — se
implementa solo la rama que la verificación confirme.

### Resolución de `role_id` sin hardcodear

`services/roles.js` (nuevo) resuelve el `role_id` por nombre
(`'corredor'`/`'entrenador'`) vía un cache en memoria de módulo de
`GET /roles` (dato de catálogo estático, no de sesión — no vive en el
store de Zustand, se pide una sola vez y se memoiza, no se refetchea por
cada asignación).

### Estado en `store/auth-store.js`

Se elimina `trainerActivated`, `trainerAlias`, `updateTrainerData`,
`activateTrainerProfile`. Se agrega:

```js
roles: [],          // [{ id, name, tier, permissions }] desde /auth/permissions
rolesLoaded: false, // distingue "todavía no se pidió" de "se pidió, vacío"
```

`activeRole` (cuál rol está seleccionado/mostrado ahora mismo) sigue
siendo **local-only** — el backend no tiene ningún concepto de "rol
activo actual", solo trackea qué roles tiene asignados un usuario (un
conjunto, no una selección). `switchRole()` ahora solo permite cambiar a
un rol que el usuario realmente tenga asignado, leyendo `roles`.

`fetchPermissions()` (nueva acción) se llama: (a) después de `login()`,
(b) después de `hydrate()` si hay sesión, (c) de nuevo tras un
`activateTrainerRole()` exitoso. Siempre se refetchea en `hydrate()`
aunque `roles` también se persista localmente — la copia persistida solo
evita un parpadeo de "sin entrenador" mientras el refetch está en vuelo,
nunca se confía en ella como fuente de verdad por sí sola.

`hydrate()` normaliza sesiones persistidas viejas (sin la clave `roles`)
con `Array.isArray(data.roles) ? data.roles : []` — sin crashear,
`rolesLoaded` queda `false` hasta que el `fetchPermissions()` post-hydrate
resuelva, autocorrige en el siguiente arranque de la app.

`activateTrainerProfile` se reemplaza por `activateTrainerRole(bankAlias)`:
asigna el rol entrenador vía `services/roles.js`, y guarda el alias
reenviando el perfil completo actual del usuario + el alias nuevo (ver
riesgo abierto #1) vía el `updateUser()`/`toUpdatePayload()` ya existente
— no hace falta ninguna acción nueva de persistencia para el alias, viaja
en el mismo PUT que el resto del perfil.

### `bank_alias` dentro del pipeline existente

`toUserModel` mapea `dto.bank_alias` → `bankAlias`. `toUpdatePayload`
agrega `bank_alias: form.bankAlias ?? ''`. Esto hace que el alias viva
como **un campo más del usuario** (como `email`, `phone`), no como un
campo especial paralelo — se actualiza con el mismo `updateUser()` PUT ya
usado para el resto del perfil. Se elimina `updateTrainerData` por
completo.

### Pantallas

- `activate-trainer-screen.jsx`: llama `activateTrainerRole(trainerAlias)`
  en vez de `activateTrainerProfile`. Esta pantalla no tenía manejo de
  error (la acción vieja era pura y local, no podía fallar) — se agrega
  un Toast para `result.success === false`, mismo patrón que
  `edit-profile-screen.jsx`.
- `edit-profile-screen.jsx`: lee `hasTrainerRole` (selector derivado de
  `roles`) y `user.bankAlias` en vez de los campos viejos. El campo de
  alias se suma al mismo `toUpdatePayload(...)` que ya arma el submit —
  se borra la llamada separada a `updateTrainerData`.
- `profile-screen.jsx`: mismo selector `hasTrainerRole`; la sección de
  datos de entrenador lee `user.bankAlias`.

### Componentes de shell (cambio mecánico)

`role-management-section.jsx`, `role-switch-overlay.jsx`,
`app-web-shell.jsx`, `app-mobile-shell.jsx`: renombran
`trainerActivated` → `hasTrainerRole` donde se referencia. Confirmado que
todos solo leen el campo como boolean plano, ninguno inspecciona su forma
interna — es un rename, no una reescritura.

## Riesgos abiertos (marcar en review, no resolver en silencio)

1. **`PUT /users/{id}` — reemplazo completo vs. patch parcial, sin
   verificar.** `activateTrainerRole` asume reemplazo completo (reenvía
   todo el perfil + el `bankAlias` nuevo). Si el backend en realidad hace
   patch parcial, el reenvío completo es innecesario pero inofensivo. Si
   es reemplazo completo y se hubiera mandado solo `{bank_alias}`, se
   perderían silenciosamente el resto de los campos del perfil.
   **Verificar esto empíricamente como primer smoke test contra el API
   real** una vez que arranque la implementación — esto también
   retroactivamente pone en duda el submit de `edit-profile-screen.jsx`
   ya existente, que hace la misma suposición hoy sin haberla verificado.
2. **No existe endpoint para desasignar un rol.** Una vez asignado
   entrenador, el backend no tiene forma de sacarlo. Está bien por ahora
   (no hay ni se planea una UI de "desactivar perfil de entrenador") —
   dejar constancia para que una sesión futura no asuma que existe sin
   chequear primero.
3. **`/auth/permissions` no tenía auth exigida** al probarlo en vivo. No
   es responsabilidad de este repo arreglarlo, y nada de este diseño se
   rompe si el backend le suma auth después (el header `Authorization` ya
   se manda automáticamente en cada request vía `services/api.js`).

## Fuera de alcance

Selección/UI de tier premium. Endpoint de desasignación de rol (no
existe). Cualquier cambio al backend (repo separado).

## Verificación

- `npm test` → 32/32 tras actualizar `__tests__/auth-store.test.js`.
- Manual, `EXPO_PUBLIC_USE_MOCKS=true`: flujo completo de activación
  (activar → alias guardado → badge muestra entrenador → cambiar rol →
  editar alias después) sigue funcionando de punta a punta contra los
  mocks nuevos (con estado).
- Manual, contra el backend real de Render: registrarse o loguearse con
  una cuenta de prueba real, activar entrenador, confirmar que
  `GET /auth/permissions?user_id=` lo refleja, confirmar que `bank_alias`
  hace round-trip en una edición de perfil.
- Ejecutar explícitamente la verificación de auto-asignación de corredor
  y documentar el resultado.
- Ejecutar explícitamente la verificación de semántica de PUT (riesgo #1)
  antes de confiar en `activateTrainerRole`.
