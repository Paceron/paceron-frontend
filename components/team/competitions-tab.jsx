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
import { notifySuccess, notifyError } from '../../utils/haptics.js';

const STATUS_META = {
  pending_approval: { label: 'Pendiente de aprobación', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  active: { label: 'Activa', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  finished: { label: 'Finalizada', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  rejected: { label: 'Rechazada', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
};

function metricLabel(metric) {
  return METRIC_OPTIONS.find((m) => m.id === metric)?.name ?? metric;
}

function memberName(members, userId) {
  return members.find((m) => m.userId === userId)?.name ?? 'Corredor';
}

function CompetitionRow({ competition, members, isTrainerView, currentUserId, onApprove, onReject, onCancel, onClose, onRun, attemptBlocked, busy }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_META[competition.status] ?? STATUS_META.rejected;
  const idPrefix = `competitions-tab-row-${competition.id}`;

  const isOwnPendingProposal = competition.status === 'pending_approval' && competition.createdByRole === 'runner' && competition.createdByUserId === currentUserId;
  const canClose = isTrainerView && competition.status === 'active' && competition.endAt && competition.endAt < new Date().toISOString().slice(0, 10);
  const canRun = !isTrainerView && competition.type === 'route' && competition.status === 'active' && competition.participantUserIds.includes(currentUserId);

  return (
    <View className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <Pressable className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} onPress={() => setExpanded((v) => !v)} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-down' : 'chevron-right'} size={18} />
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {competition.name ?? buildCompetitionTitle(competition)}
        </Text>
        <View className={`rounded-full px-2 py-0.5 ${statusMeta.bg}`} nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
          <Text className={`text-xs font-semibold ${statusMeta.text}`} nativeID={`${idPrefix}-status-label`} testID={`${idPrefix}-status-label`}>
            {statusMeta.label}
          </Text>
        </View>
      </Pressable>

      <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
        {metricLabel(competition.metric)} · {competition.startAt} → {competition.endAt}
      </Text>

      {expanded && (
        <View className="mt-3 gap-1" nativeID={`${idPrefix}-participants`} testID={`${idPrefix}-participants`}>
          {competition.participantUserIds.map((userId) => {
            const isWinner = competition.winnerUserIds.includes(userId);
            return (
              <View className="flex-row items-center gap-1.5" key={userId} nativeID={`${idPrefix}-participant-${userId}`} testID={`${idPrefix}-participant-${userId}`}>
                {isWinner && <MaterialCommunityIcons color="#eab308" name="trophy" size={14} />}
                <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-participant-${userId}-name`} testID={`${idPrefix}-participant-${userId}-name`}>
                  {memberName(members, userId)}
                </Text>
              </View>
            );
          })}
          {competition.status === 'finished' && competition.winnerUserIds.length === 0 && (
            <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-no-winner`} testID={`${idPrefix}-no-winner`}>
              Sin ganador — nadie completó un intento.
            </Text>
          )}
        </View>
      )}

      <View className="mt-3 flex-row gap-2" nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`}>
        {isTrainerView && competition.status === 'pending_approval' && (
          <>
            <Pressable className="h-9 flex-1 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-60" disabled={busy} nativeID={`${idPrefix}-approve-button`} onPress={() => onApprove(competition.id)} testID={`${idPrefix}-approve-button`}>
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-approve-label`} testID={`${idPrefix}-approve-label`}>Aprobar</Text>
            </Pressable>
            <Pressable className="h-9 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-80 disabled:opacity-60 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-reject-button`} onPress={() => onReject(competition.id)} testID={`${idPrefix}-reject-button`}>
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-reject-label`} testID={`${idPrefix}-reject-label`}>Rechazar</Text>
            </Pressable>
          </>
        )}
        {isOwnPendingProposal && (
          <Pressable className="h-9 flex-1 items-center justify-center rounded-full border border-red-200 active:opacity-80 disabled:opacity-60 dark:border-red-900/40" disabled={busy} nativeID={`${idPrefix}-cancel-button`} onPress={() => onCancel(competition.id)} testID={`${idPrefix}-cancel-button`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400" nativeID={`${idPrefix}-cancel-label`} testID={`${idPrefix}-cancel-label`}>Cancelar</Text>
          </Pressable>
        )}
        {canClose && (
          <Pressable className="h-9 flex-1 items-center justify-center rounded-full border border-amber-300 active:opacity-80 disabled:opacity-60 dark:border-amber-700" disabled={busy} nativeID={`${idPrefix}-close-button`} onPress={() => onClose(competition.id)} testID={`${idPrefix}-close-button`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-close-label`} testID={`${idPrefix}-close-label`}>Cerrar</Text>
          </Pressable>
        )}
        {canRun && isWeb && (
          <Text className="flex-1 rounded-full bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" nativeID={`${idPrefix}-run-web-notice`} testID={`${idPrefix}-run-web-notice`}>
            Correr una trayectoria solo está disponible en la app nativa
          </Text>
        )}
        {canRun && !isWeb && (
          <Pressable className="h-9 flex-1 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-60" disabled={busy || attemptBlocked} nativeID={`${idPrefix}-run-button`} onPress={() => onRun(competition)} testID={`${idPrefix}-run-button`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-run-label`} testID={`${idPrefix}-run-label`}>
              {attemptBlocked ? 'Ya corriste esta trayectoria' : 'Correr esta trayectoria'}
            </Text>
          </Pressable>
        )}
      </View>
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

  return (
    <View nativeID="competitions-tab-root" testID="competitions-tab-root">
      <Pressable className="mb-4 h-10 flex-row items-center justify-center gap-1.5 self-start rounded-full bg-primary px-4 active:opacity-80" nativeID="competitions-tab-create-button" onPress={() => setCreateVisible(true)} testID="competitions-tab-create-button">
        <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={16} />
        <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="competitions-tab-create-label" testID="competitions-tab-create-label">Nueva competencia</Text>
      </Pressable>

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

      {!loading && !error && competitions.length === 0 && (
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="competitions-tab-empty" testID="competitions-tab-empty">
          Todavía no hay competencias en este equipo.
        </Text>
      )}

      {!loading && !error && competitions.length > 0 && (
        <View className="gap-3" nativeID="competitions-tab-list" testID="competitions-tab-list">
          {competitions.map((competition) => (
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
