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

function CancelledCard({ session, onPress }) {
  const idPrefix = `next-training-banner-cancelled-${session.id}`;

  return (
    <Pressable
      className="relative flex-row items-center overflow-hidden rounded-2xl bg-red-600 p-4 hover:opacity-90 active:opacity-90 dark:bg-red-800"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <View className="absolute -bottom-4 -right-4" nativeID={`${idPrefix}-watermark`} pointerEvents="none" testID={`${idPrefix}-watermark`}>
        <MaterialCommunityIcons color="#ffffff" name="calendar-remove-outline" size={80} style={{ opacity: 0.15 }} />
      </View>

      <View className="flex-1 pr-3" nativeID={`${idPrefix}-text`} testID={`${idPrefix}-text`}>
        <Text className="text-xs font-semibold uppercase tracking-wide text-white/80" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          Cancelado · {formatDisplayDate(session.date)}
        </Text>
        <Text className="mt-0.5 text-sm font-bold text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {session.sessionInstance?.name ?? 'Entrenamiento'}
        </Text>
      </View>

      <View className="w-12 items-center justify-center" nativeID={`${idPrefix}-icon-rail`} testID={`${idPrefix}-icon-rail`}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white/15" nativeID={`${idPrefix}-icon-badge`} testID={`${idPrefix}-icon-badge`}>
          <MaterialCommunityIcons color="#ffffff" name="calendar-remove-outline" size={20} />
        </View>
      </View>
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

  return (
    <View className="mb-6" nativeID="next-training-banner-root" testID="next-training-banner-root">
      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="next-training-banner-section-title" testID="next-training-banner-section-title">
        Próximos entrenamientos
      </Text>

      {loading && (
        <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-surface" nativeID="next-training-banner-loading" testID="next-training-banner-loading">
          <ActivityIndicator color={colors.primary} nativeID="next-training-banner-loading-indicator" testID="next-training-banner-loading-indicator" />
        </View>
      )}

      {!loading && !nextTraining && (
        <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="next-training-banner-empty" testID="next-training-banner-empty">
          <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="next-training-banner-empty-label" testID="next-training-banner-empty-label">
            No tenés entrenamientos programados.
          </Text>
        </View>
      )}

      {!loading && nextTraining && (
        <NextTrainingCardGroup
          cancelledSessions={cancelledSessions}
          eligible={role === 'trainer' ? canStartPresencialSession(nextTraining) : canStartAsyncSession(nextTraining)}
          isFetching={isFetching}
          nextTraining={nextTraining}
          onCancelledPress={goToCalendarDay}
          onHeroPress={() => {
            if ((role === 'trainer' ? canStartPresencialSession(nextTraining) : canStartAsyncSession(nextTraining)) && !isWeb) {
              setPendingSession(nextTraining);
              router.push('/training-session');
              return;
            }
            goToCalendarDay(nextTraining.date);
          }}
        />
      )}
    </View>
  );
}

function NextTrainingCardGroup({ nextTraining, cancelledSessions, eligible, isFetching, onHeroPress, onCancelledPress }) {
  const heroIcon = nextTraining.isPresencial ? 'map-marker-radius' : 'run-fast';

  return (
    <View className="gap-2" nativeID="next-training-banner-list" testID="next-training-banner-list">
      {cancelledSessions.map((session) => (
        <CancelledCard key={session.id} onPress={() => onCancelledPress(session.date)} session={session} />
      ))}

      <Pressable
        className="relative overflow-hidden rounded-2xl bg-primary p-5 hover:opacity-90 active:opacity-90"
        nativeID="next-training-banner-hero"
        onPress={onHeroPress}
        testID="next-training-banner-hero"
      >
        <View className="absolute -bottom-8 -right-8" nativeID="next-training-banner-hero-watermark" pointerEvents="none" testID="next-training-banner-hero-watermark">
          <MaterialCommunityIcons color="#111518" name={heroIcon} size={130} style={{ opacity: 0.12 }} />
        </View>

        <View className="flex-row items-center" nativeID="next-training-banner-hero-content" testID="next-training-banner-hero-content">
          <View className="flex-1 pr-3" nativeID="next-training-banner-hero-text" testID="next-training-banner-hero-text">
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]/70" nativeID="next-training-banner-hero-date" testID="next-training-banner-hero-date">
              {formatWeekdayLabel(nextTraining.date, { short: true })}, {formatDisplayDate(nextTraining.date)}
            </Text>

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
          </View>

          <View className="w-16 items-center justify-center" nativeID="next-training-banner-hero-icon-rail" testID="next-training-banner-hero-icon-rail">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-[#111518]/10" nativeID="next-training-banner-hero-icon-badge" testID="next-training-banner-hero-icon-badge">
              <MaterialCommunityIcons color="#111518" name={heroIcon} size={28} />
            </View>
          </View>
        </View>

        {isFetching && (
          <View className="absolute inset-0 items-center justify-center rounded-2xl bg-primary/70" nativeID="next-training-banner-hero-fetching-overlay" testID="next-training-banner-hero-fetching-overlay">
            <ActivityIndicator color="#111518" nativeID="next-training-banner-hero-fetching-indicator" testID="next-training-banner-hero-fetching-indicator" />
          </View>
        )}
      </Pressable>
    </View>
  );
}
