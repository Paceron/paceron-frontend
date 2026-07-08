# Auth Foundation + Contract-First API Layer — Design

**Branch:** `feature/authFoundation` (from `develop`)
**Date:** 2026-07-07
**Status:** Approved design, pending implementation plan

## Contexto y problema

El repo es un template cross-platform (Expo Router + React Native Web + NativeWind
+ Zustand + TanStack Query). Ya existen pantallas de auth (login, register,
forgot-password) y una landing, pero la capa de servicios **no coincide con el
backend real** publicado en `https://paceron-backend.onrender.com`
(Go/Gin, spec en `/swagger/doc.json`).

### Discrepancias detectadas (frontend vs backend real)

| Código frontend actual | Realidad del backend |
| --- | --- |
| base `.../api` + `/auth/login` | real es `/api/v1/auth/login` — falta `/v1` |
| `checkEmailExists` → `/auth/check-email` | **endpoint no existe** |
| `requestPasswordReset` → `/auth/forgot-password` | **endpoint no existe** |
| store lee `result.token` | real devuelve `{ user, authorization: { access_token, refresh_token, expires_in } }` |
| register auto-login vía `result.token` | register **no devuelve token** |
| register manda camelCase (`firstName`, `birthDate`) | backend espera snake_case (`name`, `surname`, `birth_date`) |
| activación rol entrenador | **no existe endpoint ni campo `role`** — solo `status` |

### Endpoints reales soportados

- `POST /api/v1/auth/login` → `{ user, authorization }`
- `POST /api/v1/auth/register` → `RegisterResponse` (sin token), 409 si email duplicado
- `GET /api/v1/auth/user?id=|email=` (sin auth)
- `PUT /api/v1/users/{id}` (header `X-Current-Password` para cambio de email)
- `PATCH /api/v1/users/{id}/status` → `status: active|inactive|pause|blocked|suspended`

## Alcance de esta spec

Foundation de auth + capa de API contract-first con adaptador mock.
Objetivo: dejar login/registro/sesión funcionando contra el contrato real,
con modo mock para desarrollar UI sin backend.

**Fuera de alcance** (ramas posteriores): perfil (view/edit), baja de usuario,
activación de entrenador (sin backend), recuperación real de contraseña
(sin backend), unificación de landing cross-platform, home autenticado
(dashboard). Mientras no exista dashboard, el redirect post-login es `/`.

## Decisiones tomadas

- **Estrategia API:** contract-first + adaptador mock (flag de entorno).
- **Persistencia de sesión:** cross-platform segura — `expo-secure-store`
  (native) + `localStorage` (web).
- **Post-registro:** auto-login (llamar login con las mismas credenciales) y
  redirect a `/`.
- **Refresh token:** guardar `refresh_token` + `expires_in`, pero **stub** — sin
  auto-refresh; en 401 se hace logout. Se cablea en una pasada futura.
- **`getUser`:** diferido a la rama de perfil. El foundation obtiene el `user`
  directo de login/register.
- **Pre-check de email:** se elimina; se confía en el 409 del register.

## Diseño por componentes

### 1. `config/env.js`
- `API_BASE_URL`: default remoto = URL de Render, con sufijo `/api/v1`;
  overridable por `EXPO_PUBLIC_API_URL`.
- Nuevo `USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true'`.

### 2. Storage adapter — `services/storage.js` (+ `.web.jsx`)
- Interface única: `getItem(key)`, `setItem(key, value)`, `removeItem(key)`
  (async).
- Native → `expo-secure-store`. Web → `localStorage` (variante `.web`).
- Depende de: `expo-secure-store` (nueva dependencia, Expo-managed oficial).

### 3. API client — `services/api.js`
- Transporte igual (fetch + Authorization Bearer del store).
- En respuesta no-ok: parsear `apierror.APIError` `{ status_code, code, message }`
  y lanzar un `Error` que lleve `status` + `message` reales, para que la UI
  muestre el mensaje del backend (no "Request failed with status 409").

### 4. Servicios de dominio
- `services/auth.js`: `login(email, password)`, `register(payload)`.
  **Eliminar** `checkEmailExists` y `requestPasswordReset`.
- `services/normalizers.js`:
  - `toUserModel(dto)` — snake_case → camelCase (fuente única de shape).
    **Tolera campos ausentes**: la respuesta es sparse (campos sin valor no se
    devuelven, ej. dirección). Los ausentes quedan `undefined`/vacío sin romper.
  - `toRegisterPayload(form)` — camelCase → snake_case + `birth_date` a
    **`DD/MM/YYYY`** (formato real del backend, confirmado por respuesta live).
    Normaliza ambos orígenes: web (`<input type="date">` da `YYYY-MM-DD`) y
    mobile (texto `DD/MM/AAAA`) → `DD/MM/YYYY`.
- Mock adapter `services/__mocks__/auth-mock.js`: cuando `USE_MOCKS`, los
  servicios devuelven user/token fake con **la misma shape normalizada**, así
  store y UI son idénticos en ambos modos.

### 5. Store — `store/auth-store.js`
- Estado: `user`, `token` (access), `refreshToken`, `expiresAt`, `hydrated`.
- `hydrate()`: carga `{ user, token, refreshToken, expiresAt }` de storage al
  arrancar; marca `hydrated`.
- `login`: lee `result.authorization.access_token`; normaliza user; persiste.
- `register`: en 201, **auto-login** con las mismas credenciales; persiste.
- `logout`: limpia store + storage.
- 401 → logout (stub de refresh).

### 6. Ajustes de pantallas
- **Register** (`components/auth/register-screen.jsx`): quitar `checkEmailExists`;
  mapear campos con `toRegisterPayload`; confiar en 409 → toast con mensaje del
  backend; auto-login + redirect `/`.
- **Login** (`components/auth/login-screen.jsx`): mostrar mensaje real de error;
  resto igual.
- **Forgot-password** (`components/auth/forgot-password-form.jsx`): sin cambios
  (stub correcto — el backend no tiene endpoint).

### 7. Rehidratación
- Llamar `hydrate()` en `providers/app-providers.jsx` (o un `AuthProvider`
  pequeño) al montar, antes de renderizar rutas; no renderizar hasta `hydrated`.

### 8. Tests
- Actualizar `__tests__/auth-store.test.js`: nueva shape de respuesta,
  auto-login post-registro, `hydrate`, logout limpia storage. Mockear storage
  adapter.

## Flujo de datos (sin cambios de arquitectura)

Pantalla → acción del store → service → api → backend.
`USE_MOCKS` intercepta en la capa service; store/UI no se enteran.

## Riesgos / notas

- Formato de `birth_date`: confirmado `DD/MM/YYYY` vía respuesta live
  (`GET /api/v1/auth/user?id=3` → `"birth_date":"01/01/1988"`).
- Respuestas sparse: el backend omite campos sin valor (ej. usuario sin
  dirección). Normalizers y UI de perfil no deben asumir presencia de campos.
- `expo-secure-store` requiere que se instale y, en native, rebuild del dev
  client si aplica.
- El campo `role`/entrenador no existe en el backend; cualquier UI de rol queda
  para cuando exista soporte.
