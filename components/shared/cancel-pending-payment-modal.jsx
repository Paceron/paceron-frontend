import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { notifyWarning } from '../../utils/haptics.js';

// Confirmación de cancelar un cambio de tier con pago pendiente
// (sub first_payment_pending). Mismo patrón visual que
// DiscardChangesModal (paleta ámbar: perdés el cambio en curso), con
// `loading` porque dispara una request de cancelación al backend.
export function CancelPendingPaymentModal({ visible, tierName, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) notifyWarning();
  }, [visible]);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal animationType="fade" nativeID="cancel-pending-payment-modal" onRequestClose={handleClose} testID="cancel-pending-payment-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="cancel-pending-payment-modal-backdrop" onPress={handleClose} testID="cancel-pending-payment-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-surface" nativeID="cancel-pending-payment-modal-card" onPress={() => {}} testID="cancel-pending-payment-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="cancel-pending-payment-modal-header" testID="cancel-pending-payment-modal-header">
            <MaterialCommunityIcons color="#d97706" name="alert-outline" size={20} />
            <Text className="text-lg font-bold text-amber-700 dark:text-amber-400" nativeID="cancel-pending-payment-modal-title" testID="cancel-pending-payment-modal-title">
              Cancelar cambio de tier
            </Text>
          </View>

          <Text className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="cancel-pending-payment-modal-description" testID="cancel-pending-payment-modal-description">
            ¿Estás seguro de que querés cancelar el cambio de tier{tierName ? ` a ${tierName}` : ''}? Se va a cancelar el pago pendiente y vas a poder elegir otro tier.
          </Text>

          <View className="flex-row gap-3" nativeID="cancel-pending-payment-modal-actions" testID="cancel-pending-payment-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="cancel-pending-payment-modal-cancel-button"
              onPress={handleClose}
              testID="cancel-pending-payment-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="cancel-pending-payment-modal-cancel-label" testID="cancel-pending-payment-modal-cancel-label">Volver</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-amber-600 hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={loading}
              nativeID="cancel-pending-payment-modal-confirm-button"
              onPress={handleConfirm}
              testID="cancel-pending-payment-modal-confirm-button"
            >
              {loading ? <ActivityIndicator color="#ffffff" size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="cancel-pending-payment-modal-confirm-label" testID="cancel-pending-payment-modal-confirm-label">Cancelar cambio</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}