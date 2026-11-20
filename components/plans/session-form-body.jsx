import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isWeb } from '../../utils/platform.js';
import { InputField, FIELD_LABEL } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from './exercise-kind-meta.js';
import {
  useSessionDropTarget, useSessionAutoScrollTarget,
  ReorderProvider, ReorderableRow,
} from './session-drag-and-drop.jsx';
import { SessionExercisePanel } from './session-exercise-panel.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { IconButton } from '../shared/icon-button.jsx';

const SESSION_ROLE_OPTIONS = SESSION_ROLE_ORDER.map((role) => ({ id: role, name: SESSION_ROLE_META[role].label }));

const ROLE_ROW_BG = {
  warmup: 'bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800',
  main: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-800',
  cooldown: 'bg-cyan-50 dark:bg-cyan-950 border-cyan-300 dark:border-cyan-800',
};

function CompactNumberPill({ idPrefix, icon, suffix, value, onChange, accessibilityLabel, fallback = 0 }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value ?? ''));
  }, [value]);

  const handleChange = (text) => {
    const digits = text.replace(/[^0-9]/g, '');
    setDraft(digits);
    if (digits !== '') onChange(digits);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const minimum = fallback === 0 ? 0 : 1;
    const next = draft === '' ? fallback : Math.max(minimum, Number(draft) || fallback);
    setDraft(String(next));
    onChange(String(next));
  };

  return (
    <View className="h-8 flex-row items-center gap-1 rounded-full bg-slate-100 px-2 dark:bg-slate-800" nativeID={idPrefix} testID={idPrefix}>
      <MaterialCommunityIcons color="#94a3b8" name={icon} size={14} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        className="w-8 text-center text-xs text-slate-900 outline-none dark:text-white"
        keyboardType="number-pad"
        nativeID={`${idPrefix}-input`}
        onBlur={handleBlur}
        onChangeText={handleChange}
        onFocus={() => { focusedRef.current = true; }}
        testID={`${idPrefix}-input`}
        value={draft}
      />
      <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-suffix`} testID={`${idPrefix}-suffix`}>{suffix}</Text>
    </View>
  );
}

export function SessionRoleCoverage({ exercises, idPrefix = 'session-role-coverage' }) {
  return (
    <View className="mb-2 flex-row flex-wrap gap-1.5" nativeID={idPrefix} testID={idPrefix}>
      {SESSION_ROLE_ORDER.map((role) => {
        const complete = exercises.some((entry) => entry.role === role && entry.exerciseId);
        return (
          <View
            className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${complete ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}
            key={role}
            nativeID={`${idPrefix}-${role}`}
            testID={`${idPrefix}-${role}`}
          >
            <MaterialCommunityIcons color={complete ? '#16a34a' : '#d97706'} name={complete ? 'check-circle-outline' : 'alert-circle-outline'} size={12} />
            <Text className={`text-[11px] font-semibold ${complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`} nativeID={`${idPrefix}-${role}-label`} testID={`${idPrefix}-${role}-label`}>
              {SESSION_ROLE_META[role].label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function SessionExerciseRow({ idPrefix, entry, index, catalogExercises, catalogLoading = false, onChangeExercise, onChangeRole, onRemove }) {
  const [isSeries, setIsSeries] = useState(entry.repeatCount > 1);
  const roleMeta = SESSION_ROLE_META[entry.role] ?? SESSION_ROLE_META.main;
  const roleOptions = entry.role === 'main' ? catalogExercises : catalogExercises.filter((e) => WARMCOOL_KINDS.includes(e.kind));

  const handleToggleSeries = () => {
    const next = !isSeries;
    setIsSeries(next);
    if (!next) onChangeExercise(entry.localKey, { repeatCount: 1, restMinutes: 0 });
  };

  return (
    <View className={`gap-2 rounded-xl mx-1 border border-l-8 px-3 py-2.5 shadow-sm ${ROLE_ROW_BG[entry.role] ?? 'bg-slate-50 dark:bg-slate-900'}`} nativeID={idPrefix} testID={idPrefix}>
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
            required
            showPlaceholderOption={false}
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
            disabled={catalogLoading}
            loading={catalogLoading}
            onChange={(exerciseId) => onChangeExercise(entry.localKey, { exerciseId })}
            options={roleOptions.map((e) => ({ id: e.id, name: e.name }))}
            placeholder={catalogLoading ? 'Cargando ejercicios…' : roleOptions.length ? 'Elegí un ejercicio' : 'Todavía no hay ejercicios de este tipo'}
            required
            value={entry.exerciseId}
          />
        </View>
        <IconTooltip idPrefix={`${idPrefix}-remove-button-tooltip`} label="Quitar ejercicio">
          <IconButton
            icon="trash-can-outline"
            idPrefix={`${idPrefix}-remove-button`}
            label="Quitar ejercicio"
            onPress={() => onRemove(entry.localKey)}
            size={48}
            variant="danger"
          />
        </IconTooltip>
      </View>

      <View className="flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-series-row`} testID={`${idPrefix}-series-row`}>
        <MaterialCommunityIcons color={roleMeta.iconColor} name="drag-vertical" size={18} />
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
          <Text className={`text-xs font-semibold ${isSeries ? 'text-on-primary-tint dark:text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${idPrefix}-series-toggle-label`} testID={`${idPrefix}-series-toggle-label`}>
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
              fallback={1}
              suffix="×"
              value={String(entry.repeatCount)}
            />
            <CompactNumberPill
              accessibilityLabel="Descanso en minutos"
              icon="timer-outline"
              idPrefix={`${idPrefix}-rest-minutes`}
              onChange={(v) => onChangeExercise(entry.localKey, { restMinutes: Number(v) || 0 })}
              fallback={0}
              suffix="min"
              value={String(entry.restMinutes)}
            />
          </>
        )}
      </View>
    </View>
  );
}

