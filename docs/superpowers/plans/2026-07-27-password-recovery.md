# Recuperación de contraseña — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flujo completo de recuperación de contraseña contra el backend real (pedir código de 6 dígitos por email, ingresarlo junto con la nueva contraseña), en 2 rutas dedicadas, reemplazando el placeholder actual que nunca llamaba a nada real.

**Architecture:** `/forgot-password` y `/reset-password` como `Stack.Screen` nuevos, hermanos de `login`/`register`. Paso-atrás resuelto por el stack real de Expo Router (`router.back()`), no por estado propio. Dos extracciones de componentes ya duplicados o a punto de duplicarse (`AuthCardShell`, UI de fuerza de contraseña) migran a `login-screen.jsx`/`register-screen.jsx` sin cambio visual, para que las 2 pantallas nuevas las reusen desde el día uno.

**Tech Stack:** Expo Router (file-based, `useLocalSearchParams`/`router.push({pathname, params})`), React Native Web, NativeWind, Zustand, react-native-toast-message.

## Global Constraints

- `nativeID`/`testID` obligatorios en todo `View`/`Text`/`Pressable`/`TextInput`/`Image`/etc. nuevo (regla del proyecto, `local/require-native-id` en `eslint.config.js` falla el build si falta).
- Las extracciones (`AuthCardShell`, `password-strength.jsx`) cambian los valores de `nativeID`/`testID` de elementos ya existentes en `login-screen.jsx`/`register-screen.jsx` (de `login-screen-*`/`register-screen-*` a `auth-card-shell-*`/`password-strength-*`) — es intencional (el id debe reflejar el componente que realmente renderiza el elemento) y **no** es un cambio visual. Cualquier otro cambio de estas 2 pantallas debe ser cero — mismas clases, mismo comportamiento.
- Sin tests de render de componentes (convención del proyecto) — `npm run lint` + `npm test` (suite existente sin romperse) + preview visual son la verificación, salvo para `utils/otp-validators.js` (lógica pura, sí lleva test, mismo criterio que `utils/date-validators.js`).
- El backend siempre responde el mismo mensaje genérico en `forgot-password` (nunca revela si el email existe) — el frontend no debe intentar diferenciar "email no encontrado" de "email enviado".
- El código OTP vence a los 10 minutos — **sin countdown/timer en la UI** (decisión ya tomada), el reenvío está siempre disponible.

Spec completa: `docs/superpowers/specs/2026-07-27-password-recovery-design.md`.

---

### Task 1: Extraer `AuthCardShell`, migrar `login-screen.jsx`

**Files:**
- Create: `components/auth/auth-card-shell.jsx`
- Modify: `components/auth/login-screen.jsx`

**Interfaces:**
- Produces: `AuthCardShell({ cardClassName = 'max-w-md p-8', children })` — envuelve `children` en el shell visual compartido (fade-in, card centrada, back button, logo+wordmark). Usado por Task 2 (`register-screen.jsx`), Task 6 (`ForgotPasswordScreen`), Task 7 (`ResetPasswordScreen`).

Migración de comportamiento cero: `LoginScreen` sigue togglando entre `LoginForm` y `ForgotPasswordForm` exactamente igual que hoy (ese comportamiento cambia recién en Task 6). `LoginForm` (el sub-componente) no se toca en este task.

- [ ] **Step 1: Crear `components/auth/auth-card-shell.jsx`**

```jsx
import { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';

// Shell visual compartido por las pantallas de auth (login, register, forgot
// password, reset password): fade-in con Reanimated, card centrada con
// logo+wordmark, botón "Volver" que usa el stack real de router (no estado
// propio) — cae a "/" si no hay historial. Extraído de login-screen.jsx y
// register-screen.jsx, mismas clases exactas, sin cambio visual.
// `cardClassName` cubre lo que variaba entre esas dos pantallas (ancho máximo
// y padding) — todo lo demás es fijo.
export function AuthCardShell({ cardClassName = 'max-w-md p-8', children }) {
  const router = useRouter();
  const colors = useThemeColors();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="auth-card-shell-safe-area" testID="auth-card-shell-safe-area">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={24}
      >
        <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }, animatedStyle]} nativeID="auth-card-shell-animated-wrapper" testID="auth-card-shell-animated-wrapper">
          <View className={`w-full ${cardClassName} rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-surface`} nativeID="auth-card-shell-card" testID="auth-card-shell-card">
            <Pressable
              className="-ml-2 mb-4 flex-row items-center gap-1.5 self-start rounded-lg px-2 py-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              onPress={handleBack}
              nativeID="auth-card-shell-back-button"
              testID="auth-card-shell-back-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={16} />
              <Text className="text-sm text-slate-600 dark:text-slate-300" nativeID="auth-card-shell-back-button-label" testID="auth-card-shell-back-button-label">Volver</Text>
            </Pressable>

            <View className="mb-8 items-center" nativeID="auth-card-shell-logo-wrapper" testID="auth-card-shell-logo-wrapper">
              <Image
                resizeMode="contain"
                source={require('../../assets/paceron-symbol-transparent.png')}
                style={{ width: 48, height: 48 }}
                nativeID="auth-card-shell-logo-image"
                testID="auth-card-shell-logo-image"
              />
              <PaceronBrand size={16} style={{ marginTop: 8 }} />
            </View>

            {children}
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `components/auth/login-screen.jsx`**

`LoginForm` (líneas 24-204 del archivo actual) se copia **sin ningún cambio** — el título/subtítulo de `LoginForm` NO se centran (a diferencia de `register-screen.jsx`), esto es intencional, no se normaliza en este task.

```jsx
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { useAuthStore } from '../../store/auth-store.js';
import { AuthCardShell } from './auth-card-shell.jsx';
import { ForgotPasswordForm } from './forgot-password-form.jsx';

// --- Login form ---

