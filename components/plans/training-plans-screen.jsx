import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { SessionsCatalogTab } from './sessions-catalog-tab.jsx';
import { ExercisesCatalogTab } from './exercises-catalog-tab.jsx';

// Planes / Sesiones / Ejercicios — a diferencia de TeamDetailScreen
// (pestañas solo en web), acá van en ambas plataformas: cada pestaña es
// un catálogo independiente que puede crecer, apilar los 3 en mobile
// sería un scroll larguísimo. Ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md.
const TABS = [
  { id: 'planes', label: 'Planes', icon: 'clipboard-text-outline' },
  { id: 'sesiones', label: 'Sesiones', icon: 'clipboard-plus-outline' },
  { id: 'ejercicios', label: 'Ejercicios', icon: 'dumbbell' },
];

function PlanRow({ plan, onPress }) {
  const trainingDaysCount = plan.days.filter((d) => d.kind === 'training').length;

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`training-plan-row-${plan.id}`}
      onPress={onPress}
      testID={`training-plan-row-${plan.id}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`training-plan-row-${plan.id}-icon`} testID={`training-plan-row-${plan.id}-icon`}>
        <MaterialCommunityIcons color="#8cc63e" name="clipboard-text-outline" size={18} />
      </View>
      <View className="flex-1" nativeID={`training-plan-row-${plan.id}-info`} testID={`training-plan-row-${plan.id}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`training-plan-row-${plan.id}-name`} numberOfLines={1} testID={`training-plan-row-${plan.id}-name`}>
          {plan.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`training-plan-row-${plan.id}-meta`} testID={`training-plan-row-${plan.id}-meta`}>
          {plan.days.length} días · {trainingDaysCount} {trainingDaysCount === 1 ? 'sesión' : 'sesiones'} de entrenamiento
        </Text>
      </View>
      <MaterialCommunityIcons color="#94a3b8" name="chevron-right" size={20} />
    </Pressable>
  );
}

function PlansTab() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const plans = useTrainingPlanStore((s) => s.plans);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchPlans(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  return (
    <SectionCard
      headerRight={(
        <Pressable
          className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
          nativeID="training-plans-create-button"
          onPress={() => router.push('/training-plans/create')}
          testID="training-plans-create-button"
        >
          <Text className="text-sm font-semibold text-primary" nativeID="training-plans-create-button-label" testID="training-plans-create-button-label">
            Crear plan
          </Text>
        </Pressable>
      )}
      icon="clipboard-text-outline"
      title="Tus planes"
    >
      {loading ? (
        <View className="gap-2" nativeID="training-plans-loading" testID="training-plans-loading">
          {[0, 1, 2].map((i) => <SkeletonBlock height={48} key={i} nativeID={`training-plans-loading-row-${i}`} testID={`training-plans-loading-row-${i}`} width="100%" />)}
        </View>
      ) : plans.length === 0 ? (
        <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="training-plans-empty" testID="training-plans-empty">
          Todavía no creaste ningún plan de entrenamiento.
        </Text>
      ) : (
        <View className="gap-2" nativeID="training-plans-list" testID="training-plans-list">
          {plans.map((plan) => (
            <PlanRow key={plan.id} onPress={() => router.push(`/training-plans/${plan.id}`)} plan={plan} />
          ))}
        </View>
      )}
    </SectionCard>
  );
}

function TrainingPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState('planes');
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    if (!user?.userId) return Promise.resolve();
    return Promise.all([
      fetchPlans(user.userId),
      queryClient.invalidateQueries({ queryKey: ['exercises', user.userId] }),
      queryClient.invalidateQueries({ queryKey: ['sessions', user.userId] }),
    ]);
  });

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="training-plans-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
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

        <TabBar active={activeTab} onChange={setActiveTab} scope="training-plans-tab-bar" tabs={TABS} />

        {activeTab === 'planes' && <PlansTab />}
        {activeTab === 'sesiones' && <SessionsCatalogTab />}
        {activeTab === 'ejercicios' && <ExercisesCatalogTab />}
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
