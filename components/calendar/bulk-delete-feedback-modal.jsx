import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function BulkDeleteFeedbackModal({ visible, count, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    await onConfirm();
    // setLoading(false) after onConfirm resolves is a no-op once the parent has already hidden
    // the modal (visible=false), but is kept for symmetry/safety in case a future caller keeps
    // the modal open on partial failure.
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal animationType="fade" nativeID="bulk-delete-feedback-modal" onRequestClose={handleCancel} testID="bulk-delete-feedback-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="bulk-delete-feedback-modal-backdrop" onPress={handleCancel} testID="bulk-delete-feedback-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="bulk-delete-feedback-modal-card" onPress={() => {}} testID="bulk-delete-feedback-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="bulk-delete-feedback-modal-header" testID="bulk-delete-feedback-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="bulk-delete-feedback-modal-title" testID="bulk-delete-feedback-modal-title">
              Eliminar {count} sesión{count === 1 ? '' : 'es'}
            </Text>
          </View>

          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="bulk-delete-feedback-modal-description" testID="bulk-delete-feedback-modal-description">
            Esta acción no se puede deshacer.
          </Text>

          <View className="flex-row gap-3" nativeID="bulk-delete-feedback-modal-actions" testID="bulk-delete-feedback-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="bulk-delete-feedback-modal-cancel-button"
              onPress={handleCancel}
              testID="bulk-delete-feedback-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="bulk-delete-feedback-modal-cancel-label" testID="bulk-delete-feedback-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={loading}
              nativeID="bulk-delete-feedback-modal-confirm-button"
              onPress={handleConfirm}
              testID="bulk-delete-feedback-modal-confirm-button"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="bulk-delete-feedback-modal-confirm-label" testID="bulk-delete-feedback-modal-confirm-label">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