function LoginForm({ onForgotPassword }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const validateEmail = useCallback((value) => {
    if (!value) return 'El email es requerido.';
    if (!validateEmailFormat(value)) return 'El formato del email no es válido.';
    if (isDisposableEmail(value)) return 'No se permiten emails temporales o de un solo uso.';
    return null;
  }, []);

  const handleEmailChange = (value) => {
    setEmail(value);
    if (emailTouched) setEmailError(validateEmail(value));
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
  };

  const emailOk = !emailError && emailTouched && email.length > 0;
  const isFormValid = emailOk && validateEmailFormat(email) && !isDisposableEmail(email);

  const handleSubmit = async () => {
    if (loading) return;
    setEmailTouched(true);
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        Toast.show({ type: 'success', text1: '¡Bienvenido de nuevo!', text2: 'Iniciaste sesión correctamente.' });
        router.replace('/');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: result.error || 'El email o la contraseña son incorrectos.',
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Error de conexión',
        text2: 'Intentá de nuevo más tarde.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="mb-2 text-2xl text-slate-900 dark:text-white" nativeID="login-screen-form-title" testID="login-screen-form-title">Iniciar sesión</Text>
      <Text className="mb-8 text-sm text-slate-500 dark:text-slate-400" nativeID="login-screen-form-subtitle" testID="login-screen-form-subtitle">
        Ingresá tus credenciales para acceder a Paceron.
      </Text>

      {/* Email */}
      <View className="mb-5" nativeID="login-screen-email-group" testID="login-screen-email-group">
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="login-screen-email-label" testID="login-screen-email-label">Email</Text>
        <View className={`h-12 flex-row items-center rounded-xl border ${
          emailError
            ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
            : emailOk
            ? 'border-primary bg-white dark:bg-slate-900'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
        }`} nativeID="login-screen-email-field-wrapper" testID="login-screen-email-field-wrapper">
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            className="flex-1 px-4 text-sm text-slate-900 dark:text-white outline-none"
            keyboardType="email-address"
            onBlur={handleEmailBlur}
            onChangeText={handleEmailChange}
            onSubmitEditing={() => {}}
            placeholder="tu@email.com"
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="next"
            textContentType="emailAddress"
            value={email}
            nativeID="login-screen-email-input"
            testID="login-screen-email-input"
          />
          {emailTouched && (
            <View className="px-3" nativeID="login-screen-email-status-icon-wrapper" testID="login-screen-email-status-icon-wrapper">
              {emailError
                ? <MaterialCommunityIcons color="#ef4444" name="alert-circle-outline" size={18} />
                : <MaterialCommunityIcons color="#8cc63e" name="check-circle-outline" size={18} />
              }
            </View>
          )}
        </View>
        <View className="h-5" nativeID="login-screen-email-error-slot" testID="login-screen-email-error-slot">
          {emailError && <Text className="text-xs text-red-500 dark:text-red-400" nativeID="login-screen-email-error" testID="login-screen-email-error">{emailError}</Text>}
        </View>
      </View>

      {/* Password */}
      <View className="mb-6" nativeID="login-screen-password-group" testID="login-screen-password-group">
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="login-screen-password-label" testID="login-screen-password-label">Contraseña</Text>
        <View className="h-12 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900" nativeID="login-screen-password-field-wrapper" testID="login-screen-password-field-wrapper">
          <TextInput
            autoComplete="password"
            className="flex-1 px-4 text-sm text-slate-900 dark:text-white outline-none"
            onChangeText={handlePasswordChange}
            onSubmitEditing={handleSubmit}
            placeholder="Tu contraseña"
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="done"
            secureTextEntry={!showPassword}
            textContentType="password"
            value={password}
            nativeID="login-screen-password-input"
            testID="login-screen-password-input"
          />
          <Pressable className="rounded-lg px-3 hover:bg-slate-100 dark:hover:bg-slate-800" onPress={() => setShowPassword((v) => !v)} nativeID="login-screen-password-toggle-button" testID="login-screen-password-toggle-button">
            <MaterialCommunityIcons
              color={colors.onSurfaceVariant}
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
            />
          </Pressable>
        </View>
      </View>

      {/* Submit button */}
      <Pressable
        className={`mb-4 h-12 items-center justify-center rounded-full ${
          isFormValid ? 'bg-primary hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'
        } active:opacity-80`}
        disabled={loading}
        onPress={handleSubmit}
        nativeID="login-screen-submit-button"
        testID="login-screen-submit-button"
      >
        {loading ? (
          <ActivityIndicator color={isFormValid ? '#111518' : colors.onSurfaceVariant} size="small" />
        ) : (
          <Text className={`text-sm font-semibold uppercase tracking-wide ${
            isFormValid ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'
          }`} nativeID="login-screen-submit-button-label" testID="login-screen-submit-button-label">
            Ingresar
          </Text>
        )}
      </Pressable>

      {/* Forgot password */}
      <Pressable className="items-center py-1 hover:opacity-70" onPress={onForgotPassword} nativeID="login-screen-forgot-password-button" testID="login-screen-forgot-password-button">
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="login-screen-forgot-password-label" testID="login-screen-forgot-password-label">
          ¿Olvidaste tu contraseña?
        </Text>
      </Pressable>

      {/* Register link */}
      <Pressable className="items-center py-1 hover:opacity-70" onPress={() => router.push('/register')} nativeID="login-screen-register-link-button" testID="login-screen-register-link-button">
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="login-screen-register-link-label" testID="login-screen-register-link-label">
          ¿No tenés cuenta?{' '}
          <Text className="font-semibold text-primary" nativeID="login-screen-register-link-emphasis" testID="login-screen-register-link-emphasis">Registrate</Text>
        </Text>
      </Pressable>
    </>
  );
}

// --- Screen ---

