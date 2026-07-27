import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Confirmación liviana (a diferencia de DeactivateAccountModal, que exige
// tipear el email porque borra la cuenta entera) — esto es reversible y no
// pierde datos (el alias de pagos se mantiene guardado), un click alcanza.
export function DeactivateTrainerModal({ visible, onCancel, onConfirm }) {
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
    <Modal nativeID="deactivate-trainer-modal" testID="deactivate-trainer-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="deactivate-trainer-modal-backdrop" testID="deactivate-trainer-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="deactivate-trainer-modal-card" testID="deactivate-trainer-modal-card" className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface">
          <View nativeID="deactivate-trainer-modal-header" testID="deactivate-trainer-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text nativeID="deactivate-trainer-modal-title" testID="deactivate-trainer-modal-title" className="text-lg font-bold text-red-700 dark:text-red-400">Dar de baja perfil de entrenador</Text>
          </View>

          <Text nativeID="deactivate-trainer-modal-description" testID="deactivate-trainer-modal-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a dejar de tener acceso a las funciones de entrenador y volvés a ver solo tu perfil de corredor. Podés volver a activarlo cuando quieras — tu alias de pagos queda guardado para entonces.
          </Text>

          <View nativeID="deactivate-trainer-modal-actions" testID="deactivate-trainer-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="deactivate-trainer-modal-cancel-button"
              testID="deactivate-trainer-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="deactivate-trainer-modal-cancel-label" testID="deactivate-trainer-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              nativeID="deactivate-trainer-modal-confirm-button"
              testID="deactivate-trainer-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text nativeID="deactivate-trainer-modal-confirm-label" testID="deactivate-trainer-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-white">Dar de baja</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
