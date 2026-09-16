import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { useSession, useSessionMutations } from '../../hooks/use-sessions.js';
import { useSessionForm } from '../../hooks/use-session-form.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { SessionDragProvider, DragGhost } from './session-drag-and-drop.jsx';
import { SessionFormBody } from './session-form-body.jsx';

function EditSessionScreenContent({ sessionId }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, loading } = useSession(sessionId);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="edit-session-loading" testID="edit-session-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="edit-session-not-found" testID="edit-session-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="edit-session-not-found-label" testID="edit-session-not-found-label">
          No encontramos esta sesión.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="edit-session-not-found-back-button"
          onPress={() => router.back()}
          testID="edit-session-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-session-not-found-back-button-label" testID="edit-session-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return <EditSessionForm session={session} />;
}

function EditSessionForm({ session }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises: catalogExercises } = useExercises(userId);
  const { updateSession } = useSessionMutations();
  const [submitting, setSubmitting] = useState(false);

  const form = useSessionForm({ initial: session, ownerId: session.ownerId, catalogExercises });

  const isDirty = useFormDirty({ name: form.name, description: form.description, exercises: form.exercises });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.validate()) return;
    setSubmitting(true);
    const result = await updateSession({ ownerId: session.ownerId, sessionId: session.id, form: form.getValues() });
    setSubmitting(false);

    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos guardar los cambios', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: 'Sesión actualizada' });
    bypassGuard(() => router.back());
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionDragProvider>
        <View className="flex-1 bg-paper px-4 pt-8 dark:bg-ink" nativeID="edit-session-screen-container" testID="edit-session-screen-container">
          <View className="mb-4 flex-row items-center gap-2" nativeID="edit-session-screen-header" testID="edit-session-screen-header">
            <Pressable
              className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
              nativeID="edit-session-screen-back-button"
              onPress={() => guardedClose(() => router.back())}
              testID="edit-session-screen-back-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            </Pressable>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="edit-session-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="edit-session-screen-title">
              Editar sesión
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
            visible={false}
          />

          <Pressable
            className={`mb-4 mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
            disabled={submitting}
            nativeID="edit-session-screen-save-button"
            onPress={handleSubmit}
            testID="edit-session-screen-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-session-screen-save-button-label" testID="edit-session-screen-save-button-label">
                  Guardar cambios
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

export function EditSessionScreen({ sessionId }) {
  return (
    <RequireAuth>
      <EditSessionScreenContent sessionId={sessionId} />
    </RequireAuth>
  );
}
