import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

const STATUS_META = {
  activo: { label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  vencido: { label: 'Vencido', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

function MyPlanRow({ plan, onPress }) {
  const status = getPlanStatus(plan);
  const statusMeta = STATUS_META[status];
  const trainingDaysCount = plan.days.filter((d) => d.kind === 'training').length;

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`my-plan-row-${plan.id}`}
      onPress={onPress}
      testID={`my-plan-row-${plan.id}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`my-plan-row-${plan.id}-icon`} testID={`my-plan-row-${plan.id}-icon`}>
        <MaterialCommunityIcons color="#8cc63e" name="clipboard-text-outline" size={18} />
      </View>
      <View className="flex-1" nativeID={`my-plan-row-${plan.id}-info`} testID={`my-plan-row-${plan.id}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`my-plan-row-${plan.id}-name`} numberOfLines={1} testID={`my-plan-row-${plan.id}-name`}>
          {plan.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`my-plan-row-${plan.id}-meta`} testID={`my-plan-row-${plan.id}-meta`}>
          {trainingDaysCount} {trainingDaysCount === 1 ? 'sesión' : 'sesiones'} de entrenamiento · caduca a los {plan.durationDays} días
        </Text>
      </View>
      <View className={`rounded-full px-2.5 py-1 ${statusMeta.bg}`} nativeID={`my-plan-row-${plan.id}-status-tag`} testID={`my-plan-row-${plan.id}-status-tag`}>
        <Text className={`text-xs font-semibold ${statusMeta.text}`} nativeID={`my-plan-row-${plan.id}-status-tag-label`} testID={`my-plan-row-${plan.id}-status-tag-label`}>
          {statusMeta.label}
        </Text>
      </View>
      <MaterialCommunityIcons color="#94a3b8" name="chevron-right" size={20} />
    </Pressable>
  );
}

// Sin dominio de planes de entrenamiento en el backend todavía (ver
// docs/BACKEND_API_GAPS.md gap 4). Solo lectura — pedido explícito del
// usuario: "el corredor solo podrá ver sus planes asignados y nada más,
// por ahora". Ver docs/superpowers/specs/2026-08-26-training-plans-design.md.
function MyPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const myPlans = useTrainingPlanStore((s) => s.myPlans);
  const fetchMyPlans = useTrainingPlanStore((s) => s.fetchMyPlans);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyPlans(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

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

        <SectionCard icon="clipboard-text-outline" title="Tus planes asignados">
          {loading ? (
            <View className="items-center py-6" nativeID="my-plans-loading" testID="my-plans-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : myPlans.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="my-plans-empty" testID="my-plans-empty">
              Todavía no tenés ningún plan de entrenamiento asignado.
            </Text>
          ) : (
            <View className="gap-2" nativeID="my-plans-list" testID="my-plans-list">
              {myPlans.map((plan) => (
                <MyPlanRow key={plan.id} onPress={() => router.push(`/plans/${plan.id}`)} plan={plan} />
              ))}
            </View>
          )}
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
