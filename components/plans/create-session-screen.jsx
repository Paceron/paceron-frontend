import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { useSessionMutations } from '../../hooks/use-sessions.js';
import { useSessionForm } from '../../hooks/use-session-form.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { SessionDragProvider, DragGhost } from './session-drag-and-drop.jsx';
import { SessionFormBody } from './session-form-body.jsx';

function CreateSessionScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises: catalogExercises } = useExercises(userId);
  const { createSession } = useSessionMutations();
  const [submitting, setSubmitting] = useState(false);

  const form = useSessionForm({ ownerId: userId, catalogExercises });

  const isDirty = useFormDirty({ name: form.name, description: form.description, exercises: form.exercises });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.validate()) return;
    setSubmitting(true);
    const result = await createSession({ ownerId: userId, form: form.getValues() });
    setSubmitting(false);

    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos crear la sesión', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: 'Sesión creada' });
    bypassGuard(() => router.back());
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionDragProvider>
        <View className="flex-1 bg-paper px-4 pt-8 dark:bg-ink" nativeID="create-session-screen-container" testID="create-session-screen-container">
          <View className="mb-4 flex-row items-center gap-2" nativeID="create-session-screen-header" testID="create-session-screen-header">
            <Pressable
              className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
              nativeID="create-session-screen-back-button"
              onPress={() => guardedClose(() => router.back())}
              testID="create-session-screen-back-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            </Pressable>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="create-session-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="create-session-screen-title">
              Nueva sesión
            </Text>
          </View>

          <SessionFormBody
            catalogExercises={catalogExercises}
            description={form.description}
            error={form.error}
            exercises={form.exercises}
            name={form.name}
            onChangeExercise={form.onChangeExercise}
            onChangeRole={form.onChangeRole}
            onExerciseDropped={form.onExerciseDropped}
            onRemove={form.onRemove}
            onReorder={form.onReorder}
            onSetDescription={form.setDescription}
            onSetName={form.setName}
            visible
          />

          <Pressable
            className={`mb-4 mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
            disabled={submitting}
            nativeID="create-session-screen-save-button"
            onPress={handleSubmit}
            testID="create-session-screen-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-session-screen-save-button-label" testID="create-session-screen-save-button-label">
                  Crear sesión
                </Text>
              </>
            )}
          </Pressable>
        </View>
        <DragGhost />
      </SessionDragProvider>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </GestureHandlerRootView>
  );
}

export function CreateSessionScreen() {
  return (
    <RequireAuth>
      <CreateSessionScreenContent />
    </RequireAuth>
  );
}
