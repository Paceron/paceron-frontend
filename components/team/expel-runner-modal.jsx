import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mismo patrón que DeleteTeamModal — confirmación de una acción
// destructiva (saca al corredor del equipo entero, DELETE
// /teams/{id}/users/{user_id}, no solo del grupo actual).
export function ExpelRunnerModal({ visible, runnerName, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal nativeID="expel-runner-modal" testID="expel-runner-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="expel-runner-modal-backdrop" testID="expel-runner-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="expel-runner-modal-card" testID="expel-runner-modal-card" className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface">
          <View nativeID="expel-runner-modal-header" testID="expel-runner-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text nativeID="expel-runner-modal-title" testID="expel-runner-modal-title" className="text-lg font-bold text-red-700 dark:text-red-400">Sacar del equipo</Text>
          </View>

          <Text nativeID="expel-runner-modal-description" testID="expel-runner-modal-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {runnerName} va a dejar de ser parte del equipo por completo, no solo del grupo actual.
          </Text>

          <View nativeID="expel-runner-modal-actions" testID="expel-runner-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="expel-runner-modal-cancel-button"
              testID="expel-runner-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="expel-runner-modal-cancel-label" testID="expel-runner-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              nativeID="expel-runner-modal-confirm-button"
              testID="expel-runner-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text nativeID="expel-runner-modal-confirm-label" testID="expel-runner-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-white">Sacar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
