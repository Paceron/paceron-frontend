import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useQueryClient } from '@tanstack/react-query';
import { useTeam } from '../../hooks/use-teams.js';
import { useGroups } from '../../hooks/use-groups.js';
import { useTeamInvitations, useInvitationMutations } from '../../hooks/use-invitations.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { SectionCard } from '../forms/section-card.jsx';
import { EmailInviteForm, InvitedEmailsList, UserSuggestionsList } from '../forms/fields.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { useEmailSuggestions } from '../../hooks/use-email-suggestions.js';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { RequireAuth } from '../guards/require-auth.jsx';

function PendingInviteRow({ groupName, invite }) {
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
        {groupName ? `${groupName} · ` : ''}Invitado {formatRelativeTime(invite.createdAt).toLowerCase()}
      </Text>
    </View>
  );
}

// Pantalla de gestión de invitaciones de un equipo ya existente (no
// confundir con el paso 3 del wizard de creación, que es un formulario más
// básico). Junta el listado real de invitaciones pendientes
// (GET /teams/{id}/invitations) y el formulario para invitar gente nueva
// (POST /teams/{id}/invite, con grupo opcional — ver docs/BACKEND_API_GAPS.md
// gap 9).
function InviteTeamMembersScreenContent({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { team, loading: loadingTeam } = useTeam(teamId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const { invitations, loading: loadingInvitations } = useTeamInvitations(teamId);
  const { sendInvite } = useInvitationMutations();

  // Raíz de la pantalla — ancla el AnimatedDropdown de sugerencias de
  // EmailInviteForm (ver hooks/use-email-suggestions.js).
  const containerRef = useRef(null);
  const emailSearch = useEmailSuggestions(containerRef);

  const [draftInvites, setDraftInvites] = useState([]);
  const [sending, setSending] = useState(false);

  const isDirty = useFormDirty({ hasDrafts: draftInvites.length > 0 });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['invitations', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['groups', teamId] }),
  ]));

  if (loadingTeam || loadingInvitations || loadingGroups) {
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
          onPress={() => guardedClose(() => router.back())}
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
      const result = await sendInvite({ teamId, email: invite.email, groupId: invite.groupId });
      if (!result.success) failed += 1;
    }
    setSending(false);
    setDraftInvites([]);
    if (failed > 0) {
      notifyError();
      Toast.show({ type: 'error', text1: 'Algunas invitaciones no se pudieron enviar', text2: `${failed} de ${draftInvites.length} fallaron.` });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Invitaciones enviadas' });
  };

  return (
    <View className="relative flex-1" nativeID="invite-team-screen-root" ref={containerRef} testID="invite-team-screen-root">
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="invite-team-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="invite-team-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="invite-team-screen-container" testID="invite-team-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="invite-team-screen-header" testID="invite-team-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="invite-team-screen-back-button"
            onPress={() => guardedClose(() => router.back())}
            testID="invite-team-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="invite-team-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="invite-team-screen-title">
            Invitar corredores
          </Text>
        </View>

        <SectionCard icon="email-check-outline" title="Solicitudes pendientes">
          {invitations.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="invite-pending-empty" testID="invite-pending-empty">
              Todavía no invitaste a nadie a este equipo.
            </Text>
          ) : (
            <View className="gap-2" nativeID="invite-pending-list" testID="invite-pending-list">
              {invitations.map((invite) => (
                <PendingInviteRow groupName={groups.find((g) => g.id === invite.groupId)?.name} invite={invite} key={invite.id} />
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard icon="account-plus-outline" title="Invitar más corredores">
          <EmailInviteForm emailSearch={emailSearch} existingEmails={draftInvites.map((invite) => invite.email)} groups={groups} onAdd={(invite) => setDraftInvites((prev) => [...prev, invite])} placeholder="Email del corredor" />
        </SectionCard>

        <SectionCard icon="account-multiple-check" title="Corredores a invitar">
          <InvitedEmailsList groups={groups} onChange={setDraftInvites} value={draftInvites} />

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
    <AnimatedDropdown
      anchorStyle={{ left: emailSearch.anchor.x, top: emailSearch.anchor.y + emailSearch.anchor.height + 4, width: emailSearch.anchor.width }}
      onClose={emailSearch.close}
      open={emailSearch.showSuggestions}
    >
      <UserSuggestionsList onSelect={emailSearch.selectSuggestion} scope="invite-team-invite" suggestions={emailSearch.suggestions} />
    </AnimatedDropdown>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </View>
  );
}

export function InviteTeamMembersScreen({ teamId }) {
  return (
    <RequireAuth>
      <InviteTeamMembersScreenContent teamId={teamId} />
    </RequireAuth>
  );
}
