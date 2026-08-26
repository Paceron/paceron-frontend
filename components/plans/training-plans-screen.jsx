import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Sin dominio de planes de entrenamiento todavía (ver FUNCTIONAL_PROPOSE.md,
// "Planificación de entrenamientos" sigue siendo un módulo reservado) —
// mismo patrón "Próximamente" que TierUpgradeScreen. Acá va el entrenador a
// armar/gestionar planes para sus equipos — pantalla distinta de
// MyPlansScreen (esa es la vista del corredor viendo lo que le asignaron),
// aunque hoy las dos muestren lo mismo.
function TrainingPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="training-plans-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="training-plans-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="training-plans-screen-container" testID="training-plans-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="training-plans-screen-header" testID="training-plans-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="training-plans-screen-back-button"
            onPress={() => router.back()}
            testID="training-plans-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="training-plans-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="training-plans-screen-title">
            Planes de entrenamiento
          </Text>
        </View>

        <SectionCard icon="clipboard-list-outline" title="Planes de tus equipos">
          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="training-plans-screen-description" testID="training-plans-screen-description">
            Acá vas a poder armar y asignar planes de entrenamiento a tus corredores y grupos — disponible próximamente.
          </Text>

          <View className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800" nativeID="training-plans-screen-coming-soon" testID="training-plans-screen-coming-soon">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="training-plans-screen-coming-soon-label" testID="training-plans-screen-coming-soon-label">
              Próximamente
            </Text>
          </View>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function TrainingPlansScreen() {
  return (
    <RequireAuth>
      <TrainingPlansScreenContent />
    </RequireAuth>
  );
}
