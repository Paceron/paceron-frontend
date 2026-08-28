import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mismo patrón que DeleteTeamModal — confirmación de una acción
// destructiva e irreversible, un click alcanza porque ya está detrás de
// un botón que solo ve el dueño del plan.
export function DeleteTrainingPlanModal({ visible, planName, onCancel, onConfirm }) {
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
    <Modal animationType="fade" nativeID="delete-training-plan-modal" onRequestClose={handleCancel} testID="delete-training-plan-modal" transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="delete-training-plan-modal-backdrop" testID="delete-training-plan-modal-backdrop">
        <View className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="delete-training-plan-modal-card" testID="delete-training-plan-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="delete-training-plan-modal-header" testID="delete-training-plan-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="delete-training-plan-modal-title" testID="delete-training-plan-modal-title">Eliminar plan</Text>
          </View>

          <Text className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="delete-training-plan-modal-description" testID="delete-training-plan-modal-description">
            Vas a eliminar &quot;{planName}&quot; de forma permanente, y se va a desasignar de cualquier grupo o corredor que lo tenga hoy. Esta acción no se puede deshacer.
          </Text>

          <View className="flex-row gap-3" nativeID="delete-training-plan-modal-actions" testID="delete-training-plan-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="delete-training-plan-modal-cancel-button"
              onPress={handleCancel}
              testID="delete-training-plan-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="delete-training-plan-modal-cancel-label" testID="delete-training-plan-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              nativeID="delete-training-plan-modal-confirm-button"
              onPress={handleConfirm}
              testID="delete-training-plan-modal-confirm-button"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="delete-training-plan-modal-confirm-label" testID="delete-training-plan-modal-confirm-label">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
