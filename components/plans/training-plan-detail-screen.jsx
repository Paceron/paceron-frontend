import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus, dayLabel } from '../../store/training-plan-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { DeleteTrainingPlanModal } from './delete-training-plan-modal.jsx';
import { EXERCISE_KIND_META, DAY_KIND_META } from './exercise-kind-meta.js';

const STATUS_META = {
  activo: { label: 'Activo', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  vencido: { label: 'Vencido', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

// Fila de ejercicio individual, "al estilo gimnasio" — ícono + color por
// tipo (EXERCISE_KIND_META), nombre, y el dato que importa (minutos,
// distancia, velocidad). `repeatCount` > 1 es una serie: se antepone
// "N ×" al nombre y se suma el descanso entre repeticiones.
function ExerciseRow({ idPrefix, roleLabel, exercise, repeatCount = 1, restMinutes = 0 }) {
  if (!exercise) return null;
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const statParts = [];
  if (exercise.minutes != null) statParts.push(`${exercise.minutes} min`);
  if (exercise.distanceM != null) statParts.push(`${exercise.distanceM} m`);
  if (exercise.speedKph != null) statParts.push(`${exercise.speedKph} km/h`);
  if (repeatCount > 1) statParts.push(`descanso ${restMinutes} min entre series`);

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={18} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-role`} testID={`${idPrefix}-role`}>
          {roleLabel}
        </Text>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {repeatCount > 1 ? `${repeatCount} × ` : ''}{exercise.name}
        </Text>
        {statParts.length > 0 && (
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} testID={`${idPrefix}-stat`}>
            {statParts.join(' · ')}
          </Text>
        )}
      </View>
    </View>
  );
}

// Un día se despliega al tocarlo — pedido explícito del usuario: "cuando
// hagas click en el div del plan se desplieguen cada uno de los
// ejercicios individualmente, al estilo de cuando ves los ejercicios de
// una sesión en un gimnasio". Colapsado muestra el tipo de día (con su
// color/ícono, DAY_KIND_META) y, si es un día de entrenamiento, el
// nombre de la sesión; expandido muestra warmup/principal/vuelta a la
// calma como filas propias (ExerciseRow). Solo un día de entrenamiento
// con sesión resuelta tiene algo para desplegar — los demás no muestran
// chevron ni responden al toque.
function DayRow({ day, session, exercisesById }) {
  const [expanded, setExpanded] = useState(false);
  const idPrefix = `plan-detail-day-${day.sequenceNo}`;
  const kindMeta = DAY_KIND_META[day.kind] ?? DAY_KIND_META.rest;
  const canExpand = day.kind === 'training' && Boolean(session);

  const header = (
    <View className="flex-1 flex-row items-center gap-3" nativeID={`${idPrefix}-header-content`} testID={`${idPrefix}-header-content`}>
      <View className={`h-9 w-9 items-center justify-center rounded-full ${kindMeta.bg}`} nativeID={`${idPrefix}-kind-icon`} testID={`${idPrefix}-kind-icon`}>
        <MaterialCommunityIcons color={kindMeta.iconColor} name={kindMeta.icon} size={16} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-label-group`} testID={`${idPrefix}-label-group`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {dayLabel(day.dayOfWeek)}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-subtitle`} testID={`${idPrefix}-subtitle`}>
          {day.kind === 'other' ? day.otherName : day.kind === 'training' ? (session?.name ?? 'Sesión no encontrada') : kindMeta.label}
        </Text>
      </View>
    </View>
  );

  if (!canExpand) {
    return (
      <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
        {header}
      </View>
    );
  }

  const warmupExercise = exercisesById.get(session.warmupExerciseId);
  const mainExercise = exercisesById.get(session.mainExerciseId);
  const cooldownExercise = exercisesById.get(session.cooldownExerciseId);

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <Pressable
        accessibilityLabel={expanded ? 'Ocultar ejercicios de la sesión' : 'Ver ejercicios de la sesión'}
        className="flex-row items-center gap-2 px-4 py-3 active:opacity-80"
        nativeID={`${idPrefix}-toggle`}
        onPress={() => setExpanded((v) => !v)}
        testID={`${idPrefix}-toggle`}
      >
        {header}
        <MaterialCommunityIcons color="#94a3b8" name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>

      {expanded && (
        <View className="gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700" nativeID={`${idPrefix}-exercises`} testID={`${idPrefix}-exercises`}>
          <ExerciseRow exercise={warmupExercise} idPrefix={`${idPrefix}-warmup`} roleLabel="Entrada en calor" />
          <ExerciseRow exercise={mainExercise} idPrefix={`${idPrefix}-main`} repeatCount={session.mainRepeatCount} restMinutes={session.mainRestMinutes} roleLabel="Principal" />
          <ExerciseRow exercise={cooldownExercise} idPrefix={`${idPrefix}-cooldown`} roleLabel="Vuelta a la calma" />
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
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const exercises = useExerciseStore((s) => s.exercises);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);

  const [loading, setLoading] = useState(!plan);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Sesiones/ejercicios son del catálogo de QUIEN CREÓ el plan
  // (plan.ownerId) — no del usuario que está mirando la pantalla, que
  // puede ser un corredor viendo un plan que no es suyo.
  useEffect(() => {
    if (!plan?.ownerId) return;
    fetchSessions(plan.ownerId);
    fetchExercises(plan.ownerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.ownerId]);

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
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));

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
              <DayRow
                day={day}
                exercisesById={exercisesById}
                key={day.sequenceNo}
                session={sessions.find((s) => s.id === day.sessionId)}
              />
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