// refreshControl (opcional): solo edit-session-screen.jsx lo pasa -- los
// otros 2 call sites (create-session-screen.jsx, create-session-modal.jsx)
// son formularios de alta, sin nada que refrescar, quedan sin tocar
// (undefined, mismo comportamiento de siempre).
export function SessionFormBody({ name, onSetName, nameError, description, onSetDescription, exercises, catalogExercises, catalogLoading = false, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped, error, exercisesError, visible, refreshControl }) {
  const dropTargetRef = useSessionDropTarget();
  const { autoScrollRef, onListScroll, onContentSizeChange, onListLayout } = useSessionAutoScrollTarget();

  return (
    <ScrollView className="flex-1" nativeID="session-form-body-scroll" refreshControl={refreshControl} testID="session-form-body-scroll">
      <InputField autoFocus={!isWeb && visible} dense error={nameError} label="Nombre" onChange={onSetName} placeholder="Ej. Series de velocidad" value={name} />
      <InputField dense hideErrorRow label="Descripción (opcional)" multiline numberOfLines={3} onChange={onSetDescription} value={description} />

      <SessionExercisePanel horizontal onExerciseAdded={onExerciseDropped} />

      <Text className={`${FIELD_LABEL} mb-1 mt-3`} nativeID="session-form-body-exercises-header-label" testID="session-form-body-exercises-header-label">Ejercicios</Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID="session-form-body-drop-hint" testID="session-form-body-drop-hint">
        {isWeb ? 'Arrastrá un ejercicio del catálogo para sumarlo, o una fila para reordenarla.' : 'Mantené presionado un ejercicio del catálogo para sumarlo, o una fila para reordenarla.'}
      </Text>

      <SessionRoleCoverage exercises={exercises} />

      <View className={`h-[320px] rounded-xl border border-dashed bg-slate-200/60 dark:bg-slate-950/50 ${exercisesError ? 'border-red-400 dark:border-red-700' : 'border-slate-300 dark:border-slate-600'}`} nativeID="session-form-body-exercises-list" ref={dropTargetRef} testID="session-form-body-exercises-list">
        <ReorderProvider>
          <GestureScrollView
            contentContainerClassName="p-3 pb-5"
            nativeID="session-form-body-exercises-scroll"
            onContentSizeChange={onContentSizeChange}
            onLayout={onListLayout}
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
                  catalogLoading={catalogLoading}
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
        </ReorderProvider>
      </View>

      {error && (
        <Text className="mb-3 mt-2 text-xs text-red-500 dark:text-red-400" nativeID="session-form-body-error" testID="session-form-body-error">{error}</Text>
      )}
    </ScrollView>
  );
}
