import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { validateEmailFormat, isDisposableEmail } from '../../utils/email-validators.js';
import { useAuthStore } from '../../store/auth-store.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
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
      <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="mb-2 text-2xl text-slate-900 dark:text-white">Iniciar sesión</Text>
      <Text className="mb-8 text-sm text-slate-500 dark:text-slate-400">
        Ingresá tus credenciales para acceder a Paceron.
      </Text>

      {/* Email */}
      <View className="mb-5">
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">Email</Text>
        <View className={`h-12 flex-row items-center rounded-xl border ${
          emailError
            ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
            : emailOk
            ? 'border-primary bg-white dark:bg-slate-900'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
        }`}>
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
          />
          {emailTouched && (
            <View className="px-3">
              {emailError
                ? <MaterialCommunityIcons color="#ef4444" name="alert-circle-outline" size={18} />
                : <MaterialCommunityIcons color="#8cc63e" name="check-circle-outline" size={18} />
              }
            </View>
          )}
        </View>
        <View className="h-5">
          {emailError && <Text className="text-xs text-red-500 dark:text-red-400">{emailError}</Text>}
        </View>
      </View>

      {/* Password */}
      <View className="mb-6">
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">Contraseña</Text>
        <View className="h-12 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
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
          />
          <Pressable className="rounded-lg px-3 hover:bg-slate-100 dark:hover:bg-slate-800" onPress={() => setShowPassword((v) => !v)}>
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
      >
        {loading ? (
          <ActivityIndicator color={isFormValid ? '#111518' : colors.onSurfaceVariant} size="small" />
        ) : (
          <Text className={`text-sm font-semibold uppercase tracking-wide ${
            isFormValid ? 'text-[#111518]' : 'text-slate-400 dark:text-slate-500'
          }`}>
            Ingresar
          </Text>
        )}
      </Pressable>

      {/* Forgot password */}
      <Pressable className="items-center py-1 hover:opacity-70" onPress={onForgotPassword}>
        <Text className="text-sm text-slate-500 dark:text-slate-400">
          ¿Olvidaste tu contraseña?
        </Text>
      </Pressable>

      {/* Register link */}
      <Pressable className="items-center py-1 hover:opacity-70" onPress={() => router.push('/register')}>
        <Text className="text-sm text-slate-500 dark:text-slate-400">
          ¿No tenés cuenta?{' '}
          <Text className="font-semibold text-primary">Registrate</Text>
        </Text>
      </Pressable>
    </>
  );
}

// --- Screen ---

export function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [view, setView] = useState('login'); // 'login' | 'forgot'

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
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
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={24}
      >
        <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }, animatedStyle]}>
            {/* Card */}
            <View className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-surface">
              {/* Back button */}
              <Pressable
                className="-ml-2 mb-4 flex-row items-center gap-1.5 self-start rounded-lg px-2 py-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
                onPress={view === 'forgot' ? () => setView('login') : handleBack}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={16} />
                <Text className="text-sm text-slate-600 dark:text-slate-300">Volver</Text>
              </Pressable>

              {/* Logo */}
              <View className="mb-8 items-center">
                <Image
                  resizeMode="contain"
                  source={require('../../assets/paceron-symbol-transparent.png')}
                  style={{ width: 48, height: 48 }}
                />
                <PaceronBrand size={16} style={{ marginTop: 8 }} />
              </View>

              {view === 'login' ? (
                <LoginForm onForgotPassword={() => setView('forgot')} />
              ) : (
                <ForgotPasswordForm onBack={() => setView('login')} />
              )}
            </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
