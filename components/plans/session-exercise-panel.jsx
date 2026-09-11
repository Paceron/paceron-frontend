import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { FIELD_LABEL } from '../forms/fields.jsx';
import { EXERCISE_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';
import { CreateExerciseModal } from './create-exercise-modal.jsx';
import { DraggableExerciseCard } from './session-drag-and-drop.jsx';

// Mini-catálogo embebido en el modal de sesión (columna derecha, solo
// web ancho) — mismo criterio visual que exercises-catalog-tab.jsx,
// sin acciones de editar/eliminar (esto no es el catálogo real, es un
// selector para arrastrar a la sesión).
function PanelExerciseCard({ exercise }) {
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const statLine = buildExerciseStatLine(exercise);
  const idPrefix = `session-exercise-panel-card-${exercise.id}`;

  return (
    <View className="mb-2 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className={`h-8 w-8 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={16} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {exercise.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} numberOfLines={1} testID={`${idPrefix}-stat`}>
          {statLine || meta.label}
        </Text>
      </View>
    </View>
  );
}

export function SessionExercisePanel({ onExerciseAdded }) {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises } = useExercises(userId);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const query = search.trim().toLowerCase();
  const filtered = query ? exercises.filter((e) => e.name.toLowerCase().includes(query)) : exercises;

  return (
    <View className="flex-1" nativeID="session-exercise-panel" testID="session-exercise-panel">
      <View className="mb-2 flex-row items-center justify-between" nativeID="session-exercise-panel-header" testID="session-exercise-panel-header">
        <Text className={FIELD_LABEL} nativeID="session-exercise-panel-header-label" testID="session-exercise-panel-header-label">Catálogo de ejercicios</Text>
        <Pressable
          nativeID="session-exercise-panel-create-button"
          onPress={() => setShowCreateModal(true)}
          testID="session-exercise-panel-create-button"
        >
          <Text className="text-sm font-semibold text-primary" nativeID="session-exercise-panel-create-button-label" testID="session-exercise-panel-create-button-label">
            + Crear ejercicio
          </Text>
        </Pressable>
      </View>

      <View className="mb-3 h-10 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900" nativeID="session-exercise-panel-search-row" testID="session-exercise-panel-search-row">
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={16} />
        <TextInput
          className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
          nativeID="session-exercise-panel-search-input"
          onChangeText={setSearch}
          placeholder="Buscar ejercicio"
          placeholderTextColor={colors.onSurfaceVariant}
          testID="session-exercise-panel-search-input"
          value={search}
        />
      </View>

      <ScrollView nativeID="session-exercise-panel-list" showsVerticalScrollIndicator={false} testID="session-exercise-panel-list">
        {filtered.length === 0 ? (
          <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="session-exercise-panel-empty" testID="session-exercise-panel-empty">
            Ningún ejercicio coincide.
          </Text>
        ) : (
          filtered.map((exercise) => (
            <DraggableExerciseCard exercise={exercise} key={exercise.id} onDropped={onExerciseAdded}>
              <PanelExerciseCard exercise={exercise} />
            </DraggableExerciseCard>
          ))
        )}
      </ScrollView>

      <CreateExerciseModal onClose={() => setShowCreateModal(false)} onCreated={() => setShowCreateModal(false)} visible={showCreateModal} />
    </View>
  );
}
