# Editar Datos de Perfil — Design

**Branch:** `feature/profile-edit` (desde `develop`)
**Fecha:** 2026-07-08

## Contrato (swagger confirmado)
`PUT /api/v1/users/{id}` — `UserUpdateRequest`: name, surname, email, dni, birth_date, city, country, number, phone, phone_contact, province, street. **Sin status ni password.** Cambio de email → header `X-Current-Password`. Devuelve `UserUpdateResponse` (incluye status). 200/400/401(password)/404/409(email dup)/500.

## Decisiones
- **Extraer componentes de form a compartido**: `components/forms/`. register y edit los consumen (DRY).
- **Ruta anidada** `/profile/edit`: reestructurar `app/(tabs)/profile.jsx` → `app/(tabs)/profile/index.jsx` + `app/(tabs)/profile/edit.jsx`.
- **PUT set completo editable** (todos los campos con sus valores actuales; evita borrado por replace).

## Componentes / archivos
- `components/forms/fields.jsx`: `InputField`, `SelectField`, `PickerField`, `DateField`, `Row`, `Col` + consts (INPUT_CLASS, FIELD_LABEL, SELECT_CLASS, DATE_BASE). Exportados.
- `hooks/use-address-cascade.js`: encapsula estado país/provincia/localidad/calle/altura + handlers + gating + `COUNTRY_OPTIONS`. `useAddressCascade(initial)` para pre-cargar en edit. register y edit lo usan (elimina duplicación de la cascada).
- `register-screen.jsx`: refactor para importar de `forms/` y usar `useAddressCascade`. **Verificar que no regrese** (web preview).
- `services/user.js`: `updateUser(id, payload, currentPassword?)` → `PUT /users/{id}` (header `X-Current-Password` si hay password). Con `USE_MOCKS` → `mockUpdateUser`.
- `services/api.js`: extender `put(path, body, headers)` para pasar headers.
- `store/auth-store.js`: acción `updateUser(id, payload, currentPassword)` → llama service, normaliza respuesta, actualiza `user`, persiste. Devuelve `{ success, error }`.
- `components/profile/edit-profile-screen.jsx`: form pre-cargado desde `store.user`. Campo "Contraseña actual" condicional (solo si email cambió). Submit → updateUser. Éxito → toast success + volver a `/profile`. Errores → toast con mensaje del backend.
- `app/(tabs)/profile/edit.jsx`: renderiza `EditProfileScreen`.
- `components/profile/profile-screen.jsx`: botón "Editar datos" → `router.push('/profile/edit')` (reemplaza el toast stub).

## Validaciones
Reutilizar validators existentes (email, DNI, birth_date). Email cambiado sin contraseña actual → error inline "Ingresá tu contraseña actual". DNI/altura numéricos.

## Fuera de alcance
Baja lógica (PATCH status) — feature siguiente. Cambio de contraseña propiamente dicho (no hay endpoint). status no editable (solo via PATCH).

## Verificación
Web preview con `USE_MOCKS`: login mock → /profile → Editar → cambiar campos → submit → ver toast + datos actualizados. Regresión de register en web. Mobile: usuario en red buena.
