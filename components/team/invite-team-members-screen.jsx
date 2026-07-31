import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useTeamStore } from '../../store/team-store.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { EmailListField } from '../forms/fields.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function PendingInviteRow({ invite }) {
  const slug = invite.email.replace(/[^a-z0-9]+/gi, '-');

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`invite-pending-${slug}`}
      testID={`invite-pending-${slug}`}
    >
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`invite-pending-${slug}-email`} numberOfLines={1} testID={`invite-pending-${slug}-email`}>
        {invite.email}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`invite-pending-${slug}-meta`} testID={`invite-pending-${slug}-meta`}>
        Invitado {formatRelativeTime(invite.createdAt).toLowerCase()}
      </Text>
    </View>
  );
}

// Pantalla de gestión de invitaciones de un equipo ya existente (no
// confundir con el paso 3 del wizard de creación, que es un formulario más
// básico). Junta el listado real de invitaciones pendientes
// (GET /teams/{id}/invitations) y el formulario para invitar gente nueva
// (POST /teams/{id}/invite, solo email — el backend no acepta asignar
// grupo al invitar, ver docs/BACKEND_API_GAPS.md gap 9).
function InviteTeamMembersScreenContent({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const fetchInvitations = useTeamStore((s) => s.fetchInvitations);
  const sendInvite = useTeamStore((s) => s.sendInvite);

  const [draftInvites, setDraftInvites] = useState([]);
  const [sending, setSending] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(!team);
  const [loadingInvitations, setLoadingInvitations] = useState(true);

  // Entrar por deep-link (ej. recargar /teams/{id}/invite directo) puede
  // caer acá antes de que el equipo esté en el store — fetchTeam lo trae
  // puntual.
  useEffect(() => {
    if (team) {
      setLoadingTeam(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingTeam(true);
    fetchTeam(teamId).finally(() => { if (!cancelled) setLoadingTeam(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingInvitations(true);
    fetchInvitations(teamId).finally(() => { if (!cancelled) setLoadingInvitations(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (loadingTeam || loadingInvitations) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="invite-team-loading" testID="invite-team-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="invite-team-not-found" testID="invite-team-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="invite-team-not-found-label" testID="invite-team-not-found-label">
          No encontramos este equipo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="invite-team-not-found-back-button"
          onPress={() => router.back()}
          testID="invite-team-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-team-not-found-back-button-label" testID="invite-team-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleSendInvites = async () => {
    if (draftInvites.length === 0 || sending) return;
    setSending(true);
    let failed = 0;
    for (const invite of draftInvites) {
      const result = await sendInvite(teamId, invite.email);
      if (!result.success) failed += 1;
    }
    setSending(false);
    setDraftInvites([]);
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunas invitaciones no se pudieron enviar', text2: `${failed} de ${draftInvites.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: 'Invitaciones enviadas' });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="invite-team-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="invite-team-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="invite-team-screen-container" testID="invite-team-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="invite-team-screen-header" testID="invite-team-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="invite-team-screen-back-button"
            onPress={() => router.back()}
            testID="invite-team-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="invite-team-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="invite-team-screen-title">
            Invitar corredores
          </Text>
        </View>

        <SectionCard icon="email-check-outline" title="Solicitudes pendientes">
          {team.invitations.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="invite-pending-empty" testID="invite-pending-empty">
              Todavía no invitaste a nadie a este equipo.
            </Text>
          ) : (
            <View className="gap-2" nativeID="invite-pending-list" testID="invite-pending-list">
              {team.invitations.map((invite) => (
                <PendingInviteRow invite={invite} key={invite.id} />
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard icon="account-plus-outline" title="Invitar más corredores">
          <EmailListField label="Email del corredor" onChange={setDraftInvites} value={draftInvites} />

          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={sending}
            nativeID="invite-team-send-button"
            onPress={handleSendInvites}
            testID="invite-team-send-button"
          >
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="send-outline" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-team-send-button-label" testID="invite-team-send-button-label">
                  Enviar invitaciones
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function InviteTeamMembersScreen({ teamId }) {
  return (
    <RequireAuth>
      <InviteTeamMembersScreenContent teamId={teamId} />
    </RequireAuth>
  );
}
