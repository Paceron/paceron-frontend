import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Modal chico: "usado en N sesiones/planes" -> lista de nombres. Sin
// navegación (ver "Fuera de alcance" de la spec) — solo visibilidad de
// dónde está usado un ejercicio/sesión antes de decidir si borrarlo.
export function UsageListModal({ visible, title, items, onClose }) {
  const colors = useThemeColors();

  return (
    <Modal animationType="fade" nativeID="usage-list-modal" onRequestClose={onClose} testID="usage-list-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="usage-list-modal-backdrop" onPress={onClose} testID="usage-list-modal-backdrop">
        <Pressable
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="usage-list-modal-card"
          onPress={() => {}}
          testID="usage-list-modal-card"
        >
          <Text className="mb-3 text-base font-bold text-slate-900 dark:text-white" nativeID="usage-list-modal-title" testID="usage-list-modal-title">
            {title}
          </Text>

          <ScrollView className="max-h-64" nativeID="usage-list-modal-list" showsVerticalScrollIndicator={false} testID="usage-list-modal-list">
            {items.map((item) => (
              <View className="flex-row items-center gap-2 border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800" key={item.id} nativeID={`usage-list-modal-item-${item.id}`} testID={`usage-list-modal-item-${item.id}`}>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="circle-small" size={16} />
                <Text className="flex-1 text-sm text-slate-700 dark:text-slate-200" nativeID={`usage-list-modal-item-${item.id}-label`} testID={`usage-list-modal-item-${item.id}-label`}>
                  {item.name}
                </Text>
              </View>
            ))}
          </ScrollView>

          <Pressable
            className="mt-4 h-11 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
            nativeID="usage-list-modal-close-button"
            onPress={onClose}
            testID="usage-list-modal-close-button"
          >
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="usage-list-modal-close-label" testID="usage-list-modal-close-label">Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
