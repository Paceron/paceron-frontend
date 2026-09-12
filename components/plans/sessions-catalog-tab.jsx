import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessions, useSessionMutations } from '../../hooks/use-sessions.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { SessionExercisesPreview } from './session-exercises-preview.jsx';
import { CreateSessionModal } from './create-session-modal.jsx';
import { DeleteCatalogItemModal } from './delete-catalog-item-modal.jsx';
import { UsageListModal } from './usage-list-modal.jsx';

// Planes (deduplicados por plan, no por día) que referencian esta
// sesión en alguno de sus días. Ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md.
export function plansUsingSession(sessionId, plans) {
  return plans.filter((p) => p.days.some((d) => d.sessionId === sessionId));
}

function SessionMenuButton({ session, onOpenMenu, containerRef }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, session);
      });
    });
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel="Más opciones"
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={`session-catalog-row-${session.id}-menu-toggle`}
      onPress={handlePress}
      testID={`session-catalog-row-${session.id}-menu-toggle`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
    </Pressable>
  );
}

function SessionActionsMenu({ session, onEdit, onClone, onDelete }) {
  const colors = useThemeColors();

  return (
    <View className="w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="session-catalog-menu-panel" testID="session-catalog-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="session-catalog-menu-edit"
        onPress={() => onEdit(session)}
        testID="session-catalog-menu-edit"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="session-catalog-menu-edit-label" testID="session-catalog-menu-edit-label">Editar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="session-catalog-menu-clone"
        onPress={() => onClone(session)}
        testID="session-catalog-menu-clone"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="content-copy" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="session-catalog-menu-clone-label" testID="session-catalog-menu-clone-label">Clonar</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="session-catalog-menu-delete"
        onPress={() => onDelete(session)}
        testID="session-catalog-menu-delete"
      >
        <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
        <Text className="text-sm text-red-600 dark:text-red-400" nativeID="session-catalog-menu-delete-label" testID="session-catalog-menu-delete-label">Eliminar</Text>
      </Pressable>
    </View>
  );
}

function SessionRow({ session, usedIn, onOpenMenu, onShowUsage, containerRef }) {
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
        <SessionMenuButton containerRef={containerRef} onOpenMenu={onOpenMenu} session={session} />
      </View>
      <SessionExercisesPreview session={session} />
    </View>
  );
}

export function SessionsCatalogTab() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { sessions, loading: sessionsLoading } = useSessions(userId);
  const { deleteSession, cloneSession } = useSessionMutations();
  useExercises(userId); // solo para precargar el cache que usa SessionExercisesPreview de cada fila
  const plans = useTrainingPlanStore((s) => s.plans);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);

  const [plansLoading, setPlansLoading] = useState(true);
  const [modalSession, setModalSession] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { session, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { session, usedIn }
  const containerRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null); // { anchor, session } | null
  const loading = sessionsLoading || plansLoading;

  const handleOpenMenu = (anchor, session) => setOpenMenu({ anchor, session });
  const handleCloseMenu = () => setOpenMenu(null);

  const handleCloneOne = async (session) => {
    handleCloseMenu();
    const result = await cloneSession({ ownerId: userId, sessionId: session.id });
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos clonar la sesión', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Sesión clonada' });
  };

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setPlansLoading(true);
    fetchPlans(userId).finally(() => { if (!cancelled) setPlansLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleDelete = async () => {
    const result = await deleteSession({ ownerId: userId, sessionId: deleteTarget.session.id });
    setDeleteTarget(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar la sesión', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Sesión eliminada' });
  };

  return (
    <View className="relative flex-1" nativeID="sessions-catalog-tab-root" ref={containerRef} testID="sessions-catalog-tab-root">
      <SectionCard
        headerRight={(
          <Pressable
            accessibilityLabel="Crear sesión"
            className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
            nativeID="sessions-catalog-create-button"
            onPress={() => setModalSession(null)}
            testID="sessions-catalog-create-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={22} />
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
                  containerRef={containerRef}
                  key={session.id}
                  onOpenMenu={handleOpenMenu}
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

      <AnimatedDropdown
        anchorStyle={openMenu ? { left: openMenu.anchor.x, top: openMenu.anchor.y + openMenu.anchor.height + 4, width: 192 } : {}}
        onClose={handleCloseMenu}
        open={Boolean(openMenu)}
      >
        {openMenu && (
          <SessionActionsMenu
            onClone={handleCloneOne}
            onDelete={(s) => { handleCloseMenu(); setDeleteTarget({ session: s, usedIn: plansUsingSession(s.id, plans) }); }}
            onEdit={(s) => { handleCloseMenu(); setModalSession(s); }}
            session={openMenu.session}
          />
        )}
      </AnimatedDropdown>

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
    </View>
  );
}
