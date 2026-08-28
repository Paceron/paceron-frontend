import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, PLAN_DURATION_OPTIONS } from '../../store/training-plan-store.js';
import { useTrainingPlanForm } from '../../hooks/use-training-plan-form.js';
import { TrainingPlanFormFields } from './training-plan-form-fields.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function CreateTrainingPlanScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const createPlan = useTrainingPlanStore((s) => s.createPlan);

  const form = useTrainingPlanForm({ ownerId: user?.userId });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.validate()) return;
    setSubmitting(true);
    const result = await createPlan(form.getValues());
    setSubmitting(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos crear el plan', text2: result.error });
      return;
    }

    Toast.show({ type: 'success', text1: 'Plan creado' });
    router.replace(`/training-plans/${result.plan.id}`);
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="create-training-plan-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="create-training-plan-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="create-training-plan-screen-container" testID="create-training-plan-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="create-training-plan-screen-header" testID="create-training-plan-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="create-training-plan-screen-back-button"
            onPress={() => router.back()}
            testID="create-training-plan-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="create-training-plan-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="create-training-plan-screen-title">
            Crear plan de entrenamiento
          </Text>
        </View>

        <TrainingPlanFormFields durationOptions={PLAN_DURATION_OPTIONS} form={form} />

        <Pressable
          className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
          disabled={submitting}
          nativeID="create-training-plan-save-button"
          onPress={handleSubmit}
          testID="create-training-plan-save-button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-training-plan-save-button-label" testID="create-training-plan-save-button-label">
                Crear plan
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

export function CreateTrainingPlanScreen() {
  return (
    <RequireAuth>
      <CreateTrainingPlanScreenContent />
    </RequireAuth>
  );
}
