import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus, dayLabel } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { DeleteTrainingPlanModal } from './delete-training-plan-modal.jsx';

const DAY_KIND_LABELS = { rest: 'Descanso', marathon: 'Maratón', other: 'Otra actividad', training: 'Entrenamiento' };
const WARMCOOL_LABELS = { walking: 'Caminata', jogging: 'Trote suave', elongation: 'Elongación' };
const MAIN_LABELS = { cruising: 'Ritmo continuo', walking: 'Caminata', jogging: 'Trote suave', set: 'Serie' };
const SET_LABELS = { walking: 'Caminata', jogging: 'Trote suave', running: 'Corrida' };

const STATUS_META = {
  activo: { label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  vencido: { label: 'Vencido', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

function describeWarmcool(block) {
  if (!block) return '—';
  if (block.kind === 'elongation') return WARMCOOL_LABELS.elongation;
  return `${WARMCOOL_LABELS[block.kind] ?? block.kind} · ${block.minutes ?? '—'} min`;
}

function describeSet(set) {
  if (!set) return '—';
  const detail = set.kind === 'running'
    ? `${SET_LABELS.running} · ${set.distanceM ?? '—'} m a ${set.speedKph ?? '—'} km/h`
    : `${SET_LABELS[set.kind] ?? set.kind} · ${set.minutes ?? '—'} min`;
  return `${set.repeatCount ?? '—'} × (${detail}), descanso ${set.restMinutes ?? '—'} min`;
}

function describeMain(block) {
  if (!block) return '—';
  if (block.kind === 'cruising') return `${MAIN_LABELS.cruising} · ${block.distanceM ?? '—'} m`;
  if (block.kind === 'set') return `${MAIN_LABELS.set}: ${describeSet(block.set)}`;
  return `${MAIN_LABELS[block.kind] ?? block.kind} · ${block.minutes ?? '—'} min`;
}

function DayRow({ day }) {
  const idPrefix = `plan-detail-day-${day.sequenceNo}`;
  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className="mb-1 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {dayLabel(day.dayOfWeek)}
        </Text>
        <View className="rounded-full bg-slate-200 px-2.5 py-1 dark:bg-slate-800" nativeID={`${idPrefix}-kind-tag`} testID={`${idPrefix}-kind-tag`}>
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-kind-tag-label`} testID={`${idPrefix}-kind-tag-label`}>
            {DAY_KIND_LABELS[day.kind] ?? day.kind}
          </Text>
        </View>
      </View>

      {day.kind === 'other' && (
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-other-name`} testID={`${idPrefix}-other-name`}>
          {day.otherName}
        </Text>
      )}

      {day.kind === 'training' && day.session && (
        <View className="gap-0.5" nativeID={`${idPrefix}-session`} testID={`${idPrefix}-session`}>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-warmup`} testID={`${idPrefix}-warmup`}>
            Entrada en calor: {describeWarmcool(day.session.warmup)}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-main`} testID={`${idPrefix}-main`}>
            Principal: {describeMain(day.session.main)}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-cooldown`} testID={`${idPrefix}-cooldown`}>
            Vuelta a la calma: {describeWarmcool(day.session.cooldown)}
          </Text>
        </View>
      )}
    </View>
  );
}

function TrainingPlanDetailScreenContent({ planId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const plan = useTrainingPlanStore((s) => s.plans.find((p) => p.id === planId) ?? s.myPlans.find((p) => p.id === planId));
  const fetchPlan = useTrainingPlanStore((s) => s.fetchPlan);
  const deletePlan = useTrainingPlanStore((s) => s.deletePlan);
  const clonePlan = useTrainingPlanStore((s) => s.clonePlan);

  const [loading, setLoading] = useState(!plan);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (plan) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchPlan(planId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="training-plan-detail-loading" testID="training-plan-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="training-plan-detail-not-found" testID="training-plan-detail-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="training-plan-detail-not-found-label" testID="training-plan-detail-not-found-label">
          No encontramos este plan.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="training-plan-detail-not-found-back-button"
          onPress={() => router.back()}
          testID="training-plan-detail-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="training-plan-detail-not-found-back-button-label" testID="training-plan-detail-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  // Mismo criterio que canDeleteTeam en equipos — sin modelo de
  // "administra este plan" más allá de ser el dueño y estar viendo la app
  // como entrenador ahora mismo.
  const canManage = activeRole === 'trainer' && plan.ownerId === user?.userId;
  const status = getPlanStatus(plan);
  const statusMeta = STATUS_META[status];

  const handleClone = async () => {
    if (cloning) return;
    setCloning(true);
    const result = await clonePlan(planId);
    setCloning(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos clonar el plan', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Plan clonado' });
    router.push(`/training-plans/${result.plan.id}`);
  };

  const handleDelete = async () => {
    const result = await deletePlan(planId);
    setDeleteModalVisible(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar el plan', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Plan eliminado' });
    router.back();
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="training-plan-detail-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="training-plan-detail-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="training-plan-detail-screen-container" testID="training-plan-detail-screen-container">
        <Pressable
          className="mb-6 flex-row items-center gap-1.5 self-start py-1 pr-1 hover:opacity-70 active:opacity-70"
          nativeID="training-plan-detail-back-button"
          onPress={() => router.back()}
          testID="training-plan-detail-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="training-plan-detail-back-button-label" testID="training-plan-detail-back-button-label">
            Volver
          </Text>
        </Pressable>

        <View className="mb-5 flex-row items-start justify-between gap-2" nativeID="training-plan-detail-header" testID="training-plan-detail-header">
          <View className="flex-1" nativeID="training-plan-detail-header-info" testID="training-plan-detail-header-info">
            <View className="mb-1 flex-row flex-wrap items-center gap-2" nativeID="training-plan-detail-title-row" testID="training-plan-detail-title-row">
              <Text className="text-xl text-slate-900 dark:text-white" nativeID="training-plan-detail-name" style={{ fontFamily: 'Orbitron_700Bold' }} testID="training-plan-detail-name">
                {plan.name}
              </Text>
              <View className={`rounded-full px-2.5 py-1 ${statusMeta.bg}`} nativeID="training-plan-detail-status-tag" testID="training-plan-detail-status-tag">
                <Text className={`text-xs font-semibold ${statusMeta.text}`} nativeID="training-plan-detail-status-tag-label" testID="training-plan-detail-status-tag-label">
                  {statusMeta.label}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="training-plan-detail-duration" testID="training-plan-detail-duration">
              Caduca a los {plan.durationDays} días
            </Text>
          </View>
        </View>

        {canManage && (
          <View className="mb-5 flex-row flex-wrap gap-2" nativeID="training-plan-detail-actions" testID="training-plan-detail-actions">
            <Pressable
              className="flex-row items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="training-plan-detail-edit-button"
              onPress={() => router.push(`/training-plans/${planId}/edit`)}
              testID="training-plan-detail-edit-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={16} />
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="training-plan-detail-edit-button-label" testID="training-plan-detail-edit-button-label">Editar</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="training-plan-detail-assign-button"
              onPress={() => router.push(`/training-plans/${planId}/assign`)}
              testID="training-plan-detail-assign-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-arrow-right-outline" size={16} />
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="training-plan-detail-assign-button-label" testID="training-plan-detail-assign-button-label">Asignar</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60"
              disabled={cloning}
              nativeID="training-plan-detail-clone-button"
              onPress={handleClone}
              testID="training-plan-detail-clone-button"
            >
              {cloning ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="content-copy" size={16} />}
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="training-plan-detail-clone-button-label" testID="training-plan-detail-clone-button-label">Clonar</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 hover:bg-red-50 active:opacity-70 dark:border-red-900/50 dark:hover:bg-red-900/20"
              nativeID="training-plan-detail-delete-button"
              onPress={() => setDeleteModalVisible(true)}
              testID="training-plan-detail-delete-button"
            >
              <MaterialCommunityIcons color={colors.error} name="trash-can-outline" size={16} />
              <Text className="text-sm font-semibold text-red-600 dark:text-red-400" nativeID="training-plan-detail-delete-button-label" testID="training-plan-detail-delete-button-label">Borrar</Text>
            </Pressable>
          </View>
        )}

        <SectionCard icon="information-outline" title="Sobre el plan">
          <Text className="text-sm leading-5 text-slate-700 dark:text-slate-200" nativeID="training-plan-detail-description" testID="training-plan-detail-description">
            {plan.description?.trim() ? plan.description : 'Sin descripción.'}
          </Text>
        </SectionCard>

        <SectionCard icon="calendar-week" title="Los 7 días de la semana">
          <View className="gap-2" nativeID="training-plan-detail-days-list" testID="training-plan-detail-days-list">
            {plan.days.map((day) => (
              <DayRow day={day} key={day.sequenceNo} />
            ))}
          </View>
        </SectionCard>
      </View>

      <DeleteTrainingPlanModal
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDelete}
        planName={plan.name}
        visible={deleteModalVisible}
      />
    </ScrollView>
  );
}

export function TrainingPlanDetailScreen({ planId }) {
  return (
    <RequireAuth>
      <TrainingPlanDetailScreenContent planId={planId} />
    </RequireAuth>
  );
}
