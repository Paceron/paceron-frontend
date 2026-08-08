# Recuperación de contraseña — Design

**Fecha:** 2026-07-27
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El backend agregó endpoints reales de recuperación de contraseña:

- `POST /api/v1/auth/forgot-password` — body `{ email }`, siempre responde el mismo mensaje genérico (no revela si el email existe, por diseño). Envía un código OTP de 6 dígitos por mail si el email pertenece a un usuario activo.
- `POST /api/v1/auth/reset-password` — body `{ email, code, new_password, confirm_password }`. El código vence a los 10 minutos.

El frontend hoy tiene un flujo placeholder (`components/auth/forgot-password-form.jsx`, montado inline dentro de `login-screen.jsx` vía `setView('forgot')`): solo pide el email y muestra un "¡Listo!" fake con el texto "Cuando el backend esté disponible..." — nunca llamó a nada real, y no existe ningún paso para ingresar el código ni la nueva contraseña.

## Alcance

**Dentro:** flujo completo de recuperación (pedir el código por email, ingresarlo junto con la nueva contraseña), 2 rutas nuevas dedicadas, 2 extracciones de componentes compartidos que esas rutas nuevas motivan (`AuthCardShell`, UI de fuerza de contraseña).

**Fuera:** baja de rol entrenador (sub-proyecto separado, ver spec propia una vez cerrado este); cualquier cambio a la lógica de negocio de login/register más allá de la navegación del link "¿Olvidaste tu contraseña?" y la migración visual al shell compartido (sin cambio de comportamiento).

## Decisiones

### Rutas dedicadas, no inline (Opción B)

`/forgot-password` y `/reset-password` — `Stack.Screen` nuevos en `app/_layout.jsx`, hermanos de `login`/`register` (mismo motivo que ellos: rutas fuera de `(tabs)`, no requieren sesión).

El botón "¿Olvidaste tu contraseña?" en `login-screen.jsx` pasa de `setView('forgot')` a `router.push('/forgot-password')`. `LoginScreen` pierde el estado `view`/import de `ForgotPasswordForm` — vuelve a ser una sola vista.

El paso-atrás usa el stack real de Expo Router (`router.back()`), no estado propio: como se llega a `/reset-password` vía `router.push` desde `/forgot-password`, volver atrás ya aterriza en el paso anterior correcto sin lógica adicional — ventaja concreta de rutas reales sobre alternar estado local.

Se borra `components/auth/forgot-password-form.jsx` (reemplazado por completo).

### `AuthCardShell` — extracción del shell visual compartido

Hoy duplicado idéntico en `login-screen.jsx` y `register-screen.jsx`: `SafeAreaView` + `KeyboardAwareScrollView` + `Animated.View` (fade-in con Reanimated) + card con borde/sombra + botón "Volver" + logo+wordmark. Se extrae a `components/auth/auth-card-shell.jsx`:

```
AuthCardShell({ title, subtitle, onBack, maxWidthWeb = 'max-w-md', children })
```

`register-screen.jsx` usa `maxWidthWeb = 'max-w-4xl'` (formulario más ancho); el resto usa el default. `login-screen.jsx` y `register-screen.jsx` migran a usarlo — mismas clases exactas, cero cambio visual. `ForgotPasswordScreen` y `ResetPasswordScreen` lo usan desde el día uno.

### UI de fuerza de contraseña — extracción

Hoy vive local, sin exportar, dentro de `register-screen.jsx` (`StrengthBar` + `RequirementRow`, consumen `utils/password-validators.js`). Se extrae a `components/forms/password-strength.jsx`, exportando ambos. `register-screen.jsx` migra a importarlos — cero cambio visual. `ResetPasswordScreen` los reusa para el campo de nueva contraseña.

Ambas extracciones tocan pantallas ya en producción (`login-screen.jsx`, `register-screen.jsx`) pero son movimientos mecánicos sin lógica nueva — mismo criterio que la extracción de `TeamsAccordion` esta misma sesión: se verifican con lint + revisión de diff línea por línea + preview visual, no requieren tests nuevos.

### Capa de servicio

Nuevo `services/password.js`, mismo patrón que `services/auth.js`/`services/user.js`/`services/roles.js` (rama `USE_MOCKS`, si no, `api.*` directo):

```js
export async function forgotPassword(email) {
  if (USE_MOCKS) return await mockForgotPassword(email);
  return await api.post('/auth/forgot-password', { email });
}

export async function resetPassword({ email, code, newPassword, confirmPassword }) {
  if (USE_MOCKS) return await mockResetPassword({ email, code, newPassword, confirmPassword });
  return await api.post('/auth/reset-password', {
    email, code, new_password: newPassword, confirm_password: confirmPassword,
  });
}
```

Nuevo `services/__mocks__/password-mock.js`, mismo patrón que `auth-mock.js` (mensaje fake, sin validar el código realmente — igual que el resto de los mocks del proyecto, que no reimplementan lógica de negocio).

