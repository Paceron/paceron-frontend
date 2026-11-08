import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

const DASH = '—';
function display(value) {
  return value && String(value).trim() ? String(value) : DASH;
}

function InfoField({ label, value, idPrefix }) {
  return (
    <View className="mb-4" nativeID={idPrefix} testID={idPrefix}>
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        {label}
      </Text>
      <Text className="text-sm leading-5 text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {value}
      </Text>
    </View>
  );
}

// "Sobre el equipo" -- antes vivía como card suelta en la pestaña General
// (ya borrada, ver team-detail-screen.jsx). Mismo contenido, movido a un
// modal accesible desde el botón "i" del header, al lado de editar/salir.
export function TeamInfoModal({ visible, onClose, ownerName, description, requirements }) {
  const colors = useThemeColors();

  return (
    <Modal animationType="fade" nativeID="team-info-modal" onRequestClose={onClose} testID="team-info-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="team-info-modal-backdrop" onPress={onClose} testID="team-info-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="team-info-modal-card" onPress={() => {}} testID="team-info-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="team-info-modal-header" testID="team-info-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="information-outline" size={20} />
            <Text className="flex-1 text-base font-bold text-slate-900 dark:text-white" nativeID="team-info-modal-title" testID="team-info-modal-title">
              Sobre el equipo
            </Text>
            <Pressable className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID="team-info-modal-close-button" onPress={onClose} testID="team-info-modal-close-button">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
            </Pressable>
          </View>

          <InfoField idPrefix="team-info-modal-owner" label="Entrenador a cargo" value={display(ownerName)} />
          <InfoField idPrefix="team-info-modal-description" label="Descripción" value={display(description)} />
          <InfoField idPrefix="team-info-modal-requirements" label="Requisitos de pertenencia" value={display(requirements)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
