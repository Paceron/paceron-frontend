import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useNextTrainingBanner } from '../../hooks/use-next-training-banner.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { canStartAsyncSession, canStartPresencialSession } from '../../utils/session-start-window.js';
import { isWeb } from '../../utils/platform.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';

function CancelledChip({ session, onPress }) {
  const idPrefix = `next-training-banner-cancelled-${session.id}`;

  return (
    <Pressable
      className="mb-2 flex-row items-center gap-2 rounded-xl bg-red-50 px-3 py-2 dark:bg-red-900/20"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color="#ef4444" name="calendar-remove-outline" size={16} />
      <Text className="flex-1 text-xs font-medium text-red-700 dark:text-red-400" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        Se canceló &quot;{session.sessionInstance?.name ?? 'Entrenamiento'}&quot; del {formatDisplayDate(session.date)}
      </Text>
    </Pressable>
  );
}

export function NextTrainingBanner() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.activeRole);
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);
  const { nextTraining, cancelledSessions, loading, isFetching } = useNextTrainingBanner(role, userId);

  if (!role) return null;

  const calendarHref = role === 'trainer' ? '/administered-calendar' : '/calendar';

  const goToCalendarDay = (date) => {
    router.push({ pathname: calendarHref, params: { date } });
  };

  if (!nextTraining) {
    return (
      <View className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="next-training-banner-empty" testID="next-training-banner-empty">
        <View className="flex-row items-center gap-2" nativeID="next-training-banner-empty-header" testID="next-training-banner-empty-header">
          <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="next-training-banner-empty-label" testID="next-training-banner-empty-label">
            No tenés entrenamientos programados.
          </Text>
          {(loading || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="next-training-banner-empty-loading" size="small" testID="next-training-banner-empty-loading" />
          )}
        </View>
      </View>
    );
  }

  const eligible = role === 'trainer' ? canStartPresencialSession(nextTraining) : canStartAsyncSession(nextTraining);

  const handlePress = () => {
    if (eligible && !isWeb) {
      setPendingSession(nextTraining);
      router.push('/training-session');
      return;
    }
    goToCalendarDay(nextTraining.date);
  };

  return (
    <View className="mb-6" nativeID="next-training-banner-root" testID="next-training-banner-root">
      {cancelledSessions.length > 0 && (
        <View className="mb-2" nativeID="next-training-banner-cancelled-list" testID="next-training-banner-cancelled-list">
          {cancelledSessions.map((session) => (
            <CancelledChip key={session.id} onPress={() => goToCalendarDay(session.date)} session={session} />
          ))}
        </View>
      )}

      <Pressable
        className="rounded-2xl bg-primary p-5 active:opacity-90"
        nativeID="next-training-banner-hero"
        onPress={handlePress}
        testID="next-training-banner-hero"
      >
        <View className="flex-row items-center justify-between" nativeID="next-training-banner-hero-header" testID="next-training-banner-hero-header">
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]/70" nativeID="next-training-banner-hero-date" testID="next-training-banner-hero-date">
            {formatWeekdayLabel(nextTraining.date, { short: true })}, {formatDisplayDate(nextTraining.date)}
          </Text>
          {(loading || isFetching) && <ActivityIndicator color="#111518" nativeID="next-training-banner-hero-loading" size="small" testID="next-training-banner-hero-loading" />}
        </View>

        <Text className="mt-1 text-xl font-bold text-[#111518]" nativeID="next-training-banner-hero-title" testID="next-training-banner-hero-title">
          {nextTraining.sessionInstance?.name ?? 'Entrenamiento'}
        </Text>

        <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1" nativeID="next-training-banner-hero-scope" testID="next-training-banner-hero-scope">
          <View className="flex-row items-center gap-1" nativeID="next-training-banner-hero-team" testID="next-training-banner-hero-team">
            <MaterialCommunityIcons color="#111518" name="shield-account-outline" size={14} />
            <Text className="text-xs font-semibold text-[#111518]" nativeID="next-training-banner-hero-team-label" testID="next-training-banner-hero-team-label">
              {nextTraining.teamName}
            </Text>
          </View>
          <View className="flex-row items-center gap-1" nativeID="next-training-banner-hero-group" testID="next-training-banner-hero-group">
            <MaterialCommunityIcons color="#111518" name="account-multiple-outline" size={14} />
            <Text className="text-xs font-semibold text-[#111518]" nativeID="next-training-banner-hero-group-label" testID="next-training-banner-hero-group-label">
              {nextTraining.groupName}
            </Text>
          </View>
        </View>

        {nextTraining.isPresencial && (
          <View className="mt-2 flex-row items-center gap-1.5" nativeID="next-training-banner-hero-presencial" testID="next-training-banner-hero-presencial">
            <MaterialCommunityIcons color="#111518" name="map-marker-outline" size={14} />
            <Text className="text-xs text-[#111518]" nativeID="next-training-banner-hero-presencial-label" testID="next-training-banner-hero-presencial-label">
              {nextTraining.presencialTimeFrom}–{nextTraining.presencialTimeTo}
              {nextTraining.presencialLocation?.label ? ` · ${nextTraining.presencialLocation.label}` : ''}
            </Text>
          </View>
        )}

        <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-[#111518]/10 px-3 py-1.5" nativeID="next-training-banner-hero-cta" testID="next-training-banner-hero-cta">
          <MaterialCommunityIcons color="#111518" name={eligible && !isWeb ? 'play' : 'calendar-month-outline'} size={14} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="next-training-banner-hero-cta-label" testID="next-training-banner-hero-cta-label">
            {eligible && !isWeb ? 'Iniciar entrenamiento' : 'Ver en el calendario'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
