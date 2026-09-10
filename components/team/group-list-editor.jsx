import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { CreateGroupModal } from './create-group-modal.jsx';

// Lista de grupos de un equipo en el paso "Grupos" del wizard de creación
// (create-team-screen.jsx, sobre datos en borrador — el equipo todavía no
// existe). El grupo principal primero (fila fija, sin botón eliminar — el
// backend lo crea automáticamente vía create_default_group al crear el
// equipo, acá es solo un preview, no tiene id real todavía), después cada
// grupo extra ya agregado, con botón de eliminar. El alta pasa por
// CreateGroupModal (botón "+" arriba de la lista) — acá solo se agrega al
// array local `groups`, sin pegarle a ningún servicio.
export function GroupListEditor({ groups, onChange, onRemove, planOptions }) {
  const colors = useThemeColors();
  const [modalVisible, setModalVisible] = useState(false);

  const handleRemove = (groupId) => {
    onChange(groups.filter((g) => g.id !== groupId));
    onRemove?.(groupId);
  };

  return (
    <View nativeID="group-list-editor" testID="group-list-editor">
      <View className="mb-3 flex-row items-center justify-between" nativeID="group-list-editor-header" testID="group-list-editor-header">
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="group-list-editor-header-label" testID="group-list-editor-header-label">
          Grupos agregados
        </Text>
        <Pressable
          accessibilityLabel="Agregar grupo"
          className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="group-list-editor-add-button"
          onPress={() => setModalVisible(true)}
          testID="group-list-editor-add-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
        </Pressable>
      </View>

      <View className="gap-2" nativeID="group-list-editor-list" testID="group-list-editor-list">
        <View
          className="flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary-tint-subtle px-4 py-3 dark:border-primary/20 dark:bg-primary/10"
          nativeID="group-list-editor-default-row"
          testID="group-list-editor-default-row"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID="group-list-editor-default-row-icon" testID="group-list-editor-default-row-icon">
            <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={18} />
          </View>
          <View className="flex-1" nativeID="group-list-editor-default-row-info" testID="group-list-editor-default-row-info">
            <View className="flex-row items-center gap-2" nativeID="group-list-editor-default-row-name-wrapper" testID="group-list-editor-default-row-name-wrapper">
              <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="group-list-editor-default-row-name" testID="group-list-editor-default-row-name">
                Grupo principal
              </Text>
              <View className="rounded-full bg-primary/15 px-2 py-0.5 dark:bg-primary/25" nativeID="group-list-editor-default-row-badge" testID="group-list-editor-default-row-badge">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-primary" nativeID="group-list-editor-default-row-badge-label" testID="group-list-editor-default-row-badge-label">
                  Fijo
                </Text>
              </View>
            </View>
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="group-list-editor-default-row-hint" testID="group-list-editor-default-row-hint">
              Se crea automáticamente con el equipo — todo corredor sin grupo elegido cae acá.
            </Text>
          </View>
        </View>

        {groups.map((group) => {
          const planName = planOptions.find((p) => p.id === group.trainingPlanId)?.name;
          return (
            <View
              key={group.id}
              className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
              nativeID={`group-list-editor-row-${group.id}`}
              testID={`group-list-editor-row-${group.id}`}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15"
                nativeID={`group-list-editor-row-${group.id}-icon`}
                testID={`group-list-editor-row-${group.id}-icon`}
              >
                <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={18} />
              </View>
              <View className="flex-1" nativeID={`group-list-editor-row-${group.id}-info`} testID={`group-list-editor-row-${group.id}-info`}>
                <Text
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                  nativeID={`group-list-editor-row-${group.id}-name`}
                  testID={`group-list-editor-row-${group.id}-name`}
                >
                  {group.name}
                </Text>
                <Text
                  className="text-xs text-slate-500 dark:text-slate-400"
                  nativeID={`group-list-editor-row-${group.id}-plan`}
                  testID={`group-list-editor-row-${group.id}-plan`}
                >
                  {planName ?? 'Sin plan asignado'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`Quitar grupo ${group.name}`}
                className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
                nativeID={`group-list-editor-row-${group.id}-remove-button`}
                onPress={() => handleRemove(group.id)}
                testID={`group-list-editor-row-${group.id}-remove-button`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trash-can-outline" size={18} />
              </Pressable>
            </View>
          );
        })}
      </View>

      <CreateGroupModal
        existingNames={groups.map((g) => g.name.toLowerCase())}
        onClose={() => setModalVisible(false)}
        onSubmit={async ({ name, description, trainingPlanId }) => {
          onChange([...groups, { id: `group-draft-${Date.now()}`, name, description, trainingPlanId }]);
          return { success: true };
        }}
        planOptions={planOptions}
        visible={modalVisible}
      />
    </View>
  );
}
