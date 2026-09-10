import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mismo patrón visual que components/team/delete-team-modal.jsx, sin
// `loading` (esto no dispara ninguna request, es instantáneo) y con
// paleta ámbar en vez de roja — perdés tu trabajo, no se borra nada del
// servidor.
export function DiscardChangesModal({ visible, onCancel, onConfirm }) {
  return (
    <Modal nativeID="discard-changes-modal" testID="discard-changes-modal" animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable nativeID="discard-changes-modal-backdrop" onPress={onCancel} testID="discard-changes-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <Pressable nativeID="discard-changes-modal-card" onPress={() => {}} testID="discard-changes-modal-card" className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-surface">
          <View nativeID="discard-changes-modal-header" testID="discard-changes-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#d97706" name="alert-outline" size={20} />
            <Text nativeID="discard-changes-modal-title" testID="discard-changes-modal-title" className="text-lg font-bold text-amber-700 dark:text-amber-400">Salir sin guardar</Text>
          </View>

          <Text nativeID="discard-changes-modal-description" testID="discard-changes-modal-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Tenés cambios sin guardar. Si salís ahora, se van a perder.
          </Text>

          <View nativeID="discard-changes-modal-actions" testID="discard-changes-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="discard-changes-modal-cancel-button"
              testID="discard-changes-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              onPress={onCancel}
            >
              <Text nativeID="discard-changes-modal-cancel-label" testID="discard-changes-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Continuar</Text>
            </Pressable>
            <Pressable
              nativeID="discard-changes-modal-confirm-button"
              testID="discard-changes-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-amber-600 hover:opacity-90 active:opacity-80"
              onPress={onConfirm}
            >
              <Text nativeID="discard-changes-modal-confirm-label" testID="discard-changes-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-white">Salir sin guardar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
