import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isWeb } from '../../utils/platform.js';
import { InputField, FIELD_LABEL } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from './exercise-kind-meta.js';
import {
  useSessionDropTarget, useSessionAutoScrollTarget, SessionDropIndicator,
  ReorderProvider, ReorderableRow, ReorderDropIndicator,
} from './session-drag-and-drop.jsx';
import { SessionExercisePanel } from './session-exercise-panel.jsx';

const SESSION_ROLE_OPTIONS = SESSION_ROLE_ORDER.map((role) => ({ id: role, name: SESSION_ROLE_META[role].label }));

function CompactNumberPill({ idPrefix, icon, suffix, value, onChange, accessibilityLabel }) {
  return (
    <View className="h-8 flex-row items-center gap-1 rounded-full bg-slate-100 px-2 dark:bg-slate-800" nativeID={idPrefix} testID={idPrefix}>
      <MaterialCommunityIcons color="#94a3b8" name={icon} size={14} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        className="w-6 text-xs text-slate-900 outline-none dark:text-white"
        keyboardType="number-pad"
        nativeID={`${idPrefix}-input`}
        onChangeText={onChange}
        testID={`${idPrefix}-input`}
        value={value}
      />
      <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-suffix`} testID={`${idPrefix}-suffix`}>{suffix}</Text>
    </View>
  );
}

export function SessionExerciseRow({ idPrefix, entry, index, catalogExercises, onChangeExercise, onChangeRole, onRemove }) {
  const [isSeries, setIsSeries] = useState(entry.repeatCount > 1);
  const roleOptions = entry.role === 'main' ? catalogExercises : catalogExercises.filter((e) => WARMCOOL_KINDS.includes(e.kind));

  const handleToggleSeries = () => {
    const next = !isSeries;
    setIsSeries(next);
    if (!next) onChangeExercise(entry.localKey, { repeatCount: 1, restMinutes: 0 });
  };

  return (
    <View className="gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-fields`} testID={`${idPrefix}-fields`}>
        <View className="w-36" nativeID={`${idPrefix}-role-select-wrapper`} testID={`${idPrefix}-role-select-wrapper`}>
          <ResponsiveSelectField
            className="mb-0"
            dense
            hideErrorRow
            hideLabel
            label="Rol"
            onChange={(role) => onChangeRole(entry.localKey, role)}
            options={SESSION_ROLE_OPTIONS}
            value={entry.role}
          />
        </View>
        <View className="flex-1" nativeID={`${idPrefix}-select-wrapper`} testID={`${idPrefix}-select-wrapper`}>
          <ResponsiveSelectField
            className="mb-0"
            dense
            hideErrorRow
            hideLabel
            label={`Ejercicio ${index + 1}`}
            onChange={(exerciseId) => onChangeExercise(entry.localKey, { exerciseId })}
            options={roleOptions.map((e) => ({ id: e.id, name: e.name }))}
            placeholder={roleOptions.length ? 'Elegí un ejercicio' : 'Todavía no hay ejercicios de este tipo'}
            required
            value={entry.exerciseId}
          />
        </View>
        <Pressable
          accessibilityLabel="Quitar ejercicio"
          className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 hover:bg-red-50 active:opacity-70 dark:border-slate-700 dark:hover:bg-red-900/20"
          nativeID={`${idPrefix}-remove-button`}
          onPress={() => onRemove(entry.localKey)}
          testID={`${idPrefix}-remove-button`}
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-series-row`} testID={`${idPrefix}-series-row`}>
        <Pressable
          accessibilityLabel="Marcar como serie repetida"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSeries }}
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
          nativeID={`${idPrefix}-series-toggle`}
          onPress={handleToggleSeries}
          testID={`${idPrefix}-series-toggle`}
        >
          <MaterialCommunityIcons color={isSeries ? '#8cc63e' : '#94a3b8'} name="repeat-variant" size={16} />
          <Text className={`text-xs font-semibold ${isSeries ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${idPrefix}-series-toggle-label`} testID={`${idPrefix}-series-toggle-label`}>
            Serie repetida
          </Text>
        </Pressable>

        {isSeries && (
          <>
            <CompactNumberPill
              accessibilityLabel="Repeticiones"
              icon="repeat-variant"
              idPrefix={`${idPrefix}-repeat-count`}
              onChange={(v) => onChangeExercise(entry.localKey, { repeatCount: Number(v) || 1 })}
              suffix="×"
              value={String(entry.repeatCount)}
            />
            <CompactNumberPill
              accessibilityLabel="Descanso en minutos"
              icon="timer-outline"
              idPrefix={`${idPrefix}-rest-minutes`}
              onChange={(v) => onChangeExercise(entry.localKey, { restMinutes: Number(v) || 0 })}
              suffix="min"
              value={String(entry.restMinutes)}
            />
          </>
        )}
      </View>
    </View>
  );
}

export function SessionFormBody({ name, onSetName, description, onSetDescription, exercises, catalogExercises, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped, error, visible }) {
  const dropTargetRef = useSessionDropTarget();
  const { autoScrollRef, onListScroll } = useSessionAutoScrollTarget();

  return (
    <ScrollView className="flex-1" nativeID="session-form-body-scroll" testID="session-form-body-scroll">
      <InputField autoFocus={!isWeb && visible} dense hideErrorRow label="Nombre" onChange={onSetName} placeholder="Ej. Series de velocidad" value={name} />
      <InputField dense hideErrorRow label="Descripción (opcional)" onChange={onSetDescription} value={description} />

      <SessionExercisePanel horizontal onExerciseAdded={onExerciseDropped} />

      <Text className={`${FIELD_LABEL} mb-1 mt-3`} nativeID="session-form-body-exercises-header-label" testID="session-form-body-exercises-header-label">Ejercicios</Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID="session-form-body-drop-hint" testID="session-form-body-drop-hint">
        Mantené presionado un ejercicio del catálogo para sumarlo, o una fila para reordenarla.
      </Text>

      <View className="h-[320px] rounded-xl border border-dashed border-slate-300 dark:border-slate-600" nativeID="session-form-body-exercises-list" ref={dropTargetRef} testID="session-form-body-exercises-list">
        <ReorderProvider>
          <GestureScrollView
            contentContainerClassName="gap-2 p-2 pb-4"
            nativeID="session-form-body-exercises-scroll"
            onScroll={onListScroll}
            ref={autoScrollRef}
            scrollEventThrottle={16}
            testID="session-form-body-exercises-scroll"
          >
            {exercises.length === 0 ? (
              <Text className="p-2 text-xs text-slate-400 dark:text-slate-500" nativeID="session-form-body-exercises-empty" testID="session-form-body-exercises-empty">
                Todavía no agregaste ejercicios.
              </Text>
            ) : exercises.map((entry, index) => (
              <ReorderableRow index={index} itemCount={exercises.length} key={entry.localKey} onReorder={onReorder}>
                <SessionExerciseRow
                  catalogExercises={catalogExercises}
                  entry={entry}
                  idPrefix={`session-form-body-exercise-row-${entry.localKey}`}
                  index={index}
                  onChangeExercise={onChangeExercise}
                  onChangeRole={onChangeRole}
                  onRemove={onRemove}
                />
              </ReorderableRow>
            ))}
          </GestureScrollView>
          <SessionDropIndicator />
          <ReorderDropIndicator />
        </ReorderProvider>
      </View>

      {error && (
        <Text className="mb-3 mt-2 text-xs text-red-500 dark:text-red-400" nativeID="session-form-body-error" testID="session-form-body-error">{error}</Text>
      )}
    </ScrollView>
  );
}
