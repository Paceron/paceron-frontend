import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Sin dominio de planes de entrenamiento todavía (ver FUNCTIONAL_PROPOSE.md,
// "Planificación de entrenamientos" sigue siendo un módulo reservado) —
// mismo patrón "Próximamente" que TierUpgradeScreen. Acá va el corredor a
// ver los planes que le asignó su entrenador — pantalla distinta de
// TrainingPlansScreen (esa es la vista del entrenador armando planes),
// aunque hoy las dos muestren lo mismo.
function MyPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="my-plans-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="my-plans-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="my-plans-screen-container" testID="my-plans-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="my-plans-screen-header" testID="my-plans-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="my-plans-screen-back-button"
            onPress={() => router.back()}
            testID="my-plans-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="my-plans-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="my-plans-screen-title">
            Mis planes
          </Text>
        </View>

        <SectionCard icon="clipboard-text-outline" title="Tu plan de entrenamiento">
          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="my-plans-screen-description" testID="my-plans-screen-description">
            Acá vas a poder ver el plan de entrenamiento que te asignó tu entrenador — disponible próximamente.
          </Text>

          <View className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800" nativeID="my-plans-screen-coming-soon" testID="my-plans-screen-coming-soon">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="my-plans-screen-coming-soon-label" testID="my-plans-screen-coming-soon-label">
              Próximamente
            </Text>
          </View>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function MyPlansScreen() {
  return (
    <RequireAuth>
      <MyPlansScreenContent />
    </RequireAuth>
  );
}
