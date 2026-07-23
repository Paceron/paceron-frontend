import { ActivityIndicator, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';

// Se muestra mientras la sesión persistida todavía está hidratando (breve,
// pero real en web: localStorage se lee async). Evita un content vacío/blanco
// entre el primer pintado y que el store resuelva user/hydrated.
export function AppLoadingScreen() {
  const colors = useThemeColors();

  return (
    <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="app-loading-screen" testID="app-loading-screen">
      <ActivityIndicator color={colors.primary} size="small" />
    </View>
  );
}
