import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { KIND_DOT_COLORS } from '../../utils/calendar-kind-colors.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';

function kindLabel(assignment) {
  if (assignment.kind === 'rest') return 'Descanso';
  if (assignment.kind === 'other') return assignment.otherName || 'Otra actividad';
  if (assignment.kind === 'cancelled') return 'Sesión cancelada';
  return 'Entrenamiento';
}

function AssignmentRow({ assignment, variant }) {
  const colors = useThemeColors();
  const router = useRouter();
  const idPrefix = `day-detail-assignment-${assignment.id}`;

  const handleGoToDay = () => {
    router.push(`/teams/${assignment.teamId}/groups/${assignment.groupId}/calendar/${assignment.date}`);
  };

  const kindColor = KIND_DOT_COLORS[assignment.kind];

  return (
    <View
      className="rounded-xl border px-3 py-2"
      nativeID={idPrefix}
      style={{ backgroundColor: `${kindColor}26`, borderColor: kindColor }}
      testID={idPrefix}
    >
      <View className="mb-1 flex-row flex-wrap items-center gap-x-3 gap-y-0.5" nativeID={`${idPrefix}-scope`} testID={`${idPrefix}-scope`}>
        <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-team`} testID={`${idPrefix}-team`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={12} />
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-team-label`} testID={`${idPrefix}-team-label`}>
            {assignment.teamName}
          </Text>
        </View>
        <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={12} />
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-group-label`} testID={`${idPrefix}-group-label`}>
            {assignment.groupName}
          </Text>
        </View>
      </View>
      <Text className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-kind`} testID={`${idPrefix}-kind`}>
        {kindLabel(assignment)}
      </Text>
      {assignment.isPresencial && (
        <View className="mt-1 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
            {assignment.presencialTimeFrom}–{assignment.presencialTimeTo}
            {assignment.presencialLocation?.label ? ` · ${assignment.presencialLocation.label}` : ''}
          </Text>
        </View>
      )}
      {assignment.sessionInstance && (
        <Text className="mt-1 text-xs text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-session-name`} testID={`${idPrefix}-session-name`}>
          {assignment.sessionInstance.name}
          {assignment.sessionInstance.exercises.length > 0
            ? ` · ${assignment.sessionInstance.exercises.length} ejercicio${assignment.sessionInstance.exercises.length === 1 ? '' : 's'}`
            : ''}
        </Text>
      )}
      {variant === 'administered' && assignment.presencialCollision && (
        <View
          className={`mt-2 rounded-lg px-2 py-1.5 ${assignment.presencialCollision.type === 'cross_team' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}
          nativeID={`${idPrefix}-collision`}
          testID={`${idPrefix}-collision`}
        >
          <Text
            className={`text-[11px] font-semibold ${assignment.presencialCollision.type === 'cross_team' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}
            nativeID={`${idPrefix}-collision-label`}
            testID={`${idPrefix}-collision-label`}
          >
            Colisiona con {assignment.presencialCollision.conflicts.map((c) => `${c.group_name} (${c.team_name})`).join(', ')}
          </Text>
        </View>
      )}
      {variant === 'administered' && (
        <Pressable
          className="mt-2 h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-go-to-day-button`}
          onPress={handleGoToDay}
          testID={`${idPrefix}-go-to-day-button`}
        >
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-go-to-day-button-label`} testID={`${idPrefix}-go-to-day-button-label`}>
            Ir a este día
          </Text>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-right" size={14} />
        </Pressable>
      )}
    </View>
  );
}

export function DayDetailModal({ visible, onClose, date, assignments, variant }) {
  return (
    <Modal animationType="fade" nativeID="day-detail-modal" onRequestClose={onClose} testID="day-detail-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="day-detail-modal-backdrop" onPress={onClose} testID="day-detail-modal-backdrop">
        <Pressable
          className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="day-detail-modal-card"
          onPress={() => {}}
          testID="day-detail-modal-card"
        >
          <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="day-detail-modal-title" testID="day-detail-modal-title">
            {formatWeekdayLabel(date)}, {formatDisplayDate(date)}
          </Text>
          <ScrollView nativeID="day-detail-modal-scroll" testID="day-detail-modal-scroll">
            <View className="gap-2" nativeID="day-detail-modal-list" testID="day-detail-modal-list">
              {assignments.map((assignment) => (
                <AssignmentRow assignment={assignment} key={assignment.id} variant={variant} />
              ))}
              {assignments.length === 0 && (
                <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="day-detail-modal-empty" testID="day-detail-modal-empty">
                  Sin asignaciones este día.
                </Text>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
