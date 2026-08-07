# Auth: sesión real (refresh/logout) y activación de rol entrenador — Design

## Contexto

El backend (repo separado, Go/Gin) sumó un middleware de auth real con PRs ya mergeadas a su rama principal (verificado contra `https://paceron-backend.onrender.com/swagger/doc.json?env=production`, 2026-08-07). Esto trae 3 cambios que rompen o dejan sin usar partes del frontend actual:

1. **`POST /auth/login` cambia de shape.** Hoy `store/auth-store.js#login` espera `result.authorization.access_token` (objeto anidado). El nuevo `auth.LoginResponse` es plano: `{access_token, refresh_token, expires_in, user}`. Breaking change real, no aditivo.
2. **Sesión con ciclo de vida real.** `POST /auth/refresh` (rota el refresh token, devuelve access+refresh nuevos) y `POST /auth/logout` (revoca el refresh token server-side) son endpoints nuevos, sin ningún consumidor hoy. El store ya trackea `token`/`refreshToken`/`expiresAt` (preparado de antes, nunca usado para nada real) — hoy la sesión nunca se renueva sola y el logout es 100% local.
3. **Activación/desactivación de rol entrenador cambia de forma.** Nuevo endpoint dedicado `POST/DELETE /users/{id}/trainer-role`, reemplaza el flujo actual de 2 pasos (`assignRole` genérico + `updateUser` para el alias). Pide contraseña actual (nuevo, obligatorio) y bloquea la desactivación con 409 si el usuario lidera equipos activos (regla de negocio nueva).

`PATCH /users/{id}/status` también aparece en el swagger pero **ya está wireado** (`services/user.js#changeStatus`, usado por `deactivateAccount`) — no es parte de este trabajo.

## Alcance

Dentro:
- Reparsear `login()` al nuevo shape plano.
- Refresh reactivo (interceptor en `services/api.js`) + logout con revoke server-side.
- Migrar activar/desactivar entrenador a los endpoints dedicados, con modal de contraseña en la activación.

Fuera (explícitamente, no tocar en este plan):
- Cambio de contraseña autenticado (`PATCH /users/{id}/password`) — ya documentado en `CLAUDE.md` como pendiente, sin pantalla. Queda para después, no se bundlea acá.
- Cualquier UI nueva para `PATCH /users/{id}/status` más allá de lo que `deactivateAccount` ya hace.
- El rol "corredor" — sigue usando el flujo genérico de roles (`assignRole`/`removeRole`), sin cambios.

## Decisiones (todas ya validadas con el usuario)

1. **Refresh: reactivo, no proactivo.** Un interceptor en `services/api.js` reintenta una vez sobre 401. Sin timers, sin estado de expiración que mantener sincronizado aparte del que ya existe.
2. **Concurrencia de refresh:** una sola promesa de refresh en curso compartida — si varias requests pegan 401 en simultáneo, todas esperan el mismo refresh en vez de disparar uno cada una.
3. **Logout:** llama a `POST /auth/logout` con el `refreshToken` actual antes de limpiar el estado local. Best-effort — si falla (sin red, token ya vencido), el logout local sigue igual, mismo criterio que `persist()` en el resto del store.
4. **409 al desactivar entrenador:** se muestra el mensaje del backend tal cual en el toast de error existente, sin mensaje propio ni UI nueva para ese caso.
5. **Alias bancario al activar:** el campo se queda EXACTAMENTE como está hoy — siempre obligatorio (`validateTrainerAlias` sin condicionales nuevos), prefilled si ya tiene uno guardado. El payload de activación siempre manda `bank_alias` con lo que esté en el campo, nunca se omite (decisión explícita del usuario: por claridad, no confiar en el fallback silencioso del backend a "usa el que ya tenías" — siempre se manda explícito).
6. **Contraseña en texto plano dentro del body:** correcto y esperado — viaja encriptado por HTTPS/TLS, mismo patrón que ya usa `login()` hoy. No se hashea del lado del cliente (no aporta seguridad real, le rompe al backend la posibilidad de su propio hash+salt).

## Arquitectura

### 1. Sesión (login/refresh/logout)

**`store/auth-store.js#login`** — cambia el parseo de la respuesta:
```js
// Antes: result?.authorization?.access_token, result?.authorization?.refresh_token, etc.
// Después: result?.access_token, result?.refresh_token, result?.expires_in — planos.
```
El resto de `login()` no cambia (qué campos guarda en `set()`/`persist()` ya era el shape correcto).

**`services/api.js`** — el `request()` interno gana manejo de 401:
- Si la respuesta es 401 y hay un `refreshToken` en el store, intenta `POST /auth/refresh` con `{refresh_token}`.
- Si el refresh sale bien: actualiza `token`/`refreshToken`/`expiresAt` en el store (vía una función expuesta por `auth-store.js`, no un `set()` directo desde `api.js` para no crear un ciclo de imports — ver `store/auth-store.js#applyRefreshedSession` o similar), reintenta el request original UNA vez con el token nuevo.
- Si el refresh falla: llama a `logout()` del store, deja que el 401 original se propague como error al caller (no lo enmascara).
- Una promesa de refresh en curso (`let refreshPromise = null` a nivel de módulo en `api.js`) se comparte entre requests concurrentes — la primera que ve el 401 dispara el refresh y guarda la promesa; las que llegan mientras tanto esperan esa misma promesa en vez de disparar la suya.
- El request que originalmente disparó el refresh (login/register, o el propio `/auth/refresh`) no debe reintentarse en loop si vuelve a dar 401 — un flag `isRetry` en las options internas evita un segundo intento sobre el mismo request.

