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
