import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { notifyWarning } from '../../utils/haptics.js';

// Mismo patrón que DeleteTeamModal — confirmación de una acción
// destructiva e irreversible, un click alcanza porque ya está detrás de
// un botón que solo ve quien administra el equipo.
export function DeleteGroupModal({ visible, groupName, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) notifyWarning();
  }, [visible]);

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
    <Modal nativeID="delete-group-modal" testID="delete-group-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <Pressable nativeID="delete-group-modal-backdrop" onPress={handleCancel} testID="delete-group-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <Pressable nativeID="delete-group-modal-card" onPress={() => {}} testID="delete-group-modal-card" className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface">
          <View nativeID="delete-group-modal-header" testID="delete-group-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text nativeID="delete-group-modal-title" testID="delete-group-modal-title" className="text-lg font-bold text-red-700 dark:text-red-400">Eliminar grupo</Text>
          </View>

          <Text nativeID="delete-group-modal-description" testID="delete-group-modal-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a eliminar &quot;{groupName}&quot; de forma permanente. Los corredores de este grupo pasan al grupo principal — esta acción no se puede deshacer.
          </Text>

          <View nativeID="delete-group-modal-actions" testID="delete-group-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="delete-group-modal-cancel-button"
              testID="delete-group-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="delete-group-modal-cancel-label" testID="delete-group-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              nativeID="delete-group-modal-confirm-button"
              testID="delete-group-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text nativeID="delete-group-modal-confirm-label" testID="delete-group-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-white">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