**`store/auth-store.js#logout`** — antes de limpiar el estado local:
```js
try {
  const { refreshToken } = get();
  if (refreshToken) await logoutService(refreshToken); // POST /auth/logout
} catch {
  // best-effort — igual que persist()
}
// ...limpieza local existente sin cambios
```

**`services/auth.js`** — nuevas funciones `refresh(refreshToken)` (`POST /auth/refresh`) y `logout(refreshToken)` (`POST /auth/logout`), mismo patrón que las existentes (`USE_MOCKS` ternario, mocks en `__mocks__/auth-mock.js`).

### 2. Activación/desactivación de rol entrenador

**`services/roles.js`** — 2 funciones nuevas, al lado de las genéricas existentes (que no cambian):
```js
// POST /api/v1/users/{id}/trainer-role
export async function activateTrainerRole(userId, { password, bankAlias }) { ... }

// DELETE /api/v1/users/{id}/trainer-role
export async function deactivateTrainerRole(userId) { ... }
```
Con sus mocks correspondientes en `__mocks__/roles-mock.js`.

**`store/auth-store.js#activateTrainerRole(bankAlias, password)`** — firma gana `password`. Pasa de 2 llamadas (assignRole + updateUser) a 1 sola contra el endpoint dedicado. Como la respuesta (`UserRoleResponse`) no trae el perfil actualizado, después de un éxito se encadena `refreshUser()` (ya existe, trae el `bank_alias` real persistido) + `fetchPermissions()` (roles), igual que se hacía antes pero por otra vía.

**`store/auth-store.js#deactivateTrainerRole()`** — cambia de llamar al `removeRole` genérico a llamar al endpoint dedicado. El resto de la función (reset de `activeRole` si corresponde, `fetchPermissions()`) no cambia.

**`components/profile/activate-trainer-screen.jsx`** — el campo de alias no cambia (validación, prefill, todo igual). El botón "Activar" ya no llama a `activateTrainerRole` directo: abre un modal nuevo.

**`components/profile/activate-trainer-password-modal.jsx`** (nuevo) — mismo patrón visual/estructural que `deactivate-trainer-modal.jsx` (`Modal` transparente, backdrop, card centrada, botones Cancelar/Confirmar con loading state). Contenido: un `InputField` de contraseña (`secureTextEntry`, con el toggle mostrar/ocultar que `InputField` ya soporta vía `onToggleSecure`/`showSecure`, mismo patrón que login/register). Al confirmar, llama a `activateTrainerRole(alias, password)` (el `alias` se le pasa como prop desde la pantalla que lo abre, ya validado antes de mostrar el modal).

**`components/profile/deactivate-trainer-modal.jsx`** — no cambia. El 409 llega como `result.error` al caller (probablemente `profile-screen.jsx`, a confirmar en el plan) y se muestra en el toast de error que ya existe ahí.

## Testing

- `__tests__/auth-store.test.js`: login con el shape plano nuevo; refresh reactivo en un test de `api.js` (mock de `fetch` devolviendo 401 una vez y 200 en el reintento, más un test de que 2 llamadas concurrentes con 401 no disparan 2 refreshes); logout llamando al servicio de revoke antes de limpiar; activar/desactivar entrenador contra los 2 servicios nuevos, incluyendo el caso 409.
- Mocks nuevos en `__mocks__/auth-mock.js` (`mockRefresh`, `mockLogout`) y `__mocks__/roles-mock.js` (`mockActivateTrainerRole`, `mockDeactivateTrainerRole`).
- Sin tests de render de componentes (convención del proyecto) — el modal de contraseña se verifica manualmente en preview, mismo criterio que el resto de la UI visual.

## Riesgos / cosas a confirmar durante la implementación

- Confirmar en vivo (contra el backend real, no solo el swagger) si el 401 que dispara el refresh es distinguible de un 401 por credenciales inválidas en el login mismo — el interceptor de `api.js` no debe intentar refrescar cuando el 401 viene del propio `/auth/login` (no hay `refreshToken` todavía en ese momento, así que en la práctica no debería dispararse, pero vale la pena un test explícito).
- Confirmar que `PUT /users/{id}` (usado hoy por `updateUser` para otros campos del perfil) sigue aceptando actualizaciones parciales sin verse afectado por el auth middleware nuevo (más estricto) de forma que rompa algo no relacionado con este spec.

**Encontrado en el review final de rama (2026-08-07), ya resuelto:** un 401 de un endpoint autenticado con semántica de negocio (no de sesión) — ej. `POST /users/{id}/trainer-role` cuando la contraseña es incorrecta — cumplía igual la condición del interceptor genérico (`refreshToken` existe), disparando un refresh innecesario y, en el peor caso, un logout espurio. Resuelto con un flag `skipAuthRefresh` opcional en `services/api.js#post`, que el caller que conoce la semántica de su propio 401 pasa explícito (ver `services/roles.js#activateTrainerRole`). Si en el futuro se agregan más endpoints con el mismo patrón (401 = "credencial de negocio incorrecta", no "sesión vencida"), aplicar el mismo flag ahí también.

**Minor, no resuelto — anotado para si se retoma el tema de sesión más adelante:** ventana de carrera de baja probabilidad entre `refreshSession()` y `logout()` — si un refresh está en curso justo cuando el usuario cierra sesión, el `set()` del refresh puede completar *después* del `set()` de logout, dejando un token "fantasma" en el store tras un logout aparentemente exitoso. Requiere que el logout ocurra en la ventana exacta de un refresh en curso (poco probable en el uso normal), no bloqueante para este spec.
