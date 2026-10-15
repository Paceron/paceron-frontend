import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useCompetitions, useCompetitionMutations } from '../../hooks/use-competitions.js';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';
import { buildCompetitionTitle } from '../../utils/competition-title.js';
import { CreateCompetitionModal } from './create-competition-modal.jsx';
import { RejectCompetitionModal } from './reject-competition-modal.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

const STATUS_META = {
  pending_approval: { label: 'Pendiente de aprobación', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  active: { label: 'Activa', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  finished: { label: 'Finalizada', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  rejected: { label: 'Rechazada', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
};

// 3 cajones por status -- separa "qué está pasando ahora" (activas) de
// "qué necesita mi acción" (pendientes) de "qué ya pasó" (finalizadas +
// rechazadas), pedido real 2026-10-15: antes era una lista plana mezclando
// los 3 a la vez.
const SUB_TABS = [
  { id: 'active', icon: 'flag-checkered', label: 'Activas' },
  { id: 'pending', icon: 'clock-alert-outline', label: 'Pendientes' },
  { id: 'history', icon: 'history', label: 'Finalizadas' },
];

const EMPTY_MESSAGE = {
  active: 'No hay competencias activas en este equipo.',
  pending: 'No hay solicitudes pendientes de aprobación.',
  history: 'Todavía no hay competencias finalizadas.',
};

function metricLabel(metric) {
  return METRIC_OPTIONS.find((m) => m.id === metric)?.name ?? metric;
}

function memberName(members, userId) {
  return members.find((m) => m.userId === userId)?.name ?? 'Corredor';
}

// Pill estática (no Pressable, sin hover/active) a propósito -- pedido
// real: que no se confunda con un botón. Ganador: acento ámbar + trofeo,
// y el caller la ordena primero en la lista (ver sortedParticipantIds).
function ParticipantPill({ idPrefix, name, isWinner }) {
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${
        isWinner ? 'bg-amber-50 dark:bg-amber-900/15' : 'bg-slate-100 dark:bg-slate-800'
      }`}
      nativeID={idPrefix}
      testID={idPrefix}
    >
      {isWinner && <MaterialCommunityIcons color="#eab308" name="trophy" size={12} />}
      <Text
        className={`text-xs font-medium ${isWinner ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}
        nativeID={`${idPrefix}-name`}
        testID={`${idPrefix}-name`}
      >
        {name}
      </Text>
    </View>
  );
}

function CompetitionRow({ competition, members, isTrainerView, currentUserId, onApprove, onReject, onCancel, onClose, onRun, attemptBlocked, busy }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_META[competition.status] ?? STATUS_META.rejected;
  const idPrefix = `competitions-tab-row-${competition.id}`;

  const isOwnPendingProposal = competition.status === 'pending_approval' && competition.createdByRole === 'runner' && competition.createdByUserId === currentUserId;
  const canClose = isTrainerView && competition.status === 'active' && competition.endAt && competition.endAt < new Date().toISOString().slice(0, 10);
  const canRun = !isTrainerView && competition.type === 'route' && competition.status === 'active' && competition.participantUserIds.includes(currentUserId);
  const canApproveReject = isTrainerView && competition.status === 'pending_approval';
  const hasActions = canApproveReject || isOwnPendingProposal || canClose;

  const sortedParticipantIds = [...competition.participantUserIds].sort((a, b) => {
    const aWinner = competition.winnerUserIds.includes(a) ? 0 : 1;
    const bWinner = competition.winnerUserIds.includes(b) ? 0 : 1;
    return aWinner - bWinner;
  });

  return (
    <View className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <Pressable className="flex-row items-start gap-2" nativeID={`${idPrefix}-header`} onPress={() => setExpanded((v) => !v)} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-down' : 'chevron-right'} size={18} style={{ marginTop: 2 }} />
        <View className="flex-1" nativeID={`${idPrefix}-header-text`} testID={`${idPrefix}-header-text`}>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
            {competition.name ?? buildCompetitionTitle(competition)}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
            {metricLabel(competition.metric)} · {competition.startAt} → {competition.endAt}
          </Text>
        </View>
      </Pressable>

      {/* `flex-wrap` -- en mobile, si el badge + los botones no entran en
          una línea, el badge baja a su propia línea en vez de quedar
          tapado por los botones (pedido real: "manejar bien el caso de
          mobile que el badge se vea encima del botón"). */}
      <View className="ml-6 mt-2 flex-row flex-wrap items-center justify-between gap-2" nativeID={`${idPrefix}-status-row`} testID={`${idPrefix}-status-row`}>
        <View className={`rounded-full px-2 py-0.5 ${statusMeta.bg}`} nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
          <Text className={`text-xs font-semibold ${statusMeta.text}`} nativeID={`${idPrefix}-status-label`} testID={`${idPrefix}-status-label`}>
            {statusMeta.label}
          </Text>
        </View>

        {hasActions && (
          <View className="flex-row items-center gap-1.5" nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`}>
            {canApproveReject && (
              <>
                <IconTooltip align="end" idPrefix={`${idPrefix}-approve-tooltip`} label="Aprobar" position="bottom">
                  <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-emerald-100 active:opacity-70 disabled:opacity-60 dark:bg-emerald-900/30" disabled={busy} nativeID={`${idPrefix}-approve-button`} onPress={() => onApprove(competition.id)} testID={`${idPrefix}-approve-button`}>
                    <MaterialCommunityIcons color="#16a34a" name="check" size={18} />
                  </Pressable>
                </IconTooltip>
                <IconTooltip align="end" idPrefix={`${idPrefix}-reject-tooltip`} label="Rechazar" position="bottom">
                  <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-red-100 active:opacity-70 disabled:opacity-60 dark:bg-red-900/30" disabled={busy} nativeID={`${idPrefix}-reject-button`} onPress={() => onReject(competition.id)} testID={`${idPrefix}-reject-button`}>
                    <MaterialCommunityIcons color="#ef4444" name="close" size={18} />
                  </Pressable>
                </IconTooltip>
              </>
            )}
            {isOwnPendingProposal && (
              <IconTooltip align="end" idPrefix={`${idPrefix}-cancel-tooltip`} label="Cancelar propuesta" position="bottom">
                <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-red-100 active:opacity-70 disabled:opacity-60 dark:bg-red-900/30" disabled={busy} nativeID={`${idPrefix}-cancel-button`} onPress={() => onCancel(competition.id)} testID={`${idPrefix}-cancel-button`}>
                  <MaterialCommunityIcons color="#ef4444" name="close" size={18} />
                </Pressable>
              </IconTooltip>
            )}
            {canClose && (
              <IconTooltip align="end" idPrefix={`${idPrefix}-close-tooltip`} label="Cerrar competencia" position="bottom">
                <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-amber-100 active:opacity-70 disabled:opacity-60 dark:bg-amber-900/30" disabled={busy} nativeID={`${idPrefix}-close-button`} onPress={() => onClose(competition.id)} testID={`${idPrefix}-close-button`}>
                  <MaterialCommunityIcons color="#d97706" name="flag-checkered" size={18} />
                </Pressable>
              </IconTooltip>
            )}
          </View>
        )}
      </View>

      {expanded && (
        <View className="ml-6 mt-3 flex-row flex-wrap gap-1.5" nativeID={`${idPrefix}-participants`} testID={`${idPrefix}-participants`}>
          {sortedParticipantIds.map((userId) => (
            <ParticipantPill idPrefix={`${idPrefix}-participant-${userId}`} isWinner={competition.winnerUserIds.includes(userId)} key={userId} name={memberName(members, userId)} />
          ))}
          {competition.status === 'finished' && competition.winnerUserIds.length === 0 && (
            <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-no-winner`} testID={`${idPrefix}-no-winner`}>
              Sin ganador — nadie completó un intento.
            </Text>
          )}
        </View>
      )}

      {canRun && (
        <View className="ml-6 mt-3" nativeID={`${idPrefix}-run-row`} testID={`${idPrefix}-run-row`}>
          {isWeb ? (
            <Text className="self-start rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" nativeID={`${idPrefix}-run-web-notice`} testID={`${idPrefix}-run-web-notice`}>
              Correr una trayectoria solo está disponible en la app nativa
            </Text>
          ) : (
            <Pressable className="h-9 items-center justify-center self-start rounded-full bg-primary px-4 active:opacity-80 disabled:opacity-60" disabled={busy || attemptBlocked} nativeID={`${idPrefix}-run-button`} onPress={() => onRun(competition)} testID={`${idPrefix}-run-button`}>
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-run-label`} testID={`${idPrefix}-run-label`}>
                {attemptBlocked ? 'Ya corriste esta trayectoria' : 'Correr esta trayectoria'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export function CompetitionsTab({ teamId, members, groups, isTrainerView, currentUserId }) {
  const colors = useThemeColors();
  const router = useRouter();
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);
  const { competitions, loading, error } = useCompetitions(teamId);
  const mutations = useCompetitionMutations(teamId);
  const { ackSection } = useGamificationBadge();
  const [createVisible, setCreateVisible] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [subTab, setSubTab] = useState('active');
  // Sin intento previo barato de consultar en v1 (Gap 33 punto 26, spec
  // "Entry point") -- el 400 del backend es la fuente de verdad, esto solo
  // deshabilita el botón localmente DESPUÉS de un primer intento exitoso o
  // fallido por "ya tenés intento", para esta sesión de la app.
  const [blockedCompetitionIds, setBlockedCompetitionIds] = useState([]);

  useEffect(() => {
    ackSection('competitions', teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, mismo criterio que achievements-screen.jsx (Spec 1)
  }, []);

  const handleApprove = async (id) => {
    const result = await mutations.approveCompetition(id);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Competencia aprobada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos aprobar la competencia', text2: result.error }); }
  };

  const handleRejectConfirm = async (reason) => {
    const result = await mutations.rejectCompetition(rejectTargetId, reason);
    setRejectTargetId(null);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Competencia rechazada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos rechazar la competencia', text2: result.error }); }
  };

  const handleCancel = async (id) => {
    const result = await mutations.cancelCompetition(id);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Propuesta cancelada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos cancelar la propuesta', text2: result.error }); }
  };

  const handleClose = async (id) => {
    const result = await mutations.closeCompetition(id);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Competencia cerrada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos cerrar la competencia', text2: result.error }); }
  };

  const handleRun = async (competition) => {
    const result = await mutations.createCompetitionAttempt(competition.id, currentUserId);
    if (!result.success) {
      setBlockedCompetitionIds((prev) => [...prev, competition.id]);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos arrancar el intento', text2: result.error });
      return;
    }
    setPendingSession({
      teamId,
      date: new Date().toISOString().slice(0, 10),
      sessionInstance: result.data.session_instance,
      routeAttempt: { route: competition.route, acceptanceRadiusMeters: competition.acceptanceRadiusMeters, competitionId: competition.id },
    });
    router.push('/training-session');
  };

  const busy = mutations.isApproving || mutations.isRejecting || mutations.isCancelling || mutations.isClosing;

  const listByTab = {
    active: competitions.filter((c) => c.status === 'active'),
    pending: competitions.filter((c) => c.status === 'pending_approval'),
    history: competitions.filter((c) => c.status === 'finished' || c.status === 'rejected'),
  };
  const visibleList = listByTab[subTab];

  return (
    <View nativeID="competitions-tab-root" testID="competitions-tab-root">
      <View className="mb-4 flex-row items-center justify-between" nativeID="competitions-tab-header" testID="competitions-tab-header">
        <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID="competitions-tab-title" testID="competitions-tab-title">
          Competencias
        </Text>
        <IconTooltip align="end" idPrefix="competitions-tab-create-tooltip" label="Nueva competencia" position="bottom">
          <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80" nativeID="competitions-tab-create-button" onPress={() => setCreateVisible(true)} testID="competitions-tab-create-button">
            <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={20} />
          </Pressable>
        </IconTooltip>
      </View>

      <TabBar active={subTab} badges={{ pending: listByTab.pending.length > 0 }} onChange={setSubTab} scope="competitions-tab-subtabs" tabs={SUB_TABS} />

      {loading && (
        <View className="items-center py-6" nativeID="competitions-tab-loading" testID="competitions-tab-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!loading && error && (
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="competitions-tab-error" testID="competitions-tab-error">
          No pudimos cargar las competencias.
        </Text>
      )}

      {!loading && !error && visibleList.length === 0 && (
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="competitions-tab-empty" testID="competitions-tab-empty">
          {EMPTY_MESSAGE[subTab]}
        </Text>
      )}

      {!loading && !error && visibleList.length > 0 && (
        <View className="gap-3" nativeID="competitions-tab-list" testID="competitions-tab-list">
          {visibleList.map((competition) => (
            <CompetitionRow
              attemptBlocked={blockedCompetitionIds.includes(competition.id)}
              busy={busy}
              competition={competition}
              currentUserId={currentUserId}
              isTrainerView={isTrainerView}
              key={competition.id}
              members={members}
              onApprove={handleApprove}
              onCancel={handleCancel}
              onClose={handleClose}
              onRun={handleRun}
              onReject={setRejectTargetId}
            />
          ))}
        </View>
      )}

      <CreateCompetitionModal
        groups={groups}
        members={members}
        onClose={() => setCreateVisible(false)}
        onSubmit={mutations.createCompetition}
        visible={createVisible}
      />
      <RejectCompetitionModal
        onClose={() => setRejectTargetId(null)}
        onConfirm={handleRejectConfirm}
        visible={rejectTargetId != null}
      />
    </View>
  );
}
