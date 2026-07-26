import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField, PickerField } from '../forms/fields.jsx';

// Editor controlado de grupos de un equipo: nombre + plan de entrenamiento
// (campos completos, uno debajo del otro — con su propio componente no
// hace falta pelear espacio horizontal como cuando esto vivía pegado al
// resto del formulario), botón "Agregar grupo", y la lista de grupos ya
// creados como filas completas (no chips — "nombre + plan" no entra
// legible en una pill chica). Componente compartido a propósito — hoy es
// el paso "Grupos" del wizard de creación de equipo
// (components/team/create-team-screen.jsx, sobre datos en borrador); a
// futuro es el mismo componente el que va a usar el botón "Crear grupo"
// de la pantalla de un equipo ya existente, apuntando a una acción de
// store distinta (el equipo ya real, no un borrador). Por eso no sabe
// nada de "crear equipo": solo recibe `groups` + `onChange`.
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
      <InputField
        dense
        error={draftError}
        label="Nombre del grupo"
        onChange={(text) => { setDraftName(text); if (draftError) setDraftError(null); }}
        placeholder="Ej. Grupo avanzado"
        value={draftName}
      />

      <PickerField
        dense
        label="Plan de entrenamiento"
        onChange={setDraftPlan}
        options={planOptions}
        placeholder="Sin plan asignado"
        value={draftPlan}
      />

      <Pressable
        className="mb-4 h-11 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
        nativeID="group-list-editor-add-button"
        onPress={handleAdd}
        testID="group-list-editor-add-button"
      >
        <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={18} />
        <Text
          className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
          nativeID="group-list-editor-add-button-label"
          testID="group-list-editor-add-button-label"
        >
          Agregar grupo
        </Text>
      </Pressable>

      {groups.length > 0 && (
        <View className="gap-2" nativeID="group-list-editor-list" testID="group-list-editor-list">
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
      )}
    </View>
  );
}
