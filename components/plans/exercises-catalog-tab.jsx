import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises, useExerciseMutations } from '../../hooks/use-exercises.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { SectionCard } from '../forms/section-card.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { EXERCISE_KIND_META, buildExerciseStatLine } from './exercise-kind-meta.js';
import { CreateExerciseModal } from './create-exercise-modal.jsx';
import { DeleteCatalogItemModal } from './delete-catalog-item-modal.jsx';
import { BulkDeleteExercisesModal } from './bulk-delete-exercises-modal.jsx';
import { UsageListModal } from './usage-list-modal.jsx';

// Sesiones (deduplicadas) que referencian este ejercicio en cualquiera
// de sus ejercicios (lista libre, cualquier rol) — uso directo, no
// transitivo (no cuenta planes). Ver
// docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md.
export function sessionsUsingExercise(exerciseId, sessions) {
  return sessions.filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId));
}

// Para cada id de la selección, sus sesiones de uso (reusa
// sessionsUsingExercise de arriba) — usado por BulkDeleteExercisesModal
// para saber a cuáles avisar antes de borrar en bloque. Solo devuelve
// los que SÍ tienen uso (los sin uso no necesitan aviso).
export function exercisesWithUsage(exerciseIds, exercises, sessions) {
  return exerciseIds
    .map((id) => ({
      exercise: exercises.find((e) => e.id === id),
      usedIn: sessionsUsingExercise(id, sessions),
    }))
    .filter((entry) => entry.usedIn.length > 0);
}

function ExerciseMenuButton({ exercise, onOpenMenu, containerRef }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, exercise);
      });
    });
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel="Más opciones"
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={`exercise-catalog-row-${exercise.id}-menu-toggle`}
      onPress={handlePress}
      testID={`exercise-catalog-row-${exercise.id}-menu-toggle`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
    </Pressable>
  );
}

function ExerciseActionsMenu({ exercise, onEdit, onClone, onDelete }) {
  const colors = useThemeColors();

  return (
    <View className="w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="exercise-catalog-menu-panel" testID="exercise-catalog-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="exercise-catalog-menu-edit"
        onPress={() => onEdit(exercise)}
        testID="exercise-catalog-menu-edit"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="exercise-catalog-menu-edit-label" testID="exercise-catalog-menu-edit-label">Editar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="exercise-catalog-menu-clone"
        onPress={() => onClone(exercise)}
        testID="exercise-catalog-menu-clone"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="content-copy" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="exercise-catalog-menu-clone-label" testID="exercise-catalog-menu-clone-label">Clonar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="exercise-catalog-menu-delete"
        onPress={() => onDelete(exercise)}
        testID="exercise-catalog-menu-delete"
      >
        <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
        <Text className="text-sm text-red-600 dark:text-red-400" nativeID="exercise-catalog-menu-delete-label" testID="exercise-catalog-menu-delete-label">Eliminar</Text>
      </Pressable>
    </View>
  );
}

