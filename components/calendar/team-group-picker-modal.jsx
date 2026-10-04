import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useGroups } from '../../hooks/use-groups.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Atajo para operaciones multi-día (estampar plan, seleccionar varios días)
// desde el calendario general: el usuario elige equipo→grupo acá, y el
// caller navega a /teams/{id}/groups/{id}/calendar -- la pantalla YA
// construida, con su propia grilla y modo selección. No reimplementa nada
// de eso, solo ahorra el paso manual de ir a Equipos → el equipo → el
// grupo → Calendario.
export function TeamGroupPickerModal({ visible, onClose, teamOptions, userId, onConfirm }) {
  const colors = useThemeColors();
  const [teamId, setTeamId] = useState('');
  const [groupId, setGroupId] = useState('');
  const { groups: groupOptions } = useGroups(teamId || null, userId);

  const handleTeamChange = (id) => {
    setTeamId(id);
    setGroupId('');
  };

  const reset = () => {
    setTeamId('');
    setGroupId('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = () => {
    if (!teamId || !groupId) return;
    onConfirm(teamId, groupId);
    reset();
  };

  return (
    <Modal animationType="fade" nativeID="team-group-picker-modal" onRequestClose={handleClose} testID="team-group-picker-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="team-group-picker-modal-backdrop" onPress={handleClose} testID="team-group-picker-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="team-group-picker-modal-card" onPress={() => {}} testID="team-group-picker-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="team-group-picker-modal-header" testID="team-group-picker-modal-header">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-edit" size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="team-group-picker-modal-title" testID="team-group-picker-modal-title">
              Ir al calendario de un grupo
            </Text>
          </View>

          <View className="gap-3" nativeID="team-group-picker-modal-fields" testID="team-group-picker-modal-fields">
            <ResponsiveSelectField
              label="Equipo"
              onChange={handleTeamChange}
              options={teamOptions}
              placeholder="Elegí un equipo"
              value={teamId}
            />
            <ResponsiveSelectField
              disabled={!teamId}
              label="Grupo"
              onChange={setGroupId}
              options={groupOptions.map((g) => ({ id: g.id, name: g.name }))}
              placeholder={teamId ? 'Elegí un grupo' : 'Elegí un equipo primero'}
              value={groupId}
            />
          </View>

          <View className="mt-5 flex-row gap-3" nativeID="team-group-picker-modal-actions" testID="team-group-picker-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="team-group-picker-modal-cancel-button"
              onPress={handleClose}
              testID="team-group-picker-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="team-group-picker-modal-cancel-label" testID="team-group-picker-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className={`h-11 flex-1 items-center justify-center rounded-full ${teamId && groupId ? 'bg-primary hover:opacity-90 active:opacity-80' : 'bg-slate-200 dark:bg-slate-700'}`}
              disabled={!teamId || !groupId}
              nativeID="team-group-picker-modal-confirm-button"
              onPress={handleConfirm}
              testID="team-group-picker-modal-confirm-button"
            >
              <Text className={`text-sm font-semibold uppercase tracking-wide ${teamId && groupId ? 'text-[#111518]' : 'text-slate-500 dark:text-slate-400'}`} nativeID="team-group-picker-modal-confirm-label" testID="team-group-picker-modal-confirm-label">
                Ir
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
