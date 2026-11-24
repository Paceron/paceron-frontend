import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useCompetitionDetail } from '../../hooks/use-competitions.js';
import { visibleQueryError } from '../../utils/query-state.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { colorForUserId } from '../../utils/participant-color.js';
import { isWeb } from '../../utils/platform.js';
import {
  buildParticipantRows,
  filterParticipants,
  sortParticipantsByName,
} from '../../utils/competition-participants.js';
import { ParticipantAvatar } from '../session-runtime/participant-avatar.jsx';
import { IconButton } from '../shared/icon-button.jsx';
import { ErrorState } from '../shared/error-state.jsx';

const ID_PREFIX = 'competition-participants-modal';

function progressLabel(competition, progress) {
  if (competition?.type === 'route') {
    if (competition.status !== 'active' && competition.status !== 'finished') return '—';
    if (progress?.complianceRatio != null) return `${Math.round(progress.complianceRatio)}%`;
    return progress?.hasAttempt ? '—' : 'Sin intentos';
  }
  if (progress?.value != null) return formatMetricValue(competition?.metric, progress.value);
  return '—';
}

export function CompetitionParticipantsModal({ visible, onClose, competition, members, onOpenAttempts }) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const competitionId = competition?.id ?? null;
  const { detail, loading, fetching, error, refetch } = useCompetitionDetail(competition?.id, {
    enabled: visible && Boolean(competition),
  });
  const visibleError = visibleQueryError(detail, error);

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible, competitionId]);

  const rows = useMemo(
    () =>
      sortParticipantsByName(
        buildParticipantRows({
          participantUserIds: competition?.participantUserIds ?? [],
          members,
          progress: detail?.progress ?? [],
        }),
      ),
    [competition?.participantUserIds, members, detail?.progress],
  );
  const filteredRows = useMemo(() => filterParticipants(rows, query), [rows, query]);
  const isRoute = competition?.type === 'route';
  const canViewAttempts = isRoute && (competition?.status === 'active' || competition?.status === 'finished');

  const counterText = query
    ? `${filteredRows.length} de ${rows.length} participantes`
    : `${rows.length} participantes`;

  return (
    <Modal
      animationType="fade"
      nativeID={ID_PREFIX}
      onRequestClose={onClose}
      testID={ID_PREFIX}
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center p-4" nativeID={`${ID_PREFIX}-layout`} testID={`${ID_PREFIX}-layout`}>
        <Pressable
          className="absolute inset-0 bg-black/50"
          nativeID={`${ID_PREFIX}-backdrop`}
          onPress={onClose}
          testID={`${ID_PREFIX}-backdrop`}
        />
        <View
          className="max-h-[85%] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID={`${ID_PREFIX}-card`}
          testID={`${ID_PREFIX}-card`}
        >
          <View className="mb-2 flex-row items-center gap-2" nativeID={`${ID_PREFIX}-header`} testID={`${ID_PREFIX}-header`}>
            <MaterialCommunityIcons color={colors.primary} name="account-group" size={20} />
            <Text className="flex-1 text-base font-bold text-slate-900 dark:text-white" nativeID={`${ID_PREFIX}-title`} testID={`${ID_PREFIX}-title`} numberOfLines={1}>
              Participantes
            </Text>
            <IconButton
              icon="close"
              iconSize={18}
              idPrefix={`${ID_PREFIX}-close-button`}
              label="Cerrar"
              onPress={onClose}
              size={32}
            />
          </View>

          <View
            className="mb-2 h-11 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900"
            nativeID={`${ID_PREFIX}-search-box`}
            testID={`${ID_PREFIX}-search-box`}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={18} />
            <TextInput
              accessibilityLabel="Buscar participante"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={isWeb}
              className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
              nativeID={`${ID_PREFIX}-search-input`}
              onChangeText={setQuery}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="Buscar participante"
              placeholderTextColor={colors.onSurfaceVariant}
              returnKeyType="search"
              testID={`${ID_PREFIX}-search-input`}
              value={query}
            />
            {query ? (
              <IconButton
                icon="close-circle"
                iconSize={16}
                idPrefix={`${ID_PREFIX}-search-clear-button`}
                label="Limpiar búsqueda"
                onPress={() => setQuery('')}
                size={32}
              />
            ) : null}
          </View>

          <Text
            accessibilityLiveRegion="polite"
            className="mb-2 text-xs text-slate-500 dark:text-slate-400"
            nativeID={`${ID_PREFIX}-count`}
            testID={`${ID_PREFIX}-count`}
          >
            {counterText}
          </Text>

          {loading && !detail ? (
            <View className="items-center py-6" nativeID={`${ID_PREFIX}-loading`} testID={`${ID_PREFIX}-loading`}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : visibleError ? (
            <ErrorState
              idPrefix={`${ID_PREFIX}-error`}
              message="No pudimos cargar los participantes."
              onRetry={refetch}
              retrying={fetching}
            />
          ) : (
            <ScrollView
              className="max-h-80 flex-shrink"
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              nativeID={`${ID_PREFIX}-scroll`}
              testID={`${ID_PREFIX}-scroll`}
            >
              <View className="gap-2" nativeID={`${ID_PREFIX}-list`} testID={`${ID_PREFIX}-list`}>
                {filteredRows.map((row) => {
                  const rowId = `${ID_PREFIX}-row-${row.userId}`;
                  return (
                    <View
                      className="flex-row items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900"
                      key={row.userId}
                      nativeID={rowId}
                      testID={rowId}
                    >
                      <ParticipantAvatar
                        color={colorForUserId(row.userId)}
                        idPrefix={`${rowId}-avatar`}
                        name={row.name}
                        photoUrl={row.photoUrl}
                        size={32}
                      />
                      <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-white" nativeID={`${rowId}-name`} numberOfLines={1} testID={`${rowId}-name`}>
                        {row.name}
                      </Text>
                      <Text className="text-sm font-semibold text-[#3c6b12] dark:text-primary" nativeID={`${rowId}-progress`} testID={`${rowId}-progress`}>
                        {progressLabel(competition, row.progress)}
                      </Text>
                      {canViewAttempts ? (
                        <Pressable
                          accessibilityLabel={`Ver intentos de ${row.name}`}
                          accessibilityRole="button"
                          className="h-8 flex-row items-center gap-1 rounded-full bg-primary px-2.5 active:opacity-80"
                          nativeID={`${rowId}-attempts-button`}
                          onPress={() => onOpenAttempts(competition, row.userId)}
                          testID={`${rowId}-attempts-button`}
                        >
                          <MaterialCommunityIcons color={colors.onPrimary} name="format-list-bulleted" size={14} />
                          <Text className="text-xs font-bold text-[#111518]" nativeID={`${rowId}-attempts-label`} testID={`${rowId}-attempts-label`}>
                            Ver intentos
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
                {rows.length === 0 ? (
                  <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID={`${ID_PREFIX}-empty`} testID={`${ID_PREFIX}-empty`}>
                    Todavía no hay participantes.
                  </Text>
                ) : filteredRows.length === 0 ? (
                  <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID={`${ID_PREFIX}-no-matches`} testID={`${ID_PREFIX}-no-matches`}>
                    Sin coincidencias.
                  </Text>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
