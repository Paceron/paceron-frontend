import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mismo patrón que DeactivateTrainerModal — confirmación de una acción
// destructiva e irreversible (a diferencia de esa, esta sí borra datos:
// el equipo entero), un click alcanza porque ya está detrás de un botón
// que solo ve quien administra el equipo.
export function DeleteTeamModal({ visible, teamName, onCancel, onConfirm }) {
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
    <Modal nativeID="delete-team-modal" testID="delete-team-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="delete-team-modal-backdrop" testID="delete-team-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="delete-team-modal-card" testID="delete-team-modal-card" className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface">
          <View nativeID="delete-team-modal-header" testID="delete-team-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text nativeID="delete-team-modal-title" testID="delete-team-modal-title" className="text-lg font-bold text-red-700 dark:text-red-400">Eliminar equipo</Text>
          </View>

          <Text nativeID="delete-team-modal-description" testID="delete-team-modal-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a eliminar &quot;{teamName}&quot; de forma permanente. Esta acción no se puede deshacer.
          </Text>

          <View nativeID="delete-team-modal-actions" testID="delete-team-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="delete-team-modal-cancel-button"
              testID="delete-team-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="delete-team-modal-cancel-label" testID="delete-team-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              nativeID="delete-team-modal-confirm-button"
              testID="delete-team-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text nativeID="delete-team-modal-confirm-label" testID="delete-team-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-white">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