**Sin cambios a `store/auth-store.js`** — el flujo no toca sesión ni usuario logueado, es independiente (se puede resetear la contraseña sin estar logueado, matching cómo ya funciona `login`/`register`).

### Pantallas

**`ForgotPasswordScreen`** (`/forgot-password`)
- `AuthCardShell` con título "Recuperar contraseña", subtítulo "Ingresá tu email y te enviamos un código de 6 dígitos para restablecer tu contraseña."
- Campo email — reusa `validateEmailFormat`/`isDisposableEmail` (`utils/email-validators.js`), mismos que ya usaba `forgot-password-form.jsx`.
- Submit → `forgotPassword(email)` → loading state con `ActivityIndicator` (mismo patrón que `activate-trainer-screen.jsx`) → como el backend siempre responde el mismo mensaje genérico (nunca revela si el email existe), el frontend trata cualquier respuesta 200 como éxito visual y navega — no hay branch de "email no encontrado" que mostrar. Error de red/500 → `Toast.show` error, se queda en la pantalla.
- Éxito → `router.push({ pathname: '/reset-password', params: { email } })`.

**`ResetPasswordScreen`** (`/reset-password`)
- Lee `email` de `useLocalSearchParams()`. Si falta (deep-link directo sin contexto) → `router.replace('/forgot-password')` inmediato, sin mostrar nada.
- `AuthCardShell` con título "Ingresá el código", subtítulo "Te enviamos un código de 6 dígitos a **{email}**. Ingresalo junto con tu nueva contraseña. El código vence a los 10 minutos."
- Campo código: 6 dígitos, `keyboardType="number-pad"`, `onChange` filtra no-dígitos y corta a 6 caracteres (mismo patrón que `register-screen.jsx` usa para `PASSWORD_MAX_LENGTH`: cap manual en el handler, no una prop dedicada).
- Campo nueva contraseña + confirmar — `InputField` con mismo patrón show/hide que `register-screen.jsx`, más `StrengthBar`/`RequirementRow` de `password-strength.jsx` debajo.
- Link "Reenviar código" → vuelve a llamar `forgotPassword(email)`, sin cambiar de pantalla, toast confirmando el envío. **Sin countdown** (decisión ya tomada: simple, sin timer).
- Submit → valida client-side primero (código de 6 dígitos, `isPasswordValid(newPassword)`, contraseñas coinciden) → `resetPassword({ email, code, newPassword, confirmPassword })` → éxito: `Toast.show` success + `router.replace('/login')` → error (código inválido/vencido, u otro del backend): `Toast.show` error con el mensaje que devuelva el backend, se queda en la pantalla para reintentar.

## Archivos

### Nuevos
- `app/forgot-password.jsx`
- `app/reset-password.jsx`
- `components/auth/forgot-password-screen.jsx`
- `components/auth/reset-password-screen.jsx`
- `components/auth/auth-card-shell.jsx`
- `components/forms/password-strength.jsx`
- `services/password.js`
- `services/__mocks__/password-mock.js`
- `utils/otp-validators.js` (`validateOtpCode` — exactamente 6 dígitos)

### Modificados
- `app/_layout.jsx` — 2 `Stack.Screen` nuevos.
- `components/auth/login-screen.jsx` — el link de "olvidé mi contraseña" navega en vez de togglear estado; migra a `AuthCardShell`.
- `components/auth/register-screen.jsx` — migra a `AuthCardShell` + `password-strength.jsx`.

### Borrados
- `components/auth/forgot-password-form.jsx`

## Notas de implementación

- El mock de `resetPassword` no valida el código realmente (siempre éxito) — mismo criterio que el resto de los mocks del proyecto, que no reimplementan lógica de negocio real.
- Orden de implementación: las 2 extracciones (`AuthCardShell`, `password-strength.jsx`) van primero, migrando `login-screen.jsx`/`register-screen.jsx` sin cambio visual y verificado, **antes** de construir las pantallas nuevas sobre esa base — evita construir la UI dos veces.
- `docs/.../memory/backend-constraints.md` (memoria de Claude, no del repo) tiene la nota vieja "no existe endpoint de forgot-password" — se actualiza al cerrar este trabajo, junto con la corrección ya identificada de que el sistema de roles tampoco es "100% local" (ver spec de baja de entrenador, sub-proyecto siguiente).

## Verification

- `npm run lint` → 0 errores, `nativeID`/`testID` en todo lo nuevo.
- `npm test` → sin tests de render nuevos (convención del proyecto), pero `utils/otp-validators.js` es lógica pura — sí lleva test unitario, mismo criterio que `utils/date-validators.js` (`__tests__/date-validators.test.js`).
- Preview web con `EXPO_PUBLIC_USE_MOCKS=true`: flujo completo email → código → nueva contraseña → redirect a login. Botón "Volver" en cada paso. "Reenviar código". Deep-link directo a `/reset-password` sin email → redirige a `/forgot-password`.
- Verificación contra el backend real (sin mocks) queda a cargo del usuario si quiere confirmar el contrato end-to-end en Render.
