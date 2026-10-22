import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useCompetitionAttempts } from '../../hooks/use-competitions.js';
import { pickBestAttempt } from '../../utils/route-geometry.js';
import { formatMeters } from '../../utils/distance.js';
import { formatStopwatch } from '../../utils/time.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { buildCompetitionTitle } from '../../utils/competition-title.js';

function memberName(members, userId) {
  return members.find((m) => m.userId === userId)?.name ?? 'Corredor';
}

const pad2 = (n) => String(n).padStart(2, '0');
function formatAttemptDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Historial completo de intentos de UN participante contra una competencia
// de ruta (Gap 36, intentos múltiples) -- mismo criterio de visibilidad que
// CompetitionRankingModal: cualquiera que pueda ver la competencia puede
// elegir cualquier participante en el select de arriba, no solo verse a sí
// mismo. Default del select: el usuario actual si participa, si no el
// primer participante de la lista -- pedido real, 2026-10-21.
export function AttemptsListModal({ visible, onClose, competition, members, currentUserId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const participantIds = competition?.participantUserIds ?? [];
  const defaultAthleteId = participantIds.includes(currentUserId) ? currentUserId : (participantIds[0] ?? null);
  const [athleteId, setAthleteId] = useState(defaultAthleteId);
  const resolvedAthleteId = participantIds.includes(athleteId) ? athleteId : defaultAthleteId;

  const { attempts, loading } = useCompetitionAttempts(competition?.id, resolvedAthleteId, { enabled: visible && Boolean(competition) });
  const best = pickBestAttempt(attempts.map((a) => ({ ...a, durationMs: a.durationMs })));

  const athleteOptions = participantIds.map((id) => ({ id, name: memberName(members, id) }));

  const handleOpenAttempt = (attempt) => {
    onClose();
    router.push({
      pathname: '/route-attempt-detail',
      params: { competitionId: competition.id, athleteUserId: resolvedAthleteId, sessionInstanceId: attempt.sessionInstanceId },
    });
  };

  return (
    <Modal animationType="fade" nativeID="attempts-list-modal" onRequestClose={onClose} testID="attempts-list-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="attempts-list-modal-backdrop" onPress={onClose} testID="attempts-list-modal-backdrop">
        <Pressable className="max-h-[80vh] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="attempts-list-modal-card" onPress={() => {}} testID="attempts-list-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="attempts-list-modal-header" testID="attempts-list-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="format-list-bulleted" size={20} />
            <Text className="flex-1 text-base font-bold text-slate-900 dark:text-white" nativeID="attempts-list-modal-title" numberOfLines={2} testID="attempts-list-modal-title">
              {competition ? (competition.name ?? buildCompetitionTitle(competition)) : 'Intentos'}
            </Text>
            <Pressable className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID="attempts-list-modal-close-button" onPress={onClose} testID="attempts-list-modal-close-button">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
            </Pressable>
          </View>

          <View className="mb-3" nativeID="attempts-list-modal-athlete-picker-wrap" testID="attempts-list-modal-athlete-picker-wrap">
            <ResponsiveSelectField dense hideErrorRow label="Corredor" onChange={setAthleteId} options={athleteOptions} value={resolvedAthleteId} />
          </View>

          {loading ? (
            <View className="items-center py-6" nativeID="attempts-list-modal-loading" testID="attempts-list-modal-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView className="max-h-[50vh]" nativeID="attempts-list-modal-scroll" testID="attempts-list-modal-scroll">
              <View className="gap-2" nativeID="attempts-list-modal-list" testID="attempts-list-modal-list">
                {attempts.map((attempt) => {
                  const isBest = best?.sessionInstanceId === attempt.sessionInstanceId;
                  return (
                    <Pressable
                      className="flex-row items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 active:opacity-70 dark:bg-slate-900"
                      key={attempt.sessionInstanceId}
                      nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}`}
                      onPress={() => handleOpenAttempt(attempt)}
                      testID={`attempts-list-modal-row-${attempt.sessionInstanceId}`}
                    >
                      <View className="flex-1" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-info`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-info`}>
                        <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-date`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-date`}>
                          {formatAttemptDate(attempt.startedAt)}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-meta`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-meta`}>
                          {formatMeters(attempt.distanceMeters ?? 0)} · {formatStopwatch(attempt.durationMs ?? 0)}
                        </Text>
                      </View>
                      <View className="items-end gap-0.5" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance-wrap`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance-wrap`}>
                        <Text className="text-sm font-semibold text-primary" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance`}>
                          {attempt.complianceRatio != null ? `${Math.round(attempt.complianceRatio)}%` : '—'}
                        </Text>
                        {isBest && (
                          <View className="flex-row items-center gap-0.5" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge`}>
                            <MaterialCommunityIcons color="#eab308" name="trophy" size={12} />
                            <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge-label`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge-label`}>
                              Mejor
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {attempts.length === 0 && (
                  <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="attempts-list-modal-empty" testID="attempts-list-modal-empty">
                    Este corredor todavía no registró ningún intento.
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
