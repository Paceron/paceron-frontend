import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useMyJoinRequests, useJoinRequestMutations, useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Sin nombre de grupo: InvitationResponse trae group_id pero no
// group_name — mismo criterio ya documentado en el
// received-invitations-screen.jsx original (ver docs/BACKEND_API_GAPS.md
// gap 9). Este componente es ese mismo row, relocado acá sin cambios.
function ReceivedInvitationRow({ invite, onAccept, onReject, responding }) {
  const colors = useThemeColors();
  const slug = invite.id;

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`received-invitation-${slug}`}
      testID={`received-invitation-${slug}`}
    >
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`received-invitation-${slug}-team`} testID={`received-invitation-${slug}-team`}>
        {invite.teamName ?? 'Equipo'}
      </Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`received-invitation-${slug}-meta`} testID={`received-invitation-${slug}-meta`}>
        {invite.inviterName ? `Invitado por ${invite.inviterName} · ` : 'Invitado '}
        {formatRelativeTime(invite.createdAt).toLowerCase()}
      </Text>
      <View className="flex-row gap-2" nativeID={`received-invitation-${slug}-actions`} testID={`received-invitation-${slug}-actions`}>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
          disabled={responding}
          nativeID={`received-invitation-${slug}-accept-button`}
          onPress={onAccept}
          testID={`received-invitation-${slug}-accept-button`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="check" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`received-invitation-${slug}-accept-button-label`} testID={`received-invitation-${slug}-accept-button-label`}>
            Aceptar
          </Text>
        </Pressable>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-80 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={responding}
          nativeID={`received-invitation-${slug}-reject-button`}
          onPress={onReject}
          testID={`received-invitation-${slug}-reject-button`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`received-invitation-${slug}-reject-button-label`} testID={`received-invitation-${slug}-reject-button-label`}>
            Rechazar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Fila de "mis solicitudes enviadas" (corredor) — sin accept/reject (eso
// lo resuelve el entrenador), solo estado + cancelar si sigue pending.
function SentJoinRequestRow({ request, onCancel, cancelling }) {
  const colors = useThemeColors();
  const STATUS_LABEL = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada' };

  return (
    <View
      className="flex-row items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`sent-join-request-${request.id}`}
      testID={`sent-join-request-${request.id}`}
    >
      <View className="flex-1" nativeID={`sent-join-request-${request.id}-info`} testID={`sent-join-request-${request.id}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`sent-join-request-${request.id}-team`} testID={`sent-join-request-${request.id}-team`}>
          {request.teamName ?? 'Equipo'}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`sent-join-request-${request.id}-status`} testID={`sent-join-request-${request.id}-status`}>
          {STATUS_LABEL[request.status] ?? request.status} · {formatRelativeTime(request.createdAt).toLowerCase()}
        </Text>
      </View>
      {request.status === 'pending' && (
        <Pressable
          className="h-9 flex-row items-center justify-center rounded-full border border-slate-200 px-3 hover:bg-slate-100 active:opacity-80 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={cancelling}
          nativeID={`sent-join-request-${request.id}-cancel-button`}
          onPress={onCancel}
          testID={`sent-join-request-${request.id}-cancel-button`}
        >
          {cancelling ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : (
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`sent-join-request-${request.id}-cancel-label`} testID={`sent-join-request-${request.id}-cancel-label`}>
              Cancelar
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// Sección "Mis solicitudes enviadas" — solo corredor. Colapsable, como
// las demás secciones de esta pantalla, para no saturar si hay mucho
// contenido.
function MyJoinRequestsSection() {
  const colors = useThemeColors();
  const { requests, loading } = useMyJoinRequests();
  const { cancelJoinRequest, isCancelling } = useJoinRequestMutations();
  const [cancellingId, setCancellingId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleCancel = async (requestId) => {
    setCancellingId(requestId);
    try {
      await cancelJoinRequest(requestId);
      Toast.show({ type: 'success', text1: 'Solicitud cancelada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos cancelar la solicitud', text2: error.message });
    }
    setCancellingId(null);
  };

  return (
    <SectionCard collapsed={collapsed} collapsible icon="account-clock-outline" onToggle={() => setCollapsed((v) => !v)} title="Mis solicitudes enviadas">
      {loading ? (
        <View className="items-center py-6" nativeID="my-join-requests-loading" testID="my-join-requests-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="my-join-requests-empty" testID="my-join-requests-empty">
          No enviaste solicitudes para unirte a ningún equipo.
        </Text>
      ) : (
        <View className="gap-2" nativeID="my-join-requests-list" testID="my-join-requests-list">
          {requests.map((request) => (
            <SentJoinRequestRow
              cancelling={isCancelling && cancellingId === request.id}
              key={request.id}
              onCancel={() => handleCancel(request.id)}
              request={request}
            />
          ))}
        </View>
      )}
    </SectionCard>
  );
}

// Sección "Solicitudes pendientes" (agregado de equipos administrados) —
// solo entrenador. Cada ítem linkea a la tab Solicitudes del equipo
// correspondiente (?tab=solicitudes, ver Task 11). Colapsable, mismo
// criterio que las demás secciones.
function TrainerPendingRequestsSection() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const teams = useTeamStore((s) => s.teams);
  const administeredTeamIds = selectAdministeredTeams(teams, user?.userId).map((t) => t.id);
  const { byTeamId, loading } = useTeamsJoinRequestsMap(administeredTeamIds);
  const [collapsed, setCollapsed] = useState(false);

  const allPending = administeredTeamIds.flatMap((teamId) => byTeamId.get(teamId) ?? []);

  return (
    <SectionCard collapsed={collapsed} collapsible icon="account-question-outline" onToggle={() => setCollapsed((v) => !v)} title="Solicitudes pendientes">
      {loading ? (
        <View className="items-center py-6" nativeID="trainer-pending-requests-loading" testID="trainer-pending-requests-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : allPending.length === 0 ? (
        <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="trainer-pending-requests-empty" testID="trainer-pending-requests-empty">
          No tenés solicitudes de ingreso pendientes.
        </Text>
      ) : (
        <View className="gap-2" nativeID="trainer-pending-requests-list" testID="trainer-pending-requests-list">
          {allPending.map((request) => (
            <Pressable
              className="flex-row items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              key={request.id}
              nativeID={`trainer-pending-request-${request.id}`}
              onPress={() => router.push(`/teams/${request.teamId}?tab=solicitudes`)}
              testID={`trainer-pending-request-${request.id}`}
            >
              <View className="flex-1" nativeID={`trainer-pending-request-${request.id}-info`} testID={`trainer-pending-request-${request.id}-info`}>
                <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`trainer-pending-request-${request.id}-runner`} testID={`trainer-pending-request-${request.id}-runner`}>
                  {request.runnerName ?? 'Corredor'}
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`trainer-pending-request-${request.id}-team`} testID={`trainer-pending-request-${request.id}-team`}>
                  Quiere unirse a {request.teamName ?? 'tu equipo'}
                </Text>
              </View>
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
            </Pressable>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

function NotificationsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const myInvitations = useTeamStore((s) => s.myInvitations);
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const acceptMyInvitation = useTeamStore((s) => s.acceptMyInvitation);
  const rejectMyInvitation = useTeamStore((s) => s.rejectMyInvitation);

  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [invitationsCollapsed, setInvitationsCollapsed] = useState(false);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingInvitations(true);
    fetchMyInvitations(user.userId, user.email).finally(() => { if (!cancelled) setLoadingInvitations(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.email]);

  const handleAccept = async (invitationId) => {
    setRespondingId(invitationId);
    const result = await acceptMyInvitation(invitationId, user.userId);
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos aceptar la invitación', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Te uniste al equipo' });
  };

  const handleReject = async (invitationId) => {
    setRespondingId(invitationId);
    const result = await rejectMyInvitation(invitationId, user.userId);
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos rechazar la invitación', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Invitación rechazada' });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="notifications-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="notifications-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="notifications-screen-container" testID="notifications-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="notifications-screen-header" testID="notifications-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="notifications-screen-back-button"
            onPress={() => router.back()}
            testID="notifications-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="notifications-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="notifications-screen-title">
            Notificaciones
          </Text>
        </View>

        <SectionCard collapsed={invitationsCollapsed} collapsible icon="email-outline" onToggle={() => setInvitationsCollapsed((v) => !v)} title="Invitaciones recibidas">
          {loadingInvitations ? (
            <View className="items-center py-6" nativeID="received-invitations-loading" testID="received-invitations-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : myInvitations.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="received-invitations-empty" testID="received-invitations-empty">
              No tenés invitaciones pendientes.
            </Text>
          ) : (
            <View className="gap-2" nativeID="received-invitations-list" testID="received-invitations-list">
              {myInvitations.map((invite) => (
                <ReceivedInvitationRow
                  invite={invite}
                  key={invite.id}
                  onAccept={() => handleAccept(invite.id)}
                  onReject={() => handleReject(invite.id)}
                  responding={respondingId === invite.id}
                />
              ))}
            </View>
          )}
        </SectionCard>

        {activeRole === 'runner' && <MyJoinRequestsSection />}
        {activeRole === 'trainer' && <TrainerPendingRequestsSection />}
      </View>
    </ScrollView>
  );
}

export function NotificationsScreen() {
  return (
    <RequireAuth>
      <NotificationsScreenContent />
    </RequireAuth>
  );
}
