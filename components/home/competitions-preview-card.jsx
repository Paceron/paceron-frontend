import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useMyCompetitions } from '../../hooks/use-my-competitions.js';
import { sortCompetitionsForPreview } from '../../utils/competition-sort.js';
import { buildCompetitionName, formatCompetitionDate } from '../../utils/competition-title.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAchievementsTabStore } from '../../store/achievements-tab-store.js';

const TYPE_ICON = { route: 'flag-checkered', metric: 'trophy-variant' };

function statusLabel(competition) {
  if (competition.type === 'route') return 'Abierta';
  if (!competition.endAt) return 'Abierta';
  const days = Math.ceil((new Date(competition.endAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Cierra hoy';
  return `Cierra en ${days} ${days === 1 ? 'día' : 'días'}`;
}

function datesLabel(competition) {
  const start = formatCompetitionDate(competition.startAt);
  const end = formatCompetitionDate(competition.endAt);
  if (start && end) return `${start} → ${end}`;
  if (start) return `Desde ${start}`;
  return null;
}

function PreviewBox({ competition, onPress, wide }) {
  const colors = useThemeColors();
  const idPrefix = `competitions-preview-box-${competition.id}`;
  const dates = datesLabel(competition);
  return (
    <Pressable
      accessibilityLabel={`Ver ${buildCompetitionName(competition)}`}
      accessibilityRole="button"
      className={`rounded-2xl border border-slate-200 bg-slate-100 p-4 hover:opacity-90 active:opacity-90 dark:bg-slate-800 dark:border-slate-700 ${wide ? 'flex-1' : ''}`}
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <View className="mb-4 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={TYPE_ICON[competition.type] ?? 'trophy-variant'} size={18} />
        <Text className="flex-1 font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} numberOfLines={3} testID={`${idPrefix}-title`}>
          {buildCompetitionName(competition)}
        </Text>
      </View>
      {dates && (
        <View className="mb-3 flex-row items-center gap-1.5" nativeID={`${idPrefix}-dates`} testID={`${idPrefix}-dates`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-range" size={13} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-dates-label`} testID={`${idPrefix}-dates-label`}>
            {dates}
          </Text>
        </View>
      )}
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-footer`} testID={`${idPrefix}-footer`}>
        <View className="flex-1" nativeID={`${idPrefix}-footer-text`} testID={`${idPrefix}-footer-text`}>
          <View className="mb-1 flex-row items-center gap-1" nativeID={`${idPrefix}-team-row`} testID={`${idPrefix}-team-row`}>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={12} />
            <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team`} numberOfLines={1} testID={`${idPrefix}-team`}>
              {competition.teamName}
            </Text>
          </View>
          <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-status-row`} testID={`${idPrefix}-status-row`}>
            <MaterialCommunityIcons color={colors.primary} name="clock-outline" size={12} />
            <Text className="text-xs font-semibold text-primary" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
              {statusLabel(competition)}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
      </View>
    </Pressable>
  );
}

function ViewAllTile({ wide, onPress }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityLabel="Ver todas las competencias"
      accessibilityRole="button"
      className={`items-center justify-center gap-2 border border-slate-400 rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800 dark:border-slate-700 ${wide ? 'w-13' : 'flex-row gap-2'}`}
      nativeID="competitions-preview-card-view-all"
      onPress={onPress}
      testID="competitions-preview-card-view-all"
    >
      <MaterialCommunityIcons className="animate-pulse" color={colors.onSurfaceVariant} name="dots-horizontal-circle-outline" size={14} />
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="competitions-preview-card-view-all-label" testID="competitions-preview-card-view-all-label">
        Ver más
      </Text>
    </Pressable>
  );
}

export function CompetitionsPreviewCard() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const isNarrow = useIsNarrowWeb();
  const setAchievementsTab = useAchievementsTabStore((s) => s.setActiveTab);
  const { competitions, loading } = useMyCompetitions(userId, { status: 'active' });

  if (loading) {
    return (
      <View className="mb-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="competitions-preview-card-loading" testID="competitions-preview-card-loading">
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="competitions-preview-card-loading-kicker" testID="competitions-preview-card-loading-kicker">
          Tus competencias
        </Text>
        <View className="min-h-[72px] items-center justify-center" nativeID="competitions-preview-card-loading-body" testID="competitions-preview-card-loading-body">
          <ActivityIndicator color={colors.primary} nativeID="competitions-preview-card-loading-indicator" testID="competitions-preview-card-loading-indicator" />
        </View>
      </View>
    );
  }

  if (competitions.length === 0) return null;

  const preview = sortCompetitionsForPreview(competitions).slice(0, 3);
  const wide = isWeb && !isNarrow;

  const goToAllCompetitions = () => {
    setAchievementsTab('competitions');
    router.push('/achievements');
  };

  return (
    <View className="mb-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="competitions-preview-card" testID="competitions-preview-card">
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="competitions-preview-card-kicker" testID="competitions-preview-card-kicker">
        Tus competencias
      </Text>
      <View className={wide ? 'flex-row gap-3' : 'gap-3'} nativeID="competitions-preview-card-list" testID="competitions-preview-card-list">
        {preview.map((competition) => (
          <PreviewBox
            competition={competition}
            key={competition.id}
            onPress={() => router.push(`/teams/${competition.teamId}?tab=competencias&focus=${competition.id}`)}
            wide={wide}
          />
        ))}
        <ViewAllTile onPress={goToAllCompetitions} wide={wide} />
      </View>
    </View>
  );
}
