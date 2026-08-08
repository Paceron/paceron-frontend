import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Mover = DELETE /groups/{id}/users/{user_id} (grupo actual) + POST
// /teams/{id}/groups/{group_id}/users (grupo nuevo) — 2 llamadas sin
// transacción del lado del backend, ver plan
// docs/superpowers/plans/2026-08-02-team-roster-and-membership.md.
export function MoveRunnerModal({ visible, runnerName, groups, currentGroupId, onCancel, onConfirm }) {
  const [targetGroupId, setTargetGroupId] = useState('');
  const [loading, setLoading] = useState(false);

  const groupOptions = groups.filter((g) => g.id !== currentGroupId);

  const handleConfirm = async () => {
    if (loading || !targetGroupId) return;
    setLoading(true);
    await onConfirm(targetGroupId);
    setLoading(false);
    setTargetGroupId('');
  };

  const handleCancel = () => {
    if (loading) return;
    setTargetGroupId('');
    onCancel();
  };

  return (
    <Modal nativeID="move-runner-modal" testID="move-runner-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="move-runner-modal-backdrop" testID="move-runner-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="move-runner-modal-card" testID="move-runner-modal-card" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface">
          <View nativeID="move-runner-modal-header" testID="move-runner-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#111518" name="account-switch-outline" size={20} className="dark:text-white" />
            <Text nativeID="move-runner-modal-title" testID="move-runner-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">Mover de grupo</Text>
          </View>

          <Text nativeID="move-runner-modal-description" testID="move-runner-modal-description" className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Elegí a qué grupo pasa {runnerName} dentro del equipo.
          </Text>

          <View className="mb-5" nativeID="move-runner-modal-field-wrapper" testID="move-runner-modal-field-wrapper">
            <ResponsiveSelectField
              label="Grupo destino"
              onChange={setTargetGroupId}
              options={groupOptions}
              placeholder="Elegí un grupo"
              value={targetGroupId}
            />
          </View>

          <View nativeID="move-runner-modal-actions" testID="move-runner-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="move-runner-modal-cancel-button"
              testID="move-runner-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="move-runner-modal-cancel-label" testID="move-runner-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              nativeID="move-runner-modal-confirm-button"
              testID="move-runner-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={loading || !targetGroupId}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#111518" size="small" />
              ) : (
                <Text nativeID="move-runner-modal-confirm-label" testID="move-runner-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-[#111518]">Mover</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
