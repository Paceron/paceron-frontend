import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';

// Selector de corredor del entrenador (web) para "Ver registros" de un día
// pasado (spec 2026-09-24, sección 4). Lista de atletas del equipo con
// autocompletado por nombre y botón "Confirmar" — el flujo de elegir corredor
// es ANTERIOR a entrar a la revisión, no se entra sin corredor confirmado.
export function AthletePickerModal({ visible, onClose, teamId, excludeUserId, title = 'Elegí el corredor', onConfirm }) {
  const colors = useThemeColors();
  const { members, loading } = useTeamRoster(teamId);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const athletes = useMemo(() => {
    const normalized = String(query ?? '').trim().toLowerCase();
    const base = members.filter((m) => m.userId !== String(excludeUserId));
    if (!normalized) return base;
    return base.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(normalized));
  }, [members, query, excludeUserId]);

  const handleSelect = (member) => setSelectedId(member.userId);
  const handleConfirm = () => {
    const chosen = athletes.find((m) => m.userId === selectedId);
    if (!chosen) return;
    onConfirm(chosen);
  };
  const handleCancelAndReset = () => {
    setSelectedId(null);
    onClose();
  };

  const clearQuery = () => {
    setQuery('');
    setSelectedId(null);
  };

  return (
    <Modal animationType="fade" nativeID="athlete-picker-modal" onRequestClose={handleCancelAndReset} testID="athlete-picker-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="athlete-picker-modal-backdrop" onPress={handleCancelAndReset} testID="athlete-picker-modal-backdrop">
        <Pressable
          className="max-h-[85%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="athlete-picker-modal-card"
          onPress={() => {}}
          testID="athlete-picker-modal-card"
        >
          <Text className="mb-1 text-lg font-bold text-slate-900 dark:text-white" nativeID="athlete-picker-modal-title" testID="athlete-picker-modal-title">
            {title}
          </Text>
          <Text className="mb-3 text-xs text-slate-500 dark:text-slate-400" nativeID="athlete-picker-modal-subtitle" testID="athlete-picker-modal-subtitle">
            Buscá al corredor y confirmá para ver o editar su registro.
          </Text>

          <View className="mb-3 h-11 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900/60" nativeID="athlete-picker-modal-search-box" testID="athlete-picker-modal-search-box">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={18} />
            <TextInput
              autoCapitalize="none"
              className="flex-1 text-sm text-slate-900 dark:text-white"
              nativeID="athlete-picker-modal-search-input"
              onChangeText={setQuery}
              placeholder="Nombre o email del corredor"
              placeholderTextColor={colors.onSurfaceVariant}
              testID="athlete-picker-modal-search-input"
              value={query}
            />
            {query ? (
              <Pressable nativeID="athlete-picker-modal-clear-button" onPress={clearQuery} testID="athlete-picker-modal-clear-button">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle" size={16} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView className="max-h-72" nativeID="athlete-picker-modal-list-scroll" testID="athlete-picker-modal-list-scroll">
            {loading ? (
              <View className="items-center justify-center py-8" nativeID="athlete-picker-modal-loading" testID="athlete-picker-modal-loading">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : athletes.length === 0 ? (
              <Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="athlete-picker-modal-empty" testID="athlete-picker-modal-empty">
                {query ? 'No encontramos corredores con ese nombre.' : 'Sin corredores en este equipo.'}
              </Text>
            ) : (
              <View className="gap-1.5" nativeID="athlete-picker-modal-list" testID="athlete-picker-modal-list">
                {athletes.map((member) => {
                  const selected = member.userId === selectedId;
                  return (
                    <Pressable
                      className={`flex-row items-center gap-2 rounded-xl border px-3 py-2.5 ${selected ? 'border-primary bg-primary/10' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'}`}
                      key={member.userId}
                      nativeID={`athlete-picker-option-${member.userId}`}
                      onPress={() => handleSelect(member)}
                      testID={`athlete-picker-option-${member.userId}`}
                    >
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/15" nativeID={`athlete-picker-option-${member.userId}-avatar`} testID={`athlete-picker-option-${member.userId}-avatar`}>
                        <MaterialCommunityIcons color={colors.primary} name="run" size={16} />
                      </View>
                      <View className="flex-1" nativeID={`athlete-picker-option-${member.userId}-text`} testID={`athlete-picker-option-${member.userId}-text`}>
                        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`athlete-picker-option-${member.userId}-name`} testID={`athlete-picker-option-${member.userId}-name`}>
                          {member.name}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`athlete-picker-option-${member.userId}-email`} testID={`athlete-picker-option-${member.userId}-email`}>
                          {member.email}
                        </Text>
                      </View>
                      {selected && <MaterialCommunityIcons color={colors.primary} name="check-circle" size={18} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View className="mt-4 flex-row gap-3" nativeID="athlete-picker-modal-actions" testID="athlete-picker-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="athlete-picker-modal-cancel-button"
              onPress={handleCancelAndReset}
              testID="athlete-picker-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="athlete-picker-modal-cancel-label" testID="athlete-picker-modal-cancel-label">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              className={`h-11 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 ${selectedId ? '' : 'opacity-50'}`}
              disabled={!selectedId}
              nativeID="athlete-picker-modal-confirm-button"
              onPress={handleConfirm}
              testID="athlete-picker-modal-confirm-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="athlete-picker-modal-confirm-label" testID="athlete-picker-modal-confirm-label">
                Confirmar
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}