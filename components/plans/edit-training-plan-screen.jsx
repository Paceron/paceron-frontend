import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useTrainingPlanStore, PLAN_DURATION_OPTIONS } from '../../store/training-plan-store.js';
import { useTrainingPlanForm } from '../../hooks/use-training-plan-form.js';
import { TrainingPlanFormFields } from './training-plan-form-fields.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Separado en dos componentes (igual que EditTeamScreen): este resuelve
// loading/not-found — el plan puede no estar todavía en el store si se
// entra por deep-link — y EditTrainingPlanForm, que recién se monta con
// un `plan` ya garantizado (useTrainingPlanForm solo toma el valor
// inicial una vez, si se llamara con un plan inicialmente undefined el
// formulario quedaría vacío para siempre).
function EditTrainingPlanScreenContent({ planId }) {
  const colors = useThemeColors();
  const router = useRouter();
  const plan = useTrainingPlanStore((s) => s.plans.find((p) => p.id === planId));
  const fetchPlan = useTrainingPlanStore((s) => s.fetchPlan);
  const [loading, setLoading] = useState(!plan);

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
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="edit-training-plan-loading" testID="edit-training-plan-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="edit-training-plan-not-found" testID="edit-training-plan-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="edit-training-plan-not-found-label" testID="edit-training-plan-not-found-label">
          No encontramos este plan.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="edit-training-plan-not-found-back-button"
          onPress={() => router.back()}
          testID="edit-training-plan-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-training-plan-not-found-back-button-label" testID="edit-training-plan-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return <EditTrainingPlanForm plan={plan} planId={planId} />;
}

function EditTrainingPlanForm({ plan, planId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const updatePlan = useTrainingPlanStore((s) => s.updatePlan);

  const form = useTrainingPlanForm({ initial: plan });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.validate()) return;
    setSubmitting(true);
    const result = await updatePlan(planId, form.getValues());
    setSubmitting(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos guardar los cambios', text2: result.error });
      return;
    }

    Toast.show({ type: 'success', text1: 'Plan actualizado' });
    router.replace(`/training-plans/${planId}`);
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="edit-training-plan-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="edit-training-plan-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="edit-training-plan-screen-container" testID="edit-training-plan-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="edit-training-plan-screen-header" testID="edit-training-plan-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="edit-training-plan-screen-back-button"
            onPress={() => router.back()}
            testID="edit-training-plan-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="edit-training-plan-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="edit-training-plan-screen-title">
            Editar plan
          </Text>
        </View>

        <TrainingPlanFormFields durationOptions={PLAN_DURATION_OPTIONS} form={form} />

        <Pressable
          className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
          disabled={submitting}
          nativeID="edit-training-plan-save-button"
          onPress={handleSubmit}
          testID="edit-training-plan-save-button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-training-plan-save-button-label" testID="edit-training-plan-save-button-label">
                Guardar cambios
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

export function EditTrainingPlanScreen({ planId }) {
  return (
    <RequireAuth>
      <EditTrainingPlanScreenContent planId={planId} />
    </RequireAuth>
  );
}
