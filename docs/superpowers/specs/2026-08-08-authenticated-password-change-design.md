# Cambio de contraseña autenticado — diseño

**Contexto:** el backend expone `PATCH /api/v1/users/{id}/password` (verificado contra swagger real, `paceron-backend-as9c.onrender.com/swagger/doc.json`), distinto del flujo OTP de `forgot-password`/`reset-password`. Estricto: requiere `current_password`, `new_password` y `confirm_password`, los 3 obligatorios (`user.ChangePasswordRequest`). Hasta ahora el frontend no tenía consumidor para este endpoint — quedó anotado como "PARA DESPUES" el 2026-08-07.

## Arquitectura

Segundo `SectionCard` dentro de `EditProfileScreen` (`components/profile/edit-profile-screen.jsx`), con estado y botón de guardar propios, independiente del form de datos personales ya existente. Sin ruta nueva. Sin Zustand — es estado de servidor puntual (un fetch de escritura sin dato que persistir localmente), mismo patrón que `forgot-password`/`reset-password`: llamada directa al service, sin pasar por el store.

## Componentes

- `SectionCard icon="lock" title="Cambiar contraseña"`, ubicado después del botón "Guardar cambios" del form de datos personales (dos acciones independientes, visualmente separadas).
- 3 campos en orden: **Contraseña actual** → **Nueva contraseña** → **Confirmar nueva contraseña**. `InputField` con toggle mostrar/ocultar en los 3. `PasswordRequirementsList` + `StrengthBar` (`components/forms/password-strength.jsx`, sin cambios) debajo de "Nueva contraseña", igual que en `register-screen.jsx`/`reset-password-screen.jsx`.
- Botón propio "Guardar contraseña", deshabilitado hasta que los 3 campos sean válidos.

## Datos

- `services/user.js`: nueva función `changePassword(id, { currentPassword, newPassword, confirmPassword })` → `PATCH /users/{id}/password` con body `{ current_password, new_password, confirm_password }`.
- `services/api.js`: `api.patch` pasa a aceptar `options` como tercer parámetro (igual que `api.post`), en vez de `headers` crudo — hoy ningún caller de `patch` pasa headers, cambio sin riesgo. Esto habilita pasar `{ skipAuthRefresh: true }`.
- `skipAuthRefresh: true` en la llamada: un 401 acá es "contraseña actual incorrecta" (negocio), no "sesión vencida" — mismo problema y misma solución que `activateTrainerRole` (`services/roles.js`). Sin esto, el interceptor dispararía un refresh de sesión espurio.
- Mock: `services/__mocks__/user-mock.js` → `mockChangePassword`, valida `currentPassword` contra un valor fijo simulado (ej. rechaza si no es `'password123'`) y devuelve `{ message }` en éxito.

## Validación client-side

Reutiliza `utils/password-validators.js` sin cambios: `isPasswordValid(newPassword)`, `newPassword === confirmPassword`, `currentPassword.length > 0`. Mismos criterios que `reset-password-screen.jsx`.

## Errores

- 400/401 del backend → toast de error con el mensaje del backend (`error.message`), el form no se limpia — el usuario corrige y reintenta.
- Éxito → toast de éxito, se limpian los 3 campos, el usuario se queda en `/profile/edit` (no redirige — a diferencia del form de datos personales, que sí hace `router.replace('/profile')`).

## Testing

- `__tests__/user-mock.test.js`: casos para `mockChangePassword` (contraseña actual correcta/incorrecta, mismatch de confirmación).
- Sin tests de render (convención del proyecto) — verificación manual vía preview web, formularios probados con `npm test`/`npm run lint` en verde antes de mergear.

## Alcance

Sin plan formal — diseño ya concreto y mecánico, sigue el patrón de `reset-password-screen.jsx`/`activate-trainer-screen.jsx` punto por punto. Implementación directa en una rama `feature/authenticated-password-change`.
