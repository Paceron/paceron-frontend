import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Editor controlado de grupos de un equipo, usado en el paso "Grupos" del
// wizard de creación (components/team/create-team-screen.jsx, sobre datos
// en borrador — el equipo todavía no existe). Muestra primero el
// formulario para agregar grupos extra, en 2 columnas: nombre+plan a la
// izquierda, descripción a la derecha ocupando el mismo alto. Debajo, al
// final (justo antes de los botones de navegación del wizard), la lista
// combinada de grupos del equipo: el grupo principal primero (fila fija,
// sin botón eliminar — el backend lo crea automáticamente vía
// create_default_group al crear el equipo, acá es solo un preview, no
// tiene id real todavía) y después cada grupo extra ya agregado, con
// botón de eliminar.
export function GroupListEditor({ groups, onChange, onRemove, planOptions }) {
  const colors = useThemeColors();
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
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
    onChange([...groups, { id: `group-draft-${Date.now()}`, name, description: draftDescription.trim() || null, trainingPlanId: draftPlan || null }]);
    setDraftName('');
    setDraftDescription('');
    setDraftPlan('');
    setDraftError(null);
  };

  const handleRemove = (groupId) => {
    onChange(groups.filter((g) => g.id !== groupId));
    onRemove?.(groupId);
  };

  return (
    <View nativeID="group-list-editor" testID="group-list-editor">
      <View className="mb-6 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="group-list-editor-form" testID="group-list-editor-form">
        <Row>
          <Col>
            <InputField
              dense
              error={draftError}
              label="Nombre del grupo"
              onChange={(text) => { setDraftName(text); if (draftError) setDraftError(null); }}
              placeholder="Ej. Grupo avanzado"
              value={draftName}
            />
            <ResponsiveSelectField
              dense
              label="Plan de entrenamiento"
              onChange={setDraftPlan}
              options={planOptions}
              placeholder={planOptions.length === 0 ? 'Sin planes disponibles todavía' : 'Sin plan asignado'}
              value={draftPlan}
            />
          </Col>
          <Col>
            <View className="flex-1" nativeID="group-list-editor-description-wrapper" testID="group-list-editor-description-wrapper">
              <InputField
                dense
                label="Descripción del grupo"
                multiline
                numberOfLines={5}
                onChange={setDraftDescription}
                placeholder="Ej. Corredores con mayor volumen y ritmo."
                value={draftDescription}
              />
            </View>
          </Col>
        </Row>

        <Pressable
          className="h-11 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
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
    </View>
  );
}