export function LoginScreen() {
  const [view, setView] = useState('login'); // 'login' | 'forgot'

  return (
    <AuthCardShell cardClassName="max-w-md p-8">
      {view === 'login' ? (
        <LoginForm onForgotPassword={() => setView('forgot')} />
      ) : (
        <ForgotPasswordForm onBack={() => setView('login')} />
      )}
    </AuthCardShell>
  );
}
```

- [ ] **Step 3: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 33/33 (sin cambios de lógica).

- [ ] **Step 4: Verificar visualmente en preview**

Ir a `/login` — confirmar que se ve exactamente igual que antes (card, logo, back button, título "Iniciar sesión" sin centrar). Tocar "¿Olvidaste tu contraseña?" — confirmar que sigue mostrando `ForgotPasswordForm` (el placeholder actual) dentro de la misma card, sin navegar de ruta. Volver.

- [ ] **Step 5: Commit**

```bash
git add components/auth/auth-card-shell.jsx components/auth/login-screen.jsx
git commit -m "refactor(auth): extract AuthCardShell, migrate login screen"
```

---

### Task 2: Migrar `register-screen.jsx` a `AuthCardShell`

**Files:**
- Modify: `components/auth/register-screen.jsx`

**Interfaces:**
- Consumes: `AuthCardShell` (Task 1).

Migración de comportamiento cero — mismos campos, misma validación, mismo submit. `StrengthBar`/`RequirementRow` locales **se mantienen sin tocar** en este task (se extraen recién en Task 3).

- [ ] **Step 1: Reemplazar el contenido completo de `components/auth/register-screen.jsx`**

```jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import {
  PASSWORD_REQUIREMENTS,
  PASSWORD_MAX_LENGTH,
  checkPasswordRequirements,
  isPasswordValid,
  getPasswordStrengthScore,
  getPasswordStrengthMeta,
} from '../../utils/password-validators.js';
import { validateBirthDate } from '../../utils/date-validators.js';
import { validateDNI } from '../../utils/dni-validators.js';
import { toRegisterPayload } from '../../services/normalizers.js';
import { useAuthStore } from '../../store/auth-store.js';
import { isWeb } from '../../utils/platform.js';
import { Row, Col, SelectField, DateField, InputField, PickerField } from '../forms/fields.jsx';
import { SectionCard } from '../forms/section-card.jsx';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { AuthCardShell } from './auth-card-shell.jsx';

function StrengthBar({ password }) {
  const score = getPasswordStrengthScore(password);
  const total = PASSWORD_REQUIREMENTS.length;
  const pct = Math.round((score / total) * 100);
  const { label, color } = getPasswordStrengthMeta(score);

  return (
    <View className="mb-3 mt-2" nativeID="register-screen-strength-bar" testID="register-screen-strength-bar">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" nativeID="register-screen-strength-bar-track" testID="register-screen-strength-bar-track">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" nativeID="register-screen-strength-bar-fill" testID="register-screen-strength-bar-fill" />
      </View>
      {password.length > 0 && (
        <Text style={{ color }} className="mt-1 text-xs font-semibold" nativeID="register-screen-strength-bar-label" testID="register-screen-strength-bar-label">
          {label}
        </Text>
      )}
    </View>
  );
}

