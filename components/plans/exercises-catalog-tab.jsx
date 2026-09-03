import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField } from '../forms/fields.jsx';
import { EXERCISE_KIND_META } from './exercise-kind-meta.js';
import { CreateExerciseModal } from './create-exercise-modal.jsx';
import { DeleteCatalogItemModal } from './delete-catalog-item-modal.jsx';
import { UsageListModal } from './usage-list-modal.jsx';

// Sesiones (deduplicadas) que referencian este ejercicio en cualquiera
// de sus 3 bloques — uso directo, no transitivo (no cuenta planes). Ver
// docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md.
export function sessionsUsingExercise(exerciseId, sessions) {
  return sessions.filter((s) => [s.warmupExerciseId, s.mainExerciseId, s.cooldownExerciseId].includes(exerciseId));
}

function ExerciseRow({ exercise, usedIn, onEdit, onDelete, onShowUsage }) {
  const meta = EXERCISE_KIND_META[exercise.kind] ?? EXERCISE_KIND_META.walking;
  const idPrefix = `exercise-catalog-row-${exercise.id}`;
  const statParts = [];
  if (exercise.minutes != null) statParts.push(`${exercise.minutes} min`);
  if (exercise.distanceM != null) statParts.push(`${exercise.distanceM} m`);
  if (exercise.speedKph != null) statParts.push(`${exercise.speedKph} km/h`);

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className={`h-10 w-10 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
        <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={18} />
      </View>
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {exercise.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat`} testID={`${idPrefix}-stat`}>
          {statParts.length > 0 ? statParts.join(' · ') : meta.label}
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
      <Pressable className="rounded-lg p-1.5 hover:bg-slate-200 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-edit-button`} onPress={() => onEdit(exercise)} testID={`${idPrefix}-edit-button`}>
        <MaterialCommunityIcons color="#94a3b8" name="pencil-outline" size={18} />
      </Pressable>
      <Pressable className="rounded-lg p-1.5 hover:bg-red-100 active:opacity-70 dark:hover:bg-red-900/20" nativeID={`${idPrefix}-delete-button`} onPress={() => onDelete(exercise, usedIn)} testID={`${idPrefix}-delete-button`}>
        <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
      </Pressable>
    </View>
  );
}

export function ExercisesCatalogTab() {
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const exercises = useExerciseStore((s) => s.exercises);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const deleteExercise = useExerciseStore((s) => s.deleteExercise);
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalExercise, setModalExercise] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { exercise, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { exercise, usedIn }

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchExercises(user.userId), fetchSessions(user.userId)]).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const handleDelete = async () => {
    const result = await deleteExercise(deleteTarget.exercise.id);
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
    <>
      <SectionCard
        headerRight={(
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
            {/* Igual que el buscador de corredores en TeamDetailScreen: sin
                error propio (es un filtro, no un form) y sin margen propio,
                el frame p-3 controla el espacio. */}
            <View className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900" nativeID="exercises-catalog-search-row" testID="exercises-catalog-search-row">
              <InputField className="mb-0" dense hideErrorRow label="Buscar ejercicio" onChange={setSearch} placeholder="Nombre del ejercicio" value={search} />
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
                      exercise={exercise}
                      key={exercise.id}
                      onDelete={(ex, u) => setDeleteTarget({ exercise: ex, usedIn: u })}
                      onEdit={setModalExercise}
                      onShowUsage={(ex, u) => setUsageTarget({ exercise: ex, usedIn: u })}
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
    </>
  );
}
