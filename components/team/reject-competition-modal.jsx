import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { InputField } from '../forms/fields.jsx';

// Rechazo de una propuesta de competencia (Gap 33) -- motivo opcional,
// sin guard de cambios sin guardar (es un solo campo de texto corto, no
// amerita el mecanismo completo de useFormDirty/useUnsavedChangesGuard).
export function RejectCompetitionModal({ visible, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onConfirm(reason.trim() || null);
    setSubmitting(false);
  };

  return (
    <Modal animationType="fade" nativeID="reject-competition-modal" onRequestClose={onClose} testID="reject-competition-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="reject-competition-modal-backdrop" onPress={onClose} testID="reject-competition-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="reject-competition-modal-card" onPress={() => {}} testID="reject-competition-modal-card">
          <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="reject-competition-modal-title" testID="reject-competition-modal-title">
            Rechazar propuesta
          </Text>
          <InputField className="mb-0" dense hideErrorRow label="Motivo (opcional)" multiline numberOfLines={3} onChange={setReason} placeholder="Ej. Se superpone con otra competencia." value={reason} />
          <View className="mt-4 flex-row gap-3" nativeID="reject-competition-modal-actions" testID="reject-competition-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={submitting}
              nativeID="reject-competition-modal-cancel-button"
              onPress={onClose}
              testID="reject-competition-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="reject-competition-modal-cancel-label" testID="reject-competition-modal-cancel-label">Volver</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-red-600 active:opacity-80"
              disabled={submitting}
              nativeID="reject-competition-modal-confirm-button"
              onPress={handleConfirm}
              testID="reject-competition-modal-confirm-button"
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="reject-competition-modal-confirm-label" testID="reject-competition-modal-confirm-label">
                  Rechazar
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
