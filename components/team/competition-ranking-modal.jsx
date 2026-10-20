import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useCompetitionDetail } from '../../hooks/use-competitions.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { buildCompetitionTitle } from '../../utils/competition-title.js';

function memberName(members, userId) {
  return members.find((m) => m.userId === userId)?.name ?? 'Corredor';
}

// Ranking en vivo de una competencia activa (pedido real, 2026-10-16) --
// disponible para CUALQUIERA que pueda ver la competencia (no gateado por
// isTrainerView/participante, a diferencia de aprobar/cerrar/cancelar), ver
// botón en competitions-tab.jsx. Pide su propio detalle (independiente de
// que la fila esté expandida o no -- el botón puede tocarse sin expandir
// primero).
export function CompetitionRankingModal({ visible, onClose, competition, members }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { detail, loading } = useCompetitionDetail(competition?.id, { enabled: visible && Boolean(competition) });

  // `pace`: menor es mejor (más rápido) -- único metric donde "menos" gana.
  // El resto (distance/duration/peak_speed/sessions_count/attendance_count)
  // ordena de mayor a menor.
  const direction = competition?.metric === 'pace' ? 1 : -1;
  const ranked = [...(detail?.progress ?? [])].sort((a, b) => direction * ((a.value ?? 0) - (b.value ?? 0)));

  return (
    <Modal animationType="fade" nativeID="competition-ranking-modal" onRequestClose={onClose} testID="competition-ranking-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="competition-ranking-modal-backdrop" onPress={onClose} testID="competition-ranking-modal-backdrop">
        <Pressable className="max-h-[80vh] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="competition-ranking-modal-card" onPress={() => {}} testID="competition-ranking-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="competition-ranking-modal-header" testID="competition-ranking-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="podium" size={20} />
            <Text className="flex-1 text-base font-bold text-slate-900 dark:text-white" nativeID="competition-ranking-modal-title" testID="competition-ranking-modal-title" numberOfLines={2}>
              {competition ? (competition.name ?? buildCompetitionTitle(competition)) : 'Ranking'}
            </Text>
            <Pressable className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID="competition-ranking-modal-close-button" onPress={onClose} testID="competition-ranking-modal-close-button">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center py-6" nativeID="competition-ranking-modal-loading" testID="competition-ranking-modal-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView className="max-h-[60vh]" nativeID="competition-ranking-modal-scroll" testID="competition-ranking-modal-scroll">
              <View className="gap-2" nativeID="competition-ranking-modal-list" testID="competition-ranking-modal-list">
                {ranked.map((entry, index) => (
                  <Pressable
                    className={`flex-row items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900 ${competition?.type === 'route' ? 'active:opacity-70' : ''}`}
                    key={entry.userId}
                    nativeID={`competition-ranking-modal-row-${entry.userId}`}
                    // Solo ruta tiene "detalle de intento" -- metric no tiene
                    // ningún GPS/sesión individual que mostrar ahí, navegar
                    // igual deja un dead-end confuso ("sin intento
                    // registrado" sobre algo que nunca tuvo el concepto).
                    onPress={competition?.type === 'route' ? () => {
                      onClose();
                      router.push({ pathname: '/route-attempt-detail', params: { competitionId: competition.id, athleteUserId: entry.userId } });
                    } : undefined}
                    testID={`competition-ranking-modal-row-${entry.userId}`}
                  >
                    <Text className="w-6 text-sm font-bold text-slate-400 dark:text-slate-500" nativeID={`competition-ranking-modal-row-${entry.userId}-rank`} testID={`competition-ranking-modal-row-${entry.userId}-rank`}>
                      {index + 1}
                    </Text>
                    <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-white" nativeID={`competition-ranking-modal-row-${entry.userId}-name`} testID={`competition-ranking-modal-row-${entry.userId}-name`}>
                      {memberName(members, entry.userId)}
                    </Text>
                    <Text className="text-sm font-semibold text-primary" nativeID={`competition-ranking-modal-row-${entry.userId}-value`} testID={`competition-ranking-modal-row-${entry.userId}-value`}>
                      {competition?.type === 'metric' ? formatMetricValue(competition.metric, entry.value) : '—'}
                    </Text>
                  </Pressable>
                ))}
                {ranked.length === 0 && (
                  <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="competition-ranking-modal-empty" testID="competition-ranking-modal-empty">
                    Todavía no hay participantes.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
