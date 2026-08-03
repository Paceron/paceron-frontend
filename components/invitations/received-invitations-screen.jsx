import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore } from '../../store/team-store.js';
import { getTeam } from '../../services/teams.js';
import { getUser } from '../../services/auth.js';
import { toUserModel } from '../../services/normalizers.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Sin nombre de grupo: InvitationResponse trae group_id pero no
// group_name, y el invitado no puede resolverlo contra GET /groups (esa
// ruta valida membresía, que todavía no tiene). Ver
// docs/BACKEND_API_GAPS.md gap 9 y la decisión del usuario (2026-07-31):
// se muestra solo equipo + fecha, sin inventar un nombre de grupo.
//
// El nombre de quién invita tampoco viene directo en InvitationResponse
// (no trae inviter_id/inviter_name) — se resuelve acá con lo que ya
// existe: GET /teams/{id} (público, sin chequeo de membresía) da el
// owner_id, y GET /auth/user?id= el nombre. 2 requests extra por
// invitación mostrada; sería más barato si el backend sumara
// inviter_name directo al InvitationResponse, pero no bloquea — se
// documenta como sugerencia, no como gap.
function ReceivedInvitationRow({ invite, onAccept, onReject, responding }) {
  const colors = useThemeColors();
  const slug = invite.id;

  const inviterQuery = useQuery({
    queryKey: ['team-owner-name', invite.teamId],
    queryFn: async () => {
      const team = await getTeam(invite.teamId);
      if (!team?.owner_id) return null;
      const userDto = await getUser({ id: team.owner_id });
      const owner = toUserModel(userDto);
      return `${owner.name ?? ''} ${owner.surname ?? ''}`.trim() || owner.email;
    },
    enabled: Boolean(invite.teamId),
  });

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
        {inviterQuery.data ? `Invitado por ${inviterQuery.data} · ` : 'Invitado '}
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

function ReceivedInvitationsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const myInvitations = useTeamStore((s) => s.myInvitations);
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const acceptMyInvitation = useTeamStore((s) => s.acceptMyInvitation);
  const rejectMyInvitation = useTeamStore((s) => s.rejectMyInvitation);

  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyInvitations(user.userId, user.email).finally(() => { if (!cancelled) setLoading(false); });
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
      nativeID="received-invitations-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="received-invitations-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="received-invitations-screen-container" testID="received-invitations-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="received-invitations-screen-header" testID="received-invitations-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="received-invitations-screen-back-button"
            onPress={() => router.back()}
            testID="received-invitations-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="received-invitations-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="received-invitations-screen-title">
            Invitaciones recibidas
          </Text>
        </View>

        <SectionCard icon="email-outline" title="Solicitudes pendientes">
          {loading ? (
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
      </View>
    </ScrollView>
  );
}

export function ReceivedInvitationsScreen() {
  return (
    <RequireAuth>
      <ReceivedInvitationsScreenContent />
    </RequireAuth>
  );
}
