import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { useTeamJoinRequests, useJoinRequestMutations } from '../../hooks/use-join-requests.js';

// Tab "Solicitudes" del entrenador dueño — aceptar/rechazar, tap directo
// sin modal de confirmación (mismo patrón que
// received-invitations-screen.jsx/notifications-screen.jsx).
function JoinRequestRow({ request, onAccept, onReject, responding }) {
  const colors = useThemeColors();

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`team-request-${request.id}`}
      testID={`team-request-${request.id}`}
    >
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`team-request-${request.id}-runner`} testID={`team-request-${request.id}-runner`}>
        {request.runnerName ?? 'Corredor'}
      </Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`team-request-${request.id}-meta`} testID={`team-request-${request.id}-meta`}>
        Pidió unirse {formatRelativeTime(request.createdAt).toLowerCase()}
      </Text>
      <View className="flex-row gap-2" nativeID={`team-request-${request.id}-actions`} testID={`team-request-${request.id}-actions`}>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
          disabled={responding}
          nativeID={`team-request-${request.id}-accept-button`}
          onPress={onAccept}
          testID={`team-request-${request.id}-accept-button`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="check" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`team-request-${request.id}-accept-button-label`} testID={`team-request-${request.id}-accept-button-label`}>
            Aceptar
          </Text>
        </Pressable>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-80 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={responding}
          nativeID={`team-request-${request.id}-reject-button`}
          onPress={onReject}
          testID={`team-request-${request.id}-reject-button`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`team-request-${request.id}-reject-button-label`} testID={`team-request-${request.id}-reject-button-label`}>
            Rechazar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TeamRequestsTab({ teamId }) {
  const colors = useThemeColors();
  const { requests, loading } = useTeamJoinRequests(teamId);
  const { acceptJoinRequest, rejectJoinRequest, isAccepting, isRejecting } = useJoinRequestMutations();
  const [respondingId, setRespondingId] = useState(null);

  const handleAccept = async (requestId) => {
    setRespondingId(requestId);
    try {
      await acceptJoinRequest(requestId);
      Toast.show({ type: 'success', text1: 'Corredor aceptado' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos aceptar la solicitud', text2: error.message });
    }
    setRespondingId(null);
  };

  const handleReject = async (requestId) => {
    setRespondingId(requestId);
    try {
      await rejectJoinRequest(requestId);
      Toast.show({ type: 'success', text1: 'Solicitud rechazada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos rechazar la solicitud', text2: error.message });
    }
    setRespondingId(null);
  };

  return (
    <SectionCard icon="account-question-outline" title="Solicitudes">
      {loading ? (
        <View className="items-center py-6" nativeID="team-requests-tab-loading" testID="team-requests-tab-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="team-requests-tab-empty" testID="team-requests-tab-empty">
          No hay solicitudes de ingreso pendientes.
        </Text>
      ) : (
        <View className="gap-2" nativeID="team-requests-tab-list" testID="team-requests-tab-list">
          {requests.map((request) => (
            <JoinRequestRow
              key={request.id}
              onAccept={() => handleAccept(request.id)}
              onReject={() => handleReject(request.id)}
              request={request}
              responding={(isAccepting || isRejecting) && respondingId === request.id}
            />
          ))}
        </View>
      )}
    </SectionCard>
  );
}