function ExerciseRow({ exercise, usedIn, onOpenMenu, onShowUsage, containerRef, selectionMode, selected, onToggleSelected }) {
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const idPrefix = `exercise-catalog-row-${exercise.id}`;
  const statLine = buildExerciseStatLine(exercise);

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      {selectionMode && (
        <Pressable
          accessibilityLabel={selected ? 'Quitar de la selección' : 'Agregar a la selección'}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          nativeID={`${idPrefix}-checkbox`}
          onPress={() => onToggleSelected(exercise.id)}
          testID={`${idPrefix}-checkbox`}
        >
          <MaterialCommunityIcons color={selected ? '#8cc63e' : '#94a3b8'} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} />
        </Pressable>
      )}
      <View className={`h-10 w-10 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={18} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {exercise.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} testID={`${idPrefix}-stat`}>
          {statLine || meta.label}
        </Text>
      </View>
      <Pressable
        disabled={usedIn.length === 0}
        nativeID={`${idPrefix}-usage-button`}
        onPress={() => onShowUsage(exercise, usedIn)}
        testID={`${idPrefix}-usage-button`}
      >
        <Text className={`text-xs ${usedIn.length > 0 ? 'font-semibold text-primary underline' : 'text-slate-400 dark:text-slate-500'}`} nativeID={`${idPrefix}-usage-label`} testID={`${idPrefix}-usage-label`}>
          Usado en {usedIn.length} {usedIn.length === 1 ? 'sesión' : 'sesiones'}
        </Text>
      </Pressable>
      {!selectionMode && <ExerciseMenuButton containerRef={containerRef} exercise={exercise} onOpenMenu={onOpenMenu} />}
    </View>
  );
}

export function ExercisesCatalogTab() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises, loading } = useExercises(userId);
  const { deleteExercise, cloneExercise } = useExerciseMutations();
  const { sessions } = useSessions(userId);

  const [search, setSearch] = useState('');
  const [modalExercise, setModalExercise] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { exercise, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { exercise, usedIn }
  const containerRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null); // { anchor, exercise } | null
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);

  const handleOpenMenu = (anchor, exercise) => setOpenMenu({ anchor, exercise });
  const handleCloseMenu = () => setOpenMenu(null);

  const handleToggleSelectionMode = () => {
    setSelectionMode((v) => !v);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const handleToggleSelected = (exerciseId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId); else next.add(exerciseId);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const handleCloneOne = async (exercise) => {
    handleCloseMenu();
    const result = await cloneExercise({ ownerId: userId, exerciseId: exercise.id });
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos clonar el ejercicio', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Ejercicio clonado' });
  };

  const handleBulkClone = async () => {
    setBulkMenuOpen(false);
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => cloneExercise({ ownerId: userId, exerciseId: id })));
    const failed = results.filter((r) => !r.success).length;
    exitSelection();
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunos ejercicios no se pudieron clonar', text2: `${failed} de ${ids.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: `${ids.length} ejercicio${ids.length === 1 ? '' : 's'} clonado${ids.length === 1 ? '' : 's'}` });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => deleteExercise({ ownerId: userId, exerciseId: id })));
    const failed = results.filter((r) => !r.success).length;
    setBulkDeleteVisible(false);
    exitSelection();
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunos ejercicios no se pudieron eliminar', text2: `${failed} de ${ids.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: `${ids.length} ejercicio${ids.length === 1 ? '' : 's'} eliminado${ids.length === 1 ? '' : 's'}` });
  };

  const handleDelete = async () => {
    const result = await deleteExercise({ ownerId: userId, exerciseId: deleteTarget.exercise.id });
    setDeleteTarget(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar el ejercicio', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Ejercicio eliminado' });
  };

  const query = search.trim().toLowerCase();
  const filteredExercises = query ? exercises.filter((e) => e.name.toLowerCase().includes(query)) : exercises;

  return (
    <View className="relative flex-1" nativeID="exercises-catalog-tab-root" ref={containerRef} testID="exercises-catalog-tab-root">
      <SectionCard
        headerRight={selectedIds.size > 0 ? (
          <View className="flex-row items-center gap-2" nativeID="exercises-catalog-bulk-bar" testID="exercises-catalog-bulk-bar">
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="exercises-catalog-bulk-count" testID="exercises-catalog-bulk-count">
              {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
            </Text>
            <Pressable
              nativeID="exercises-catalog-bulk-menu-toggle"
              onPress={() => setBulkMenuOpen((v) => !v)}
              testID="exercises-catalog-bulk-menu-toggle"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={20} />
            </Pressable>
          </View>
        ) : selectionMode ? (
          <Pressable
            className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
            nativeID="exercises-catalog-cancel-selection-button"
            onPress={handleToggleSelectionMode}
            testID="exercises-catalog-cancel-selection-button"
          >
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400" nativeID="exercises-catalog-cancel-selection-button-label" testID="exercises-catalog-cancel-selection-button-label">Cancelar</Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-3" nativeID="exercises-catalog-header-actions" testID="exercises-catalog-header-actions">
            <Pressable
              nativeID="exercises-catalog-select-button"
              onPress={handleToggleSelectionMode}
              testID="exercises-catalog-select-button"
            >
              <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400" nativeID="exercises-catalog-select-button-label" testID="exercises-catalog-select-button-label">Seleccionar</Text>
            </Pressable>
            <Pressable
              className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
              nativeID="exercises-catalog-create-button"
              onPress={() => setModalExercise(null)}
              testID="exercises-catalog-create-button"
            >
              <Text className="text-sm font-semibold text-primary" nativeID="exercises-catalog-create-button-label" testID="exercises-catalog-create-button-label">
                Crear ejercicio
              </Text>
            </Pressable>
          </View>
        )}
        icon="dumbbell"
        title="Tus ejercicios"
      >
        {loading ? (
          <View className="items-center py-6" nativeID="exercises-catalog-loading" testID="exercises-catalog-loading">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : exercises.length === 0 ? (
          <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="exercises-catalog-empty" testID="exercises-catalog-empty">
            Todavía no creaste ningún ejercicio.
          </Text>
        ) : (
          <>
            {/* Buscador minimalista: sin label propio ni fila de error —
                "Buscar ejercicio" vive directamente como placeholder
                adentro del campo, una sola línea en vez del frame con
                label del patrón de TeamDetailScreen. */}
            <View className="mb-4 h-11 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900" nativeID="exercises-catalog-search-row" testID="exercises-catalog-search-row">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={18} />
              <TextInput
                className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
                nativeID="exercises-catalog-search-input"
                onChangeText={setSearch}
                placeholder="Buscar ejercicio"
                placeholderTextColor={colors.onSurfaceVariant}
                testID="exercises-catalog-search-input"
                value={search}
              />
            </View>

            {filteredExercises.length === 0 ? (
              <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="exercises-catalog-no-matches" testID="exercises-catalog-no-matches">
                Ningún ejercicio coincide con la búsqueda.
              </Text>
            ) : (
              <View className="gap-2" nativeID="exercises-catalog-list" testID="exercises-catalog-list">
                {filteredExercises.map((exercise) => {
                  const usedIn = sessionsUsingExercise(exercise.id, sessions);
                  return (
                    <ExerciseRow
                      containerRef={containerRef}
                      exercise={exercise}
                      key={exercise.id}
                      onOpenMenu={handleOpenMenu}
                      onShowUsage={(ex, u) => setUsageTarget({ exercise: ex, usedIn: u })}
                      onToggleSelected={handleToggleSelected}
                      selected={selectedIds.has(exercise.id)}
                      selectionMode={selectionMode}
                      usedIn={usedIn}
                    />
                  );
                })}
              </View>
            )}
          </>
        )}
      </SectionCard>

      <CreateExerciseModal
        exercise={modalExercise ?? undefined}
        onClose={() => setModalExercise(undefined)}
        onCreated={() => setModalExercise(undefined)}
        visible={modalExercise !== undefined}
      />

      <AnimatedDropdown
        anchorStyle={openMenu ? { left: openMenu.anchor.x, top: openMenu.anchor.y + openMenu.anchor.height + 4, width: 192 } : {}}
        onClose={handleCloseMenu}
        open={Boolean(openMenu)}
      >
        {openMenu && (
          <ExerciseActionsMenu
            exercise={openMenu.exercise}
            onClone={handleCloneOne}
            onDelete={(ex) => { handleCloseMenu(); setDeleteTarget({ exercise: ex, usedIn: sessionsUsingExercise(ex.id, sessions) }); }}
            onEdit={(ex) => { handleCloseMenu(); setModalExercise(ex); }}
          />
        )}
      </AnimatedDropdown>

      <AnimatedDropdown
        anchorStyle={{ right: 16, top: 56 }}
        onClose={() => setBulkMenuOpen(false)}
        open={bulkMenuOpen}
      >
        {bulkMenuOpen && (
          <View className="w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="exercises-catalog-bulk-menu-panel" testID="exercises-catalog-bulk-menu-panel">
            <Pressable
              className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="exercises-catalog-bulk-clone"
              onPress={handleBulkClone}
              testID="exercises-catalog-bulk-clone"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="content-copy" size={16} />
              <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="exercises-catalog-bulk-clone-label" testID="exercises-catalog-bulk-clone-label">Clonar</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-2 px-3 py-2 hover:bg-red-50 active:opacity-70 dark:hover:bg-red-900/20"
              nativeID="exercises-catalog-bulk-delete"
              onPress={() => { setBulkMenuOpen(false); setBulkDeleteVisible(true); }}
              testID="exercises-catalog-bulk-delete"
            >
              <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
              <Text className="text-sm text-red-600 dark:text-red-400" nativeID="exercises-catalog-bulk-delete-label" testID="exercises-catalog-bulk-delete-label">Eliminar</Text>
            </Pressable>
          </View>
        )}
      </AnimatedDropdown>

      {deleteTarget && (
        <DeleteCatalogItemModal
          itemKind="ejercicio"
          itemName={deleteTarget.exercise.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          usageLabel="sesiones"
          usedIn={deleteTarget.usedIn}
          visible
        />
      )}

      {usageTarget && (
        <UsageListModal
          items={usageTarget.usedIn}
          onClose={() => setUsageTarget(null)}
          title={`"${usageTarget.exercise.name}" se usa en:`}
          visible
        />
      )}

      <BulkDeleteExercisesModal
        items={Array.from(selectedIds)}
        onCancel={() => setBulkDeleteVisible(false)}
        onConfirm={handleBulkDelete}
        visible={bulkDeleteVisible}
        withUsage={exercisesWithUsage(Array.from(selectedIds), exercises, sessions)}
      />
    </View>
  );
}
