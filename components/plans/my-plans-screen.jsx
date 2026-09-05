import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus, getPlanDaysRemaining } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { TodaySessionHero } from './today-session-hero.jsx';

const STATUS_META = {
  activo: { label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  vencido: { label: 'Vencido', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

const MAX_CURRENT_PLANS = 2;

function MyPlanRow({ plan, isCurrent, atCurrentLimit, onPress, onToggleCurrent }) {
  const isNarrow = useIsNarrowWeb();
  const status = getPlanStatus(plan);
  const statusMeta = STATUS_META[status];
  const daysRemaining = getPlanDaysRemaining(plan);
  const trainingDaysCount = plan.days.filter((d) => d.kind === 'training').length;
  const idPrefix = `my-plan-row-${plan.id}`;
  // Vigencia reemplaza el label fijo ("Activo"/"Vencido") en vez de
  // sumarse — el color del badge ya comunica el estado, no hace falta
  // repetirlo en texto.
  const vigenciaLabel = status === 'activo' ? `Quedan ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}` : 'Venció';

  const icon = (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
      <MaterialCommunityIcons color="#8cc63e" name="clipboard-text-outline" size={18} />
    </View>
  );
  const info = (
    <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
        {plan.name}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-meta`} numberOfLines={1} testID={`${idPrefix}-meta`}>
        {trainingDaysCount} {trainingDaysCount === 1 ? 'sesión' : 'sesiones'} de entrenamiento
      </Text>
    </View>
  );
  const statusTag = (
    <View className={`shrink-0 rounded-full px-2.5 py-1 ${statusMeta.bg}`} nativeID={`${idPrefix}-status-tag`} testID={`${idPrefix}-status-tag`}>
      <Text className={`text-xs font-semibold ${statusMeta.text}`} nativeID={`${idPrefix}-status-tag-label`} numberOfLines={1} testID={`${idPrefix}-status-tag-label`}>
        {vigenciaLabel}
      </Text>
    </View>
  );
  const currentToggle = (
    <Pressable
      className={`rounded-lg p-1.5 ${isCurrent || !atCurrentLimit ? 'hover:bg-slate-200 active:opacity-70 dark:hover:bg-slate-800' : 'opacity-40'}`}
      nativeID={`${idPrefix}-current-toggle`}
      onPress={onToggleCurrent}
      testID={`${idPrefix}-current-toggle`}
    >
      <MaterialCommunityIcons color={isCurrent ? '#8cc63e' : '#94a3b8'} name={isCurrent ? 'star' : 'star-outline'} size={20} />
    </Pressable>
  );
  const chevron = <MaterialCommunityIcons color="#94a3b8" name="chevron-right" size={20} />;

  // Angosto: 5 elementos (ícono, info, badge, estrella, chevron) no
  // entran en una sola fila sin desbordar — badge + estrella pasan a una
  // 2da línea, alineados debajo del nombre (icon w-10 + gap-3 = 52px).
  // Ancho: todo en una sola fila, como antes.
  if (isNarrow) {
    return (
      <Pressable
        className="gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        nativeID={idPrefix}
        onPress={onPress}
        testID={idPrefix}
      >
        <View className="flex-row items-center gap-3" nativeID={`${idPrefix}-main-row`} testID={`${idPrefix}-main-row`}>
          {icon}
          {info}
          {chevron}
        </View>
        <View className="flex-row items-center gap-2 pl-[52px]" nativeID={`${idPrefix}-meta-row`} testID={`${idPrefix}-meta-row`}>
          {statusTag}
          {currentToggle}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      {icon}
      {info}
      {statusTag}
      {currentToggle}
      {chevron}
    </Pressable>
  );
}

// Sin dominio de planes de entrenamiento en el backend todavía (ver
// docs/BACKEND_API_GAPS.md gap 4). Solo lectura — pedido explícito del
// usuario: "el corredor solo podrá ver sus planes asignados y nada más,
// por ahora" (más marcar/desmarcar como actual, que es una preferencia
// propia, no una edición del plan — ver
// docs/superpowers/specs/2026-09-03-my-plans-today-session-design.md).
function MyPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const myPlans = useTrainingPlanStore((s) => s.myPlans);
  const myCurrentPlanIds = useTrainingPlanStore((s) => s.myCurrentPlanIds);
  const fetchMyPlans = useTrainingPlanStore((s) => s.fetchMyPlans);
  const markCurrentPlan = useTrainingPlanStore((s) => s.markCurrentPlan);
  const unmarkCurrentPlan = useTrainingPlanStore((s) => s.unmarkCurrentPlan);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyPlans(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const currentPlans = myCurrentPlanIds.map((id) => myPlans.find((p) => p.id === id)).filter(Boolean);
  const atCurrentLimit = myCurrentPlanIds.length >= MAX_CURRENT_PLANS;

  const handleToggleCurrent = async (planId, isCurrent) => {
    if (isCurrent) {
      await unmarkCurrentPlan(user.userId, planId);
      return;
    }
    if (atCurrentLimit) {
      Toast.show({ type: 'info', text1: 'Ya tenés 2 planes marcados como actuales', text2: 'Desmarcá uno primero.' });
      return;
    }
    const result = await markCurrentPlan(user.userId, planId);
    if (!result.success) Toast.show({ type: 'error', text1: 'No pudimos marcar el plan', text2: result.error });
  };

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

        {!loading && myPlans.length > 0 && (
          <View className="mb-8" nativeID="my-plans-today-hero" testID="my-plans-today-hero">
            <TodaySessionHero plans={currentPlans} />
          </View>
        )}

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
              {myPlans.map((plan) => {
                const isCurrent = myCurrentPlanIds.includes(plan.id);
                return (
                  <MyPlanRow
                    atCurrentLimit={atCurrentLimit}
                    isCurrent={isCurrent}
                    key={plan.id}
                    onPress={() => router.push(`/plans/${plan.id}`)}
                    onToggleCurrent={() => handleToggleCurrent(plan.id, isCurrent)}
                    plan={plan}
                  />
                );
              })}
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
