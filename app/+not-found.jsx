import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/colors.js';
import { PaceronBrand } from '../components/brand/paceron-brand.jsx';

export default function NotFoundScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" edges={['top', 'bottom']} nativeID="not-found-screen" testID="not-found-screen">
      <PaceronBrand size={16} style={{ marginBottom: 24 }} />

      <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID="not-found-screen-icon-wrapper" testID="not-found-screen-icon-wrapper">
        <MaterialCommunityIcons color={colors.primary} name="map-marker-question-outline" size={32} />
      </View>

      <Text className="mb-2 text-center text-xl font-bold text-slate-900 dark:text-white" nativeID="not-found-screen-title" testID="not-found-screen-title">Página no encontrada</Text>
      <Text className="mb-8 max-w-sm text-center text-sm leading-5 text-slate-500 dark:text-slate-400" nativeID="not-found-screen-subtitle" testID="not-found-screen-subtitle">
        La ruta que buscás no existe o cambió de lugar.
      </Text>

      <Pressable
        className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
        nativeID="not-found-screen-home-button"
        onPress={() => router.replace('/')}
        testID="not-found-screen-home-button"
      >
        <MaterialCommunityIcons color={colors.onPrimary} name="home-outline" size={16} />
        <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="not-found-screen-home-button-label" testID="not-found-screen-home-button-label">Volver al inicio</Text>
      </Pressable>
    </SafeAreaView>
  );
}