function RequirementRow({ id, met, label }) {
  const colors = useThemeColors();
  return (
    <View className="mb-1 flex-row items-center gap-2" nativeID={`register-screen-requirement-${id}`} testID={`register-screen-requirement-${id}`}>
      <MaterialCommunityIcons
        color={met ? '#8cc63e' : colors.onSurfaceVariant}
        name={met ? 'check-circle' : 'circle-outline'}
        size={14}
      />
      <Text className={`text-xs ${met ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`register-screen-requirement-${id}-label`} testID={`register-screen-requirement-${id}-label`}>
        {label}
      </Text>
    </View>
  );
}

export function RegisterScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneContact, setPhoneContact] = useState('');

  const [openSection, setOpenSection] = useState('personal');

  const toggleSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const {
    country,
    province,
    city,
    street,
    number,
    setStreet,
    setNumber,
    provinceOptions,
    cityOptions,
    countryOptions,
    handleCountryChange,
    handleProvinceChange,
    handleCityChange,
  } = useAddressCascade();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState({});
  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const emailError = touched.email && !email
    ? 'El email es requerido.'
    : touched.email && !validateEmailFormat(email)
    ? 'El formato del email no es válido.'
    : touched.email && isDisposableEmail(email)
    ? 'No se permiten emails temporales o de un solo uso.'
    : null;

  const dniError = touched.dni && validateDNI(dni);
  const dateError = touched.birthDate && validateBirthDate(birthDate);

  const passwordReqs = checkPasswordRequirements(password);
  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const personalOk =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !validateDNI(dni) &&
    !validateBirthDate(birthDate) &&
    validateEmailFormat(email) &&
    !isDisposableEmail(email);
  const formValid = personalOk && passwordValid && passwordsMatch;

  const handleSubmit = async () => {
    if (loading) return;
    touch('firstName');
    touch('lastName');
    touch('dni');
    touch('birthDate');
    touch('email');
    touch('password');
    touch('confirm');

    if (!formValid) return;

    setLoading(true);
    try {
      const { register } = useAuthStore.getState();
      const result = await register(
        toRegisterPayload({
          firstName,
          lastName,
          dni,
          birthDate,
          email,
          phone,
          phoneContact,
          country,
          province,
          city,
          street,
          number,
          password,
        }),
      );
      if (result.success) {
        Toast.show({ type: 'success', text1: '¡Cuenta creada!', text2: 'Bienvenido a Paceron.' });
        router.replace('/');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Error al crear la cuenta.' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardShell cardClassName={isWeb ? 'max-w-4xl py-8 px-6' : 'max-w-md py-8 px-6'}>
      <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="mb-1 text-center text-2xl text-slate-900 dark:text-white" nativeID="register-screen-title" testID="register-screen-title">Crear cuenta</Text>
      <Text className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="register-screen-subtitle" testID="register-screen-subtitle">
        Completá tus datos para registrarte en Paceron.
      </Text>

      <SectionCard collapsible collapsed={openSection !== 'personal'} icon="account-details" onToggle={() => toggleSection('personal')} title="Datos personales">
        <Row>
          <Col>
            <InputField
              autoCapitalize="words"
              autoComplete="given-name"
              error={touched.firstName && !firstName.trim() ? 'El nombre es requerido.' : null}
              label="Nombre *"
              onBlur={() => touch('firstName')}
              onChange={setFirstName}
              placeholder="Tu nombre"
              returnKeyType="next"
              textContentType="givenName"
              touched={touched.firstName}
              value={firstName}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="words"
              autoComplete="family-name"
              error={touched.lastName && !lastName.trim() ? 'Los apellidos son requeridos.' : null}
              label="Apellidos *"
              onBlur={() => touch('lastName')}
              onChange={setLastName}
              placeholder="Tus apellidos"
              returnKeyType="next"
              textContentType="familyName"
              touched={touched.lastName}
              value={lastName}
            />
          </Col>
        </Row>

        <InputField
          autoCapitalize="none"
          autoComplete="email"
          error={emailError}
          keyboardType="email-address"
          label="Email *"
          onBlur={() => touch('email')}
          onChange={setEmail}
          placeholder="tu@email.com"
          returnKeyType="next"
          textContentType="emailAddress"
          touched={touched.email}
          value={email}
        />

        <Row>
          <Col flex={1.3}>
            <DateField
              error={typeof dateError === 'string' ? dateError : null}
              label="Fecha de nacimiento *"
              onBlur={() => touch('birthDate')}
              onChange={setBirthDate}
              touched={touched.birthDate}
              value={birthDate}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="none"
              autoComplete="off"
              error={typeof dniError === 'string' ? dniError : null}
              keyboardType="number-pad"
              label="DNI *"
              onBlur={() => touch('dni')}
              onChange={(v) => setDni(v.replace(/\D/g, ''))}
              placeholder="Solo números"
              returnKeyType="next"
              touched={touched.dni}
              value={dni}
            />
          </Col>
        </Row>

        <Row>
          <Col>
            <InputField
              autoCapitalize="none"
              autoComplete="tel"
              keyboardType="phone-pad"
              label="Teléfono"
              onChange={setPhone}
              placeholder="+54 11 1234 5678"
              returnKeyType="next"
              textContentType="telephoneNumber"
              value={phone}
            />
          </Col>
          <Col>
            <InputField
              autoCapitalize="none"
              autoComplete="tel"
              keyboardType="phone-pad"
              label="Teléfono de contacto"
              onChange={setPhoneContact}
              placeholder="Otro número de contacto"
              returnKeyType="next"
              textContentType="telephoneNumber"
              value={phoneContact}
            />
          </Col>
        </Row>
      </SectionCard>

      <SectionCard collapsible collapsed={openSection !== 'address'} icon="map-marker" onToggle={() => toggleSection('address')} title="Dirección">
        <Row>
          <Col>
            {isWeb ? (
              <SelectField
                label="País"
                onChange={handleCountryChange}
                options={countryOptions}
                placeholder="Seleccioná un país"
                value={country}
              />
            ) : (
              <PickerField
                label="País"
                onChange={handleCountryChange}
                options={countryOptions}
                placeholder="Seleccioná un país"
                value={country}
              />
            )}
          </Col>
          <Col>
            {isWeb ? (
              <SelectField
                disabled={!country}
                label="Provincia"
                onChange={handleProvinceChange}
                options={provinceOptions}
                placeholder={country ? 'Seleccioná una provincia' : 'Elegí un país'}
                value={province}
              />
            ) : (
              <PickerField
                disabled={!country}
                label="Provincia"
                onChange={handleProvinceChange}
                options={provinceOptions}
                placeholder={country ? 'Seleccioná una provincia' : 'Elegí un país'}
                value={province}
              />
            )}
          </Col>
          <Col>
            {isWeb ? (
              <SelectField
                disabled={!province}
                label="Localidad"
                onChange={handleCityChange}
                options={cityOptions}
                placeholder={province ? 'Seleccioná una localidad' : 'Elegí una provincia'}
                value={city}
              />
            ) : (
              <PickerField
                disabled={!province}
                label="Localidad"
                onChange={handleCityChange}
                options={cityOptions}
                placeholder={province ? 'Seleccioná una localidad' : 'Elegí una provincia'}
                value={city}
              />
            )}
          </Col>
        </Row>

        <Row>
          <Col flex={3}>
            <InputField
              autoCapitalize="words"
              disabled={!city}
              label="Calle"
              onChange={setStreet}
              placeholder={city ? 'Nombre de la calle' : 'Elegí una localidad primero'}
              returnKeyType="next"
              value={street}
            />
          </Col>
          <Col flex={1}>
            <InputField
              autoCapitalize="none"
              disabled={!city}
              keyboardType="number-pad"
              label="Altura"
              onChange={(v) => setNumber(v.replace(/\D/g, ''))}
              placeholder={city ? '1234' : '—'}
              returnKeyType="next"
              value={number}
            />
          </Col>
        </Row>
      </SectionCard>

      <SectionCard collapsible collapsed={openSection !== 'password'} icon="lock-outline" onToggle={() => toggleSection('password')} title="Contraseña">
        <Row>
          <Col>
            <InputField
              autoComplete="new-password"
              label="Contraseña *"
              onBlur={() => touch('password')}
              onChange={(v) => { if (v.length <= PASSWORD_MAX_LENGTH) setPassword(v); }}
              onToggleSecure={() => setShowPassword((v) => !v)}
              placeholder="Tu contraseña"
              returnKeyType="next"
              secureTextEntry={!showPassword}
              showSecure={showPassword}
              textContentType="newPassword"
              value={password}
            />
          </Col>
          <Col>
            <InputField
              autoComplete="new-password"
              error={touched.confirm && !passwordsMatch && confirmPassword.length > 0 ? 'Las contraseñas no coinciden.' : null}
              label="Confirmar contraseña *"
              onBlur={() => touch('confirm')}
              onChange={setConfirmPassword}
              onToggleSecure={() => setShowConfirm((v) => !v)}
              placeholder="Repetí tu contraseña"
              returnKeyType="done"
              secureTextEntry={!showConfirm}
              showSecure={showConfirm}
              textContentType="newPassword"
              value={confirmPassword}
            />
          </Col>
        </Row>

        <View className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900" nativeID="register-screen-requirements-list" testID="register-screen-requirements-list">
          {PASSWORD_REQUIREMENTS.map((req) => (
            <RequirementRow key={req.id} id={req.id} label={req.label} met={passwordReqs[req.id]} />
          ))}
        </View>

        <StrengthBar password={password} />
      </SectionCard>

      <Pressable
        className={`mt-8 h-12 items-center justify-center rounded-full ${
          formValid ? 'bg-primary hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'
        } active:opacity-80`}
        disabled={loading}
        onPress={handleSubmit}
        nativeID="register-screen-submit-button"
        testID="register-screen-submit-button"
      >
        {loading ? (
          <ActivityIndicator color="#111518" size="small" />
        ) : (
          <Text className={`text-sm font-semibold uppercase tracking-wide ${
            formValid ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'
          }`} nativeID="register-screen-submit-button-label" testID="register-screen-submit-button-label">
            Crear cuenta
          </Text>
        )}
      </Pressable>

      <Pressable className="mt-6 items-center py-1 hover:opacity-70" onPress={() => router.push('/login')} nativeID="register-screen-login-link-button" testID="register-screen-login-link-button">
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="register-screen-login-link-label" testID="register-screen-login-link-label">
          ¿Ya tenés cuenta?{' '}
          <Text className="font-semibold text-primary" nativeID="register-screen-login-link-emphasis" testID="register-screen-login-link-emphasis">Iniciá sesión</Text>
        </Text>
      </Pressable>
    </AuthCardShell>
  );
}
```

- [ ] **Step 2: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 33/33.

- [ ] **Step 3: Verificar visualmente en preview**

Ir a `/register` — confirmar layout idéntico (card ancha en web, secciones colapsables, checklist de contraseña, back button). Completar el formulario y confirmar que el submit sigue funcionando (con `EXPO_PUBLIC_USE_MOCKS=true`).

- [ ] **Step 4: Commit**

```bash
git add components/auth/register-screen.jsx
git commit -m "refactor(auth): migrate register screen to AuthCardShell"
```

---

### Task 3: Extraer la UI de fuerza de contraseña

**Files:**
- Create: `components/forms/password-strength.jsx`
- Modify: `components/auth/register-screen.jsx`

**Interfaces:**
- Produces: `StrengthBar({ password })`, `PasswordRequirementsList({ reqs })` (usa internamente un `RequirementRow` privado, no exportado). Usado por `register-screen.jsx` (este task) y `ResetPasswordScreen` (Task 7).

Los `nativeID`/`testID` pasan de `register-screen-strength-bar`/`register-screen-requirement-*`/`register-screen-requirements-list` a `password-strength-*` — mismo criterio que `AuthCardShell` en Task 1 (el id refleja el componente real, no cambia nada visual).

- [ ] **Step 1: Crear `components/forms/password-strength.jsx`**

```jsx
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import {
  PASSWORD_REQUIREMENTS,
  getPasswordStrengthScore,
  getPasswordStrengthMeta,
} from '../../utils/password-validators.js';

// Barra de fuerza + checklist de requisitos de contraseña — compartido entre
// register-screen.jsx y reset-password-screen.jsx. Puramente presentacional,
// consume utils/password-validators.js. Extraído de register-screen.jsx (donde
// vivía local, sin exportar) con las mismas clases y lógica, ahora con
// nativeID/testID propios en vez de heredar el prefijo del screen que lo
// embebe.
export function StrengthBar({ password }) {
  const score = getPasswordStrengthScore(password);
  const total = PASSWORD_REQUIREMENTS.length;
  const pct = Math.round((score / total) * 100);
  const { label, color } = getPasswordStrengthMeta(score);

  return (
    <View className="mb-3 mt-2" nativeID="password-strength-bar" testID="password-strength-bar">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" nativeID="password-strength-bar-track" testID="password-strength-bar-track">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" nativeID="password-strength-bar-fill" testID="password-strength-bar-fill" />
      </View>
      {password.length > 0 && (
        <Text style={{ color }} className="mt-1 text-xs font-semibold" nativeID="password-strength-bar-label" testID="password-strength-bar-label">
          {label}
        </Text>
      )}
    </View>
  );
}

function RequirementRow({ id, met, label }) {
  const colors = useThemeColors();
  return (
    <View className="mb-1 flex-row items-center gap-2" nativeID={`password-strength-requirement-${id}`} testID={`password-strength-requirement-${id}`}>
      <MaterialCommunityIcons
        color={met ? '#8cc63e' : colors.onSurfaceVariant}
        name={met ? 'check-circle' : 'circle-outline'}
        size={14}
      />
      <Text className={`text-xs ${met ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`password-strength-requirement-${id}-label`} testID={`password-strength-requirement-${id}-label`}>
        {label}
      </Text>
    </View>
  );
}

// `reqs` es el resultado de checkPasswordRequirements(password).
export function PasswordRequirementsList({ reqs }) {
  return (
    <View className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900" nativeID="password-strength-requirements-list" testID="password-strength-requirements-list">
      {PASSWORD_REQUIREMENTS.map((req) => (
        <RequirementRow key={req.id} id={req.id} label={req.label} met={reqs[req.id]} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Editar `components/auth/register-screen.jsx`**

Quitar las funciones locales `StrengthBar` y `RequirementRow` (líneas 35-69 tras Task 2) por completo.

Reemplazar el bloque de imports:
```jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import {
  PASSWORD_REQUIREMENTS,
  PASSWORD_MAX_LENGTH,
  checkPasswordRequirements,
  isPasswordValid,
  getPasswordStrengthScore,
  getPasswordStrengthMeta,
} from '../../utils/password-validators.js';
import { validateBirthDate } from '../../utils/date-validators.js';
import { validateDNI } from '../../utils/dni-validators.js';
import { toRegisterPayload } from '../../services/normalizers.js';
import { useAuthStore } from '../../store/auth-store.js';
import { isWeb } from '../../utils/platform.js';
import { Row, Col, SelectField, DateField, InputField, PickerField } from '../forms/fields.jsx';
import { SectionCard } from '../forms/section-card.jsx';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { AuthCardShell } from './auth-card-shell.jsx';
```

Por:
```jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { PASSWORD_MAX_LENGTH, checkPasswordRequirements, isPasswordValid } from '../../utils/password-validators.js';
import { validateBirthDate } from '../../utils/date-validators.js';
import { validateDNI } from '../../utils/dni-validators.js';
import { toRegisterPayload } from '../../services/normalizers.js';
import { useAuthStore } from '../../store/auth-store.js';
import { isWeb } from '../../utils/platform.js';
import { Row, Col, SelectField, DateField, InputField, PickerField } from '../forms/fields.jsx';
import { SectionCard } from '../forms/section-card.jsx';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { AuthCardShell } from './auth-card-shell.jsx';
import { StrengthBar, PasswordRequirementsList } from '../forms/password-strength.jsx';
```

(`MaterialCommunityIcons` y `useThemeColors` ya no se usan en este archivo tras quitar `RequirementRow` — se eliminan del import. `PASSWORD_REQUIREMENTS`, `getPasswordStrengthScore`, `getPasswordStrengthMeta` tampoco se usan más acá directamente — se eliminan también.)

Reemplazar el bloque del checklist+barra dentro del `SectionCard` de "Contraseña":
```jsx
<View className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900" nativeID="register-screen-requirements-list" testID="register-screen-requirements-list">
  {PASSWORD_REQUIREMENTS.map((req) => (
    <RequirementRow key={req.id} id={req.id} label={req.label} met={passwordReqs[req.id]} />
  ))}
</View>

<StrengthBar password={password} />
```

Por:
```jsx
<PasswordRequirementsList reqs={passwordReqs} />
<StrengthBar password={password} />
```

El resto del archivo (todos los hooks de estado, `handleSubmit`, el resto del JSX) queda igual que en Task 2.

- [ ] **Step 3: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 33/33.

- [ ] **Step 4: Verificar visualmente en preview**

Ir a `/register`, abrir la sección "Contraseña", escribir algo en el campo — confirmar que el checklist y la barra de fuerza se ven y comportan exactamente igual que antes.

- [ ] **Step 5: Commit**

```bash
git add components/forms/password-strength.jsx components/auth/register-screen.jsx
git commit -m "refactor(forms): extract password strength UI into shared component"
```

---

### Task 4: Validador de código OTP

**Files:**
- Create: `utils/otp-validators.js`
- Create: `__tests__/otp-validators.test.js`

**Interfaces:**
- Produces: `validateOtpCode(code)` — `string` con el error, o `null` si es válido. Usado por `ResetPasswordScreen` (Task 7).

- [ ] **Step 1: Crear `utils/otp-validators.js`**

```js
export function validateOtpCode(code) {
  if (!code) return 'El código es requerido.';
  if (!/^\d{6}$/.test(code)) return 'El código debe tener 6 dígitos.';
  return null;
}
```

- [ ] **Step 2: Crear `__tests__/otp-validators.test.js`**

```js
import { validateOtpCode } from '../utils/otp-validators.js';

describe('validateOtpCode', () => {
  test('accepts a 6-digit code', () => {
    expect(validateOtpCode('123456')).toBeNull();
  });

  test('rejects empty', () => {
    expect(validateOtpCode('')).toBe('El código es requerido.');
  });

  test('rejects fewer than 6 digits', () => {
    expect(validateOtpCode('12345')).toBe('El código debe tener 6 dígitos.');
  });

  test('rejects more than 6 digits', () => {
    expect(validateOtpCode('1234567')).toBe('El código debe tener 6 dígitos.');
  });

  test('rejects non-numeric characters', () => {
    expect(validateOtpCode('12a456')).toBe('El código debe tener 6 dígitos.');
  });
});
```

- [ ] **Step 3: Correr los tests**

```bash
npm test -- --silent
```
Esperado: 38/38 (33 existentes + 5 nuevos).

- [ ] **Step 4: Verificar lint**

```bash
npm run lint
```
Esperado: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add utils/otp-validators.js __tests__/otp-validators.test.js
git commit -m "feat(auth): add OTP code validator"
```

---

### Task 5: Capa de servicio de recuperación de contraseña

**Files:**
- Create: `services/password.js`
- Create: `services/__mocks__/password-mock.js`

**Interfaces:**
- Produces: `forgotPassword(email)`, `resetPassword({ email, code, newPassword, confirmPassword })`. Usados por `ForgotPasswordScreen` (Task 6) y `ResetPasswordScreen` (Task 7).

Sin cambios a `store/auth-store.js` — este flujo no toca sesión ni usuario logueado.

- [ ] **Step 1: Crear `services/__mocks__/password-mock.js`**

```js
// Datos fake — no valida el código realmente, mismo criterio que el resto de
// los mocks del proyecto (no reimplementan lógica de negocio real).
export async function mockForgotPassword(_email) {
  return { message: 'Si el email está registrado, vas a recibir un código de recuperación.' };
}

export async function mockResetPassword(_payload) {
  return { message: 'Contraseña actualizada correctamente.' };
}
```

- [ ] **Step 2: Crear `services/password.js`**

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockForgotPassword, mockResetPassword } from './__mocks__/password-mock.js';

// POST /api/v1/auth/forgot-password — siempre responde el mismo mensaje
// genérico (no revela si el email existe). Envía un código OTP de 6 dígitos
// por mail si el email pertenece a un usuario activo.
export async function forgotPassword(email) {
  if (USE_MOCKS) return await mockForgotPassword(email);
  return await api.post('/auth/forgot-password', { email });
}

// POST /api/v1/auth/reset-password — el código vence a los 10 minutos.
export async function resetPassword({ email, code, newPassword, confirmPassword }) {
  if (USE_MOCKS) return await mockResetPassword({ email, code, newPassword, confirmPassword });
  return await api.post('/auth/reset-password', {
    email,
    code,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}
```

- [ ] **Step 3: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 38/38 (sin consumidores todavía, no hay nada nuevo que verificar en preview en este task).

- [ ] **Step 4: Commit**

```bash
git add services/password.js services/__mocks__/password-mock.js
git commit -m "feat(auth): add password recovery service layer"
```

---

### Task 6: `ForgotPasswordScreen`, ruta, y wiring desde login

**Files:**
- Create: `components/auth/forgot-password-screen.jsx`
- Create: `app/forgot-password.jsx`
- Modify: `app/_layout.jsx`
- Modify: `components/auth/login-screen.jsx`
- Delete: `components/auth/forgot-password-form.jsx`

**Interfaces:**
- Consumes: `AuthCardShell` (Task 1), `forgotPassword` (Task 5).
- Produces: ruta `/forgot-password`. Consumida por `login-screen.jsx` (este task) y por `ResetPasswordScreen` como destino de vuelta (Task 7, vía `router.back()`, sin acoplamiento directo).

Acá es donde el comportamiento de "olvidé mi contraseña" pasa de ser un toggle de estado local a una navegación real — el placeholder viejo se borra.

- [ ] **Step 1: Crear `components/auth/forgot-password-screen.jsx`**

```jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { InputField } from '../forms/fields.jsx';
import { AuthCardShell } from './auth-card-shell.jsx';
import { forgotPassword } from '../../services/password.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';

function validateEmail(value) {
  if (!value) return 'El email es requerido.';
  if (!validateEmailFormat(value)) return 'El formato del email no es válido.';
  if (isDisposableEmail(value)) return 'No se permiten emails temporales o de un solo uso.';
  return null;
}

export function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailError = touched ? validateEmail(email) : null;
  const canSubmit = !validateEmail(email);

  const handleSubmit = async () => {
    if (loading) return;
    setTouched(true);
    if (!canSubmit) return;

    setLoading(true);
    try {
      await forgotPassword(email);
      // El backend siempre responde el mismo mensaje genérico (no revela si
      // el email existe) — cualquier 200 se trata como éxito visual.
      router.push({ pathname: '/reset-password', params: { email } });
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardShell cardClassName="max-w-md p-8">
      <Text
        style={{ fontFamily: 'Orbitron_700Bold' }}
        className="mb-1 text-center text-2xl text-slate-900 dark:text-white"
        nativeID="forgot-password-screen-title"
        testID="forgot-password-screen-title"
      >
        Recuperar contraseña
      </Text>
      <Text
        className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400"
        nativeID="forgot-password-screen-subtitle"
        testID="forgot-password-screen-subtitle"
      >
        Ingresá tu email y te enviamos un código de 6 dígitos para restablecer tu contraseña.
      </Text>

      <InputField
        autoCapitalize="none"
        autoComplete="email"
        error={emailError}
        keyboardType="email-address"
        label="Email"
        onBlur={() => setTouched(true)}
        onChange={setEmail}
        placeholder="tu@email.com"
        returnKeyType="done"
        textContentType="emailAddress"
        touched={touched}
        value={email}
      />

      <Pressable
        className={`mt-2 h-12 items-center justify-center rounded-full ${canSubmit ? 'bg-primary hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
        disabled={loading}
        onPress={handleSubmit}
        nativeID="forgot-password-screen-submit-button"
        testID="forgot-password-screen-submit-button"
      >
        {loading ? (
          <ActivityIndicator color="#111518" size="small" />
        ) : (
          <Text
            className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'}`}
            nativeID="forgot-password-screen-submit-button-label"
            testID="forgot-password-screen-submit-button-label"
          >
            Enviar código
          </Text>
        )}
      </Pressable>
    </AuthCardShell>
  );
}
```

- [ ] **Step 2: Crear `app/forgot-password.jsx`**

```jsx
import { ForgotPasswordScreen } from '../components/auth/forgot-password-screen.jsx';

export default function ForgotPassword() {
  return <ForgotPasswordScreen />;
}
```

- [ ] **Step 3: Agregar el `Stack.Screen` en `app/_layout.jsx`**

Buscar:
```jsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
```

Reemplazar por:
```jsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
```

- [ ] **Step 4: Editar `components/auth/login-screen.jsx`**

Quitar el import de `ForgotPasswordForm` y agregar `useRouter`:

Buscar:
```jsx
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { useAuthStore } from '../../store/auth-store.js';
import { AuthCardShell } from './auth-card-shell.jsx';
import { ForgotPasswordForm } from './forgot-password-form.jsx';

// --- Login form ---

function LoginForm({ onForgotPassword }) {
```

Reemplazar por:
```jsx
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { useAuthStore } from '../../store/auth-store.js';
import { AuthCardShell } from './auth-card-shell.jsx';

// --- Login form ---

function LoginForm() {
  const router = useRouter();
```

(`useRouter` ya estaba importado a nivel de módulo; ahora se llama dentro de `LoginForm` también para el nuevo botón — `LoginForm` ya tenía su propio `const router = useRouter();` en la primera línea del cuerpo, así que este paso solo consiste en quitar el parámetro `{ onForgotPassword }` de la firma de la función.)

Buscar:
```jsx
      {/* Forgot password */}
      <Pressable className="items-center py-1 hover:opacity-70" onPress={onForgotPassword} nativeID="login-screen-forgot-password-button" testID="login-screen-forgot-password-button">
```

Reemplazar por:
```jsx
      {/* Forgot password */}
      <Pressable className="items-center py-1 hover:opacity-70" onPress={() => router.push('/forgot-password')} nativeID="login-screen-forgot-password-button" testID="login-screen-forgot-password-button">
```

Buscar:
```jsx
// --- Screen ---

export function LoginScreen() {
  const [view, setView] = useState('login'); // 'login' | 'forgot'

  return (
    <AuthCardShell cardClassName="max-w-md p-8">
      {view === 'login' ? (
        <LoginForm onForgotPassword={() => setView('forgot')} />
      ) : (
        <ForgotPasswordForm onBack={() => setView('login')} />
      )}
    </AuthCardShell>
  );
}
```

Reemplazar por:
```jsx
// --- Screen ---

export function LoginScreen() {
  return (
    <AuthCardShell cardClassName="max-w-md p-8">
      <LoginForm />
    </AuthCardShell>
  );
}
```

(`useState` ya no se usa a nivel de `LoginScreen`, pero sigue usándose dentro de `LoginForm` — el import de `useState` desde `'react'` se mantiene sin cambios.)

- [ ] **Step 5: Borrar el placeholder viejo**

```bash
git rm components/auth/forgot-password-form.jsx
```

- [ ] **Step 6: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 38/38.

- [ ] **Step 7: Verificar visualmente en preview**

Ir a `/login`, tocar "¿Olvidaste tu contraseña?" — confirmar que navega a `/forgot-password` (URL cambia, ya no es un toggle dentro de la misma card). Completar el email y enviar (con `EXPO_PUBLIC_USE_MOCKS=true`) — confirmar que navega a `/reset-password` (aunque esa pantalla no exista todavía hasta Task 7, así que esperar un error de ruta acá es esperado y correcto en este punto — se resuelve en el próximo task). Volver con el botón "Volver" — confirmar que aterriza en `/login`.

- [ ] **Step 8: Commit**

```bash
git add components/auth/forgot-password-screen.jsx app/forgot-password.jsx app/_layout.jsx components/auth/login-screen.jsx
git rm components/auth/forgot-password-form.jsx
git commit -m "feat(auth): add forgot-password screen, wire login to navigate"
```

---

### Task 7: `ResetPasswordScreen` y su ruta

**Files:**
- Create: `components/auth/reset-password-screen.jsx`
- Create: `app/reset-password.jsx`
- Modify: `app/_layout.jsx`

**Interfaces:**
- Consumes: `AuthCardShell` (Task 1), `StrengthBar`/`PasswordRequirementsList` (Task 3), `validateOtpCode` (Task 4), `forgotPassword`/`resetPassword` (Task 5).
- Produces: ruta `/reset-password`, cierra el flujo completo.

Con este task el flujo queda de punta a punta funcional.

- [ ] **Step 1: Crear `components/auth/reset-password-screen.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { InputField } from '../forms/fields.jsx';
import { AuthCardShell } from './auth-card-shell.jsx';
import { PasswordRequirementsList, StrengthBar } from '../forms/password-strength.jsx';
import { forgotPassword, resetPassword } from '../../services/password.js';
import { validateOtpCode } from '../../utils/otp-validators.js';
import { PASSWORD_MAX_LENGTH, checkPasswordRequirements, isPasswordValid } from '../../utils/password-validators.js';

export function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Deep-link directo a /reset-password sin pasar por /forgot-password (sin
  // email en los params) — no hay contexto para mostrar nada, se redirige.
  useEffect(() => {
    if (!email) router.replace('/forgot-password');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  if (!email) return null;

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const codeError = touched.code ? validateOtpCode(code) : null;
  const passwordReqs = checkPasswordRequirements(password);
  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = !validateOtpCode(code) && passwordValid && passwordsMatch;

  const handleSubmit = async () => {
    if (loading) return;
    touch('code');
    touch('password');
    touch('confirm');
    if (!canSubmit) return;

    setLoading(true);
    try {
      await resetPassword({ email, code, newPassword: password, confirmPassword });
      Toast.show({ type: 'success', text1: '¡Contraseña actualizada!', text2: 'Ya podés iniciar sesión.' });
      router.replace('/login');
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo restablecer la contraseña.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await forgotPassword(email);
      Toast.show({ type: 'success', text1: 'Código reenviado', text2: `Revisá ${email}.` });
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCardShell cardClassName="max-w-md p-8">
      <Text
        style={{ fontFamily: 'Orbitron_700Bold' }}
        className="mb-1 text-center text-2xl text-slate-900 dark:text-white"
        nativeID="reset-password-screen-title"
        testID="reset-password-screen-title"
      >
        Ingresá el código
      </Text>
      <Text
        className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400"
        nativeID="reset-password-screen-subtitle"
        testID="reset-password-screen-subtitle"
      >
        Te enviamos un código de 6 dígitos a {email}. Ingresalo junto con tu nueva contraseña. El código vence a los 10 minutos.
      </Text>

      <InputField
        autoCapitalize="none"
        error={codeError}
        keyboardType="number-pad"
        label="Código"
        onBlur={() => touch('code')}
        onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        returnKeyType="next"
        touched={touched.code}
        value={code}
      />

      <InputField
        autoComplete="new-password"
        label="Nueva contraseña"
        onBlur={() => touch('password')}
        onChange={(v) => { if (v.length <= PASSWORD_MAX_LENGTH) setPassword(v); }}
        onToggleSecure={() => setShowPassword((v) => !v)}
        placeholder="Tu nueva contraseña"
        returnKeyType="next"
        secureTextEntry={!showPassword}
        showSecure={showPassword}
        textContentType="newPassword"
        value={password}
      />

      <InputField
        autoComplete="new-password"
        error={touched.confirm && !passwordsMatch && confirmPassword.length > 0 ? 'Las contraseñas no coinciden.' : null}
        label="Confirmar contraseña"
        onBlur={() => touch('confirm')}
        onChange={setConfirmPassword}
        onToggleSecure={() => setShowConfirm((v) => !v)}
        placeholder="Repetí tu nueva contraseña"
        returnKeyType="done"
        secureTextEntry={!showConfirm}
        showSecure={showConfirm}
        textContentType="newPassword"
        value={confirmPassword}
      />

      <PasswordRequirementsList reqs={passwordReqs} />
      <StrengthBar password={password} />

      <Pressable
        className={`mt-8 h-12 items-center justify-center rounded-full ${canSubmit ? 'bg-primary hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
        disabled={loading}
        onPress={handleSubmit}
        nativeID="reset-password-screen-submit-button"
        testID="reset-password-screen-submit-button"
      >
        {loading ? (
          <ActivityIndicator color="#111518" size="small" />
        ) : (
          <Text
            className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'}`}
            nativeID="reset-password-screen-submit-button-label"
            testID="reset-password-screen-submit-button-label"
          >
            Restablecer contraseña
          </Text>
        )}
      </Pressable>

      <Pressable
        className="mt-6 items-center py-1 hover:opacity-70"
        disabled={resending}
        onPress={handleResend}
        nativeID="reset-password-screen-resend-button"
        testID="reset-password-screen-resend-button"
      >
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="reset-password-screen-resend-label" testID="reset-password-screen-resend-label">
          {resending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
        </Text>
      </Pressable>
    </AuthCardShell>
  );
}
```

- [ ] **Step 2: Crear `app/reset-password.jsx`**

```jsx
import { ResetPasswordScreen } from '../components/auth/reset-password-screen.jsx';

export default function ResetPassword() {
  return <ResetPasswordScreen />;
}
```

- [ ] **Step 3: Agregar el `Stack.Screen` en `app/_layout.jsx`**

Buscar:
```jsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
```

Reemplazar por:
```jsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
```

- [ ] **Step 4: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 38/38.

- [ ] **Step 5: Verificar visualmente en preview (flujo completo)**

Con `EXPO_PUBLIC_USE_MOCKS=true`:
1. `/login` → "¿Olvidaste tu contraseña?" → `/forgot-password`.
2. Ingresar un email válido → "Enviar código" → navega a `/reset-password` mostrando el email.
3. Ingresar un código de 6 dígitos (cualquiera, el mock no lo valida) + nueva contraseña que cumpla los requisitos + confirmación que coincida → checklist y barra de fuerza reaccionan en vivo → "Restablecer contraseña" habilitado → submit → toast de éxito → redirige a `/login`.
4. Repetir el paso 2-3 y tocar "¿No recibiste el código? Reenviar" — confirmar que dispara un toast de confirmación sin cambiar de pantalla.
5. Navegar directo a `/reset-password` sin pasar por `/forgot-password` (sin `email` en los params) — confirmar que redirige a `/forgot-password`.
6. Botón "Volver" desde `/reset-password` — confirmar que aterriza en `/forgot-password` (no directo a `/login`).

- [ ] **Step 6: Commit**

```bash
git add components/auth/reset-password-screen.jsx app/reset-password.jsx app/_layout.jsx
git commit -m "feat(auth): add reset-password screen, complete recovery flow"
```

---

## Verification (plan completo)

- `npm test` → 38/38 en todo momento desde Task 4 en adelante (33 previos + 5 de `otp-validators`).
- `npm run lint` → 0 errores en todo momento, incluye `nativeID`/`testID`.
- Preview web con `EXPO_PUBLIC_USE_MOCKS=true`: flujo completo descripto en el Step 5 del Task 7.
- Login y register deben verse y comportarse exactamente igual que antes de este plan (Tasks 1-3 son refactors sin cambio visual, solo de estructura interna y de nativeID/testID en elementos ya existentes).
