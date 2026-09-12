import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Ex-hero de "sesión de hoy" — resolvía el día real contra
// plan.days[].dayOfWeek, campo que dejó de existir (planes pasaron a
// días numerados sin atarse a un día de semana real, ver
// docs/superpowers/specs/2026-09-10-training-plans-variable-duration-design.md).
// Hasta que un futuro sub-proyecto de calendario/asignación resuelva
// "qué día real es hoy" contra un plan-template, esta card muestra un
// estado fijo en vez de intentar (y no lograr) resolver un día.
export function TodaySessionCard({ plan }) {
  const router = useRouter();
  const colors = useThemeColors();
  const idPrefix = `today-session-card-${plan.id}`;

  return (
    <View className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center justify-between bg-primary-tint px-5 py-4 dark:bg-primary/15" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text
          className="flex-1 pr-3 text-lg text-slate-900 dark:text-white"
          nativeID={`${idPrefix}-plan-name`}
          numberOfLines={1}
          style={{ fontFamily: 'Orbitron_700Bold' }}
          testID={`${idPrefix}-plan-name`}
        >
          {plan.name}
        </Text>
        <View className="h-12 w-12 items-center justify-center rounded-full bg-white/60 dark:bg-black/20" nativeID={`${idPrefix}-header-icon`} testID={`${idPrefix}-header-icon`}>
          <MaterialCommunityIcons color={colors.primary} name="calendar-blank-outline" size={26} />
        </View>
      </View>

      <View className="items-center gap-2 p-5" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-blank-outline" size={40} />
        <Text className="text-center text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-no-calendar-title`} testID={`${idPrefix}-no-calendar-title`}>
          Todavía no tiene un calendario asignado
        </Text>
        <Text className="text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-no-calendar-copy`} testID={`${idPrefix}-no-calendar-copy`}>
          Pronto vas a poder ver acá el entrenamiento de cada día real.
        </Text>

        <Pressable
          className="mt-3 h-11 w-full flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
          nativeID={`${idPrefix}-view-plan-button`}
          onPress={() => router.push(`/plans/${plan.id}`)}
          testID={`${idPrefix}-view-plan-button`}
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-view-plan-label`} testID={`${idPrefix}-view-plan-label`}>
            Ver plan completo
          </Text>
          <MaterialCommunityIcons color="#111518" name="arrow-right" size={16} />
        </Pressable>
      </View>
    </View>
  );
}
