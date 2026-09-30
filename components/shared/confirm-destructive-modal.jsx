import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Shell de confirmación para una acción destructiva e irreversible. Reemplaza
// a las 4 copias que había (de las cuales se migra solo la de borrar equipo
// en este change — ver D12: las otras quedan como precedente).
//
// El componente NO dispara `notifyWarning()`: eso lo hace el caller en su
// propio `useEffect`, para que el shell no decida cuándo vibrar.
//
// `idPrefix` es requerido por la misma razón que en `StatTile` — la regla
// `local/require-native-id` exige ids y hardcodearlos haría colisionar dos
// modales destructivos en el mismo árbol, que es justo el caso de uso para el
// que se extrae.
export function ConfirmDestructiveModal({
  visible,
  title,
  description,
  confirmLabel,
  loading,
  onCancel,
  onConfirm,
  idPrefix,
}) {
  return (
    <Modal nativeID={idPrefix} testID={idPrefix} animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable nativeID={`${idPrefix}-backdrop`} onPress={onCancel} testID={`${idPrefix}-backdrop`} className="flex-1 items-center justify-center bg-black/50 px-4">
        <Pressable nativeID={`${idPrefix}-card`} onPress={() => {}} testID={`${idPrefix}-card`} className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface">
          <View nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`} className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`} className="text-lg font-bold text-red-700 dark:text-red-400">
              {title}
            </Text>
          </View>

          <Text nativeID={`${idPrefix}-description`} testID={`${idPrefix}-description`} className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {description}
          </Text>

          <View nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`} className="flex-row gap-3">
            <Pressable
              nativeID={`${idPrefix}-cancel-button`}
              testID={`${idPrefix}-cancel-button`}
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={onCancel}
            >
              <Text nativeID={`${idPrefix}-cancel-label`} testID={`${idPrefix}-cancel-label`} className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              nativeID={`${idPrefix}-confirm-button`}
              testID={`${idPrefix}-confirm-button`}
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              onPress={onConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text nativeID={`${idPrefix}-confirm-label`} testID={`${idPrefix}-confirm-label`} className="text-sm font-semibold uppercase tracking-wide text-white">
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
