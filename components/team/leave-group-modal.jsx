import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mismo patrón que ExpelRunnerModal/DeleteTeamModal. A diferencia de esas
// dos, es una acción del propio corredor sobre sí mismo, no de quien
// gestiona el equipo — sigue siendo grupo → grupo principal (fallback),
// no team → afuera.
export function LeaveGroupModal({ visible, groupName, onCancel, onConfirm }) {
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
    <Modal nativeID="leave-group-modal" testID="leave-group-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="leave-group-modal-backdrop" testID="leave-group-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="leave-group-modal-card" testID="leave-group-modal-card" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface">
          <View nativeID="leave-group-modal-header" testID="leave-group-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#ef4444" name="exit-run" size={20} />
            <Text nativeID="leave-group-modal-title" testID="leave-group-modal-title" className="text-lg font-bold text-red-700 dark:text-red-400">Salir del grupo</Text>
          </View>

          <Text nativeID="leave-group-modal-description" testID="leave-group-modal-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a salir de &quot;{groupName}&quot; y pasás al grupo principal del equipo. Seguís siendo parte del equipo.
          </Text>

          <View nativeID="leave-group-modal-actions" testID="leave-group-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="leave-group-modal-cancel-button"
              testID="leave-group-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="leave-group-modal-cancel-label" testID="leave-group-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              nativeID="leave-group-modal-confirm-button"
              testID="leave-group-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text nativeID="leave-group-modal-confirm-label" testID="leave-group-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-white">Salir</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
