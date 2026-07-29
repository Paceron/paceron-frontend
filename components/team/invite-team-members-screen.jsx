import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useTeamStore } from '../../store/team-store.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { EmailListField } from '../forms/fields.jsx';

const REGISTERED_META = {
  registered: { label: 'Usuario registrado', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  unregistered: { label: 'Sin registrar', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-200' },
};

function PendingInviteRow({ invite, groupName }) {
  const meta = invite.registered ? REGISTERED_META.registered : REGISTERED_META.unregistered;
  const slug = invite.email.replace(/[^a-z0-9]+/gi, '-');

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`invite-pending-${slug}`}
      testID={`invite-pending-${slug}`}
    >
      <View className="mb-1.5 flex-row items-start justify-between gap-2" nativeID={`invite-pending-${slug}-header`} testID={`invite-pending-${slug}-header`}>
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`invite-pending-${slug}-email`} numberOfLines={1} testID={`invite-pending-${slug}-email`}>
          {invite.email}
        </Text>
        <View className={`rounded-full px-2.5 py-1 ${meta.bg}`} nativeID={`invite-pending-${slug}-registered-tag`} testID={`invite-pending-${slug}-registered-tag`}>
          <Text className={`text-xs font-semibold ${meta.text}`} nativeID={`invite-pending-${slug}-registered-tag-label`} testID={`invite-pending-${slug}-registered-tag-label`}>{meta.label}</Text>
        </View>
      </View>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`invite-pending-${slug}-meta`} testID={`invite-pending-${slug}-meta`}>
        {groupName} · Invitado {formatRelativeTime(invite.invitedAt).toLowerCase()}
      </Text>
    </View>
  );
}

// Pantalla de gestión de invitaciones de un equipo ya existente (no
// confundir con el paso 3 del wizard de creación, que sigue siendo un
// formulario básico). Junta dos cosas en un solo lugar: el listado de
// invitaciones pendientes ya mandadas (más presentable que los chips
// simples del wizard — muestra grupo, hace cuánto se invitó, y si el
// email corresponde a un usuario ya registrado en la app o no) y el
// formulario para invitar gente nueva, reusando EmailListField.
export function InviteTeamMembersScreen({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const addInvitedEmails = useTeamStore((s) => s.addInvitedEmails);

  const [draftInvites, setDraftInvites] = useState([]);

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

  const handleSendInvites = () => {
    if (draftInvites.length === 0) return;
    addInvitedEmails(teamId, draftInvites);
    setDraftInvites([]);
    Toast.show({ type: 'success', text1: 'Invitaciones enviadas', text2: 'Se van a mandar cuando el backend de equipos esté disponible.' });
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
          {team.invitedEmails.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="invite-pending-empty" testID="invite-pending-empty">
              Todavía no invitaste a nadie a este equipo.
            </Text>
          ) : (
            <View className="gap-2" nativeID="invite-pending-list" testID="invite-pending-list">
              {team.invitedEmails.map((invite) => (
                <PendingInviteRow groupName={team.groups.find((g) => g.id === invite.groupId)?.name ?? '—'} invite={invite} key={invite.email} />
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard icon="account-plus-outline" title="Invitar más corredores">
          <EmailListField groups={team.groups} label="Email del corredor" onChange={setDraftInvites} value={draftInvites} />

          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80"
            nativeID="invite-team-send-button"
            onPress={handleSendInvites}
            testID="invite-team-send-button"
          >
            <MaterialCommunityIcons color={colors.onPrimary} name="send-outline" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-team-send-button-label" testID="invite-team-send-button-label">
              Enviar invitaciones
            </Text>
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}
