import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { INPUT_CLASS, InlinePicker } from '../forms/fields.jsx';

// Editor controlado de grupos de un equipo: nombre + plan de entrenamiento
// en una fila, botón "+" para agregar, chips removibles debajo. Componente
// compartido a propósito — hoy es el paso "Grupos" del wizard de creación
// de equipo (components/team/create-team-screen.jsx, sobre datos en
// borrador); a futuro es el mismo componente el que va a usar el botón
// "Crear grupo" de la pantalla de un equipo ya existente, apuntando a una
// acción de store distinta (el equipo ya real, no un borrador). Por eso
// no sabe nada de "crear equipo": solo recibe `groups` + `onChange`.
//
// onRemove es opcional y se dispara además de onChange al sacar un grupo
// — pensado para que quien lo use pueda reaccionar (ej. limpiar
// invitaciones que apuntaban a ese grupo), sin que este componente sepa
// nada de invitaciones.
export function GroupListEditor({ groups, onChange, onRemove, planOptions }) {
  const colors = useThemeColors();
  const [draftName, setDraftName] = useState('');
  const [draftPlan, setDraftPlan] = useState('');
  const [draftError, setDraftError] = useState(null);

  const handleAdd = () => {
    const name = draftName.trim();
    if (!name) {
      setDraftError('Ingresá un nombre para el grupo.');
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setDraftError('Ya creaste un grupo con ese nombre.');
      return;
    }
    onChange([...groups, { id: `group-draft-${Date.now()}`, name, trainingPlanId: draftPlan || null }]);
    setDraftName('');
    setDraftPlan('');
    setDraftError(null);
  };

  const handleRemove = (groupId) => {
    onChange(groups.filter((g) => g.id !== groupId));
    onRemove?.(groupId);
  };

  return (
    <View nativeID="group-list-editor" testID="group-list-editor">
      <View className="flex-row items-center gap-2" nativeID="group-list-editor-row" testID="group-list-editor-row">
        <View
          className={`h-12 flex-1 flex-row items-center rounded-xl border ${
            draftError ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
          }`}
          nativeID="group-list-editor-name-wrapper"
          testID="group-list-editor-name-wrapper"
        >
          <TextInput
            className={INPUT_CLASS}
            nativeID="group-list-editor-name-input"
            onChangeText={(text) => { setDraftName(text); if (draftError) setDraftError(null); }}
            placeholder="Nombre del grupo"
            placeholderTextColor={colors.onSurfaceVariant}
            testID="group-list-editor-name-input"
            value={draftName}
          />
        </View>

        <InlinePicker
          onChange={setDraftPlan}
          options={planOptions}
          placeholder="Plan"
          scope="group-list-editor-plan"
          value={draftPlan}
          widthClass="max-w-[132px]"
        />

        <Pressable
          accessibilityLabel="Agregar grupo"
          className="h-12 w-12 items-center justify-center rounded-xl bg-primary hover:opacity-90 active:opacity-80"
          nativeID="group-list-editor-add-button"
          onPress={handleAdd}
          testID="group-list-editor-add-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={20} />
        </Pressable>
      </View>

      <View className="h-5" nativeID="group-list-editor-error-row" testID="group-list-editor-error-row">
        {draftError && (
          <Text className="text-xs text-red-500 dark:text-red-400" nativeID="group-list-editor-error" testID="group-list-editor-error">
            {draftError}
          </Text>
        )}
      </View>

      {groups.length > 0 && (
        <View className="mb-2 flex-row flex-wrap gap-2" nativeID="group-list-editor-chips" testID="group-list-editor-chips">
          {groups.map((group) => {
            const planName = planOptions.find((p) => p.id === group.trainingPlanId)?.name;
            return (
              <View
                key={group.id}
                className="flex-row items-center gap-1.5 rounded-full bg-primary-tint-subtle px-3 py-1.5 dark:bg-primary/10"
                nativeID={`group-list-editor-chip-${group.id}`}
                testID={`group-list-editor-chip-${group.id}`}
              >
                <Text
                  className="text-xs font-medium text-on-primary-tint dark:text-primary"
                  nativeID={`group-list-editor-chip-${group.id}-label`}
                  testID={`group-list-editor-chip-${group.id}-label`}
                >
                  {group.name} · {planName ?? 'Sin plan'}
                </Text>
                <Pressable
                  accessibilityLabel={`Quitar grupo ${group.name}`}
                  nativeID={`group-list-editor-chip-${group.id}-remove-button`}
                  onPress={() => handleRemove(group.id)}
                  testID={`group-list-editor-chip-${group.id}-remove-button`}
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={14} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
