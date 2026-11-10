import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { useAuthStore } from '../../store/auth-store.js';
import { AuthCardShell } from './auth-card-shell.jsx';
import { AuthField } from './auth-field.jsx';

// --- Login form ---

function LoginForm() {
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
      <AuthField
        autoCapitalize="none"
        autoComplete="email"
        error={emailError}
        idPrefix="login-screen-email"
        keyboardType="email-address"
        label="Email"
        onBlur={handleEmailBlur}
        onChangeText={handleEmailChange}
        onSubmitEditing={() => {}}
        returnKeyType="next"
        success={emailOk}
        textContentType="emailAddress"
        value={email}
        trailing={emailTouched && (
          <View className="px-3" nativeID="login-screen-email-status-icon-wrapper" testID="login-screen-email-status-icon-wrapper">
            {emailError
              ? <MaterialCommunityIcons color="#ef4444" name="alert-circle-outline" size={18} />
              : <MaterialCommunityIcons color="#8cc63e" name="check-circle-outline" size={18} />
            }
          </View>
        )}
      />

      {/* Password */}
      <AuthField
        autoComplete="password"
        idPrefix="login-screen-password"
        label="Contraseña"
        onChangeText={handlePasswordChange}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        secureTextEntry={!showPassword}
        textContentType="password"
        value={password}
        className="mb-6"
        trailing={
          <Pressable className="rounded-lg px-3 hover:bg-slate-100 dark:hover:bg-slate-800" onPress={() => setShowPassword((v) => !v)} nativeID="login-screen-password-toggle-button" testID="login-screen-password-toggle-button">
            <MaterialCommunityIcons
              color={colors.onSurfaceVariant}
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
            />
          </Pressable>
        }
      />

      {/* Lo que sigue se desliza solo cuando un campo de arriba crece por un
          error (AuthField ya anima su propio layout) — este wrapper hace que
          el conjunto de abajo también se reacomode animado, en vez de saltar. */}
      <Animated.View layout={LinearTransition.duration(200)} nativeID="login-screen-actions" testID="login-screen-actions">
        {/* Submit button */}
        <Pressable
          className={`mb-4 h-12 items-center justify-center rounded-full hover:opacity-90 active:opacity-80 ${
            isFormValid ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'
          }`}
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
        <Pressable className="items-center py-1 hover:opacity-70" onPress={() => router.push('/forgot-password')} nativeID="login-screen-forgot-password-button" testID="login-screen-forgot-password-button">
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
      </Animated.View>
    </>
  );
}

// --- Screen ---

export function LoginScreen() {
  return (
    <AuthCardShell cardClassName="max-w-md p-8">
      <LoginForm />
    </AuthCardShell>
  );
}
