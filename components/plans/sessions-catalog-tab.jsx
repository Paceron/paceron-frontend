import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SessionExercisesPreview } from './session-exercises-preview.jsx';
import { CreateSessionModal } from './create-session-modal.jsx';
import { DeleteCatalogItemModal } from './delete-catalog-item-modal.jsx';
import { UsageListModal } from './usage-list-modal.jsx';

// Planes (deduplicados por plan, no por día) que referencian esta
// sesión en alguno de sus 7 días. Ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md.
export function plansUsingSession(sessionId, plans) {
  return plans.filter((p) => p.days.some((d) => d.sessionId === sessionId));
}

function SessionRow({ session, usedIn, onEdit, onDelete, onShowUsage }) {
  const idPrefix = `session-catalog-row-${session.id}`;

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-3" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
            {session.name}
          </Text>
          {session.description?.trim() ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-description`} numberOfLines={1} testID={`${idPrefix}-description`}>
              {session.description}
            </Text>
          ) : null}
        </View>
        <Pressable
          disabled={usedIn.length === 0}
          nativeID={`${idPrefix}-usage-button`}
          onPress={() => onShowUsage(session, usedIn)}
          testID={`${idPrefix}-usage-button`}
        >
          <Text className={`text-xs ${usedIn.length > 0 ? 'font-semibold text-primary underline' : 'text-slate-400 dark:text-slate-500'}`} nativeID={`${idPrefix}-usage-label`} testID={`${idPrefix}-usage-label`}>
            Usado en {usedIn.length} {usedIn.length === 1 ? 'plan' : 'planes'}
          </Text>
        </Pressable>
        <Pressable className="rounded-lg p-1.5 hover:bg-slate-200 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-edit-button`} onPress={() => onEdit(session)} testID={`${idPrefix}-edit-button`}>
          <MaterialCommunityIcons color="#94a3b8" name="pencil-outline" size={18} />
        </Pressable>
        <Pressable className="rounded-lg p-1.5 hover:bg-red-100 active:opacity-70 dark:hover:bg-red-900/20" nativeID={`${idPrefix}-delete-button`} onPress={() => onDelete(session, usedIn)} testID={`${idPrefix}-delete-button`}>
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
        </Pressable>
      </View>
      <SessionExercisesPreview session={session} />
    </View>
  );
}

export function SessionsCatalogTab() {
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const plans = useTrainingPlanStore((s) => s.plans);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);

  const [loading, setLoading] = useState(true);
  const [modalSession, setModalSession] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { session, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { session, usedIn }

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchSessions(user.userId), fetchExercises(user.userId), fetchPlans(user.userId)]).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const handleDelete = async () => {
    const result = await deleteSession(deleteTarget.session.id);
    setDeleteTarget(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar la sesión', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Sesión eliminada' });
  };

  return (
    <>
      <SectionCard
        headerRight={(
          <Pressable
            className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
            nativeID="sessions-catalog-create-button"
            onPress={() => setModalSession(null)}
            testID="sessions-catalog-create-button"
          >
            <Text className="text-sm font-semibold text-primary" nativeID="sessions-catalog-create-button-label" testID="sessions-catalog-create-button-label">
              Crear sesión
            </Text>
          </Pressable>
        )}
        icon="clipboard-plus-outline"
        title="Tus sesiones"
      >
        {loading ? (
          <View className="items-center py-6" nativeID="sessions-catalog-loading" testID="sessions-catalog-loading">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="sessions-catalog-empty" testID="sessions-catalog-empty">
            Todavía no creaste ninguna sesión.
          </Text>
        ) : (
          <View className="gap-2" nativeID="sessions-catalog-list" testID="sessions-catalog-list">
            {sessions.map((session) => {
              const usedIn = plansUsingSession(session.id, plans);
              return (
                <SessionRow
                  key={session.id}
                  onDelete={(s, u) => setDeleteTarget({ session: s, usedIn: u })}
                  onEdit={setModalSession}
                  onShowUsage={(s, u) => setUsageTarget({ session: s, usedIn: u })}
                  session={session}
                  usedIn={usedIn}
                />
              );
            })}
          </View>
        )}
      </SectionCard>

      <CreateSessionModal
        onClose={() => setModalSession(undefined)}
        onCreated={() => setModalSession(undefined)}
        session={modalSession ?? undefined}
        visible={modalSession !== undefined}
      />

      {deleteTarget && (
        <DeleteCatalogItemModal
          itemKind="sesión"
          itemName={deleteTarget.session.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          usageLabel="planes"
          usedIn={deleteTarget.usedIn}
          visible
        />
      )}

      {usageTarget && (
        <UsageListModal
          items={usageTarget.usedIn}
          onClose={() => setUsageTarget(null)}
          title={`"${usageTarget.session.name}" se usa en:`}
          visible
        />
      )}
    </>
  );
}
