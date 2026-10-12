import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { getAddressDetailRows } from '../../utils/location-address-format.js';

// Compartido entre location-picker.jsx (nativo) y location-picker.web.jsx
// -- cada uno tiene su propia implementación del mapa/picker (split de
// plataforma, Metro resuelve .web.jsx antes que .jsx en web) pero esta
// pieza no depende de maplibre, así que no hace falta duplicarla.
export function LocationDetailModal({ visible, onClose, value }) {
  const colors = useThemeColors();
  const rows = getAddressDetailRows(value);

  return (
    <Modal animationType="fade" nativeID="location-picker-detail-modal" onRequestClose={onClose} testID="location-picker-detail-modal" transparent visible={visible}>
      <View className="flex-1" nativeID="location-picker-detail-modal-overlay" testID="location-picker-detail-modal-overlay">
        <Pressable className="absolute inset-0 bg-black/50" nativeID="location-picker-detail-modal-backdrop" onPress={onClose} testID="location-picker-detail-modal-backdrop" />
        <View className="flex-1 items-center justify-center px-4" nativeID="location-picker-detail-modal-center" pointerEvents="box-none" testID="location-picker-detail-modal-center">
          <View
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="location-picker-detail-modal-card"
            testID="location-picker-detail-modal-card"
          >
            <View className="mb-2 flex-row items-center justify-between" nativeID="location-picker-detail-modal-header" testID="location-picker-detail-modal-header">
              <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID="location-picker-detail-modal-title" testID="location-picker-detail-modal-title">
                Detalle de la ubicación
              </Text>
              <Pressable nativeID="location-picker-detail-modal-close-button" onPress={onClose} testID="location-picker-detail-modal-close-button">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>
            <Text className="mb-3 text-sm text-slate-600 dark:text-slate-300" nativeID="location-picker-detail-modal-full-label" testID="location-picker-detail-modal-full-label">
              {value?.rawLabel || value?.label || 'Sin dirección resuelta.'}
            </Text>
            {rows.map((row) => (
              <View className="flex-row justify-between py-1" key={row.label} nativeID={`location-picker-detail-modal-row-${row.label}`} testID={`location-picker-detail-modal-row-${row.label}`}>
                <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`location-picker-detail-modal-row-${row.label}-key`} testID={`location-picker-detail-modal-row-${row.label}-key`}>{row.label}</Text>
                <Text className="text-xs text-slate-700 dark:text-slate-200" nativeID={`location-picker-detail-modal-row-${row.label}-value`} testID={`location-picker-detail-modal-row-${row.label}-value`}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
