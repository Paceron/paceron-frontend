import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useMyCompetitions } from '../../hooks/use-my-competitions.js';
import { sortCompetitionsForPreview } from '../../utils/competition-sort.js';
import { buildCompetitionTitle } from '../../utils/competition-title.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';

const TYPE_ICON = { route: 'flag-checkered', metric: 'trophy-variant' };

function statusLabel(competition) {
  if (competition.type === 'route') return 'Abierta';
  if (!competition.endAt) return 'Abierta';
  const days = Math.ceil((new Date(competition.endAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Cierra hoy';
  return `Cierra en ${days} ${days === 1 ? 'día' : 'días'}`;
}

function PreviewBox({ competition, onPress, wide }) {
  const colors = useThemeColors();
  const idPrefix = `competitions-preview-box-${competition.id}`;
  return (
    <View className={`rounded-2xl border border-slate-200 bg-slate-100 p-4 dark:bg-surface-2 ${wide ? 'flex-1' : ''}`} nativeID={idPrefix} testID={idPrefix}>
      <View className="mb-2 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={TYPE_ICON[competition.type] ?? 'trophy-variant'} size={18} />
        <Text className="flex-1 font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} numberOfLines={3} testID={`${idPrefix}-title`}>
          {buildCompetitionTitle(competition)}
        </Text>
      </View>
      <View className="flex-row" nativeID={`${idPrefix}-footer`} testID={`${idPrefix}-footer`}>
        <View className="flex-1" nativeID={`${idPrefix}-footer-text`} testID={`${idPrefix}-footer-text`}>
          <Text className="mb-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team`} numberOfLines={1} testID={`${idPrefix}-team`}>
            {competition.teamName}
          </Text>
          <Text className="text-xs font-semibold text-primary" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
            {statusLabel(competition)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Ver ${buildCompetitionTitle(competition)}`}
          accessibilityRole="button"
          className="self-start flex-row rounded-full bg-primary p-2 pl-4 hover:opacity-90 active:opacity-90"
          nativeID={`${idPrefix}-cta`}
          onPress={onPress}
          testID={`${idPrefix}-cta`}
        >
          <Text className="text-xs font-bold text-[#111518]" nativeID={`${idPrefix}-cta-label`} testID={`${idPrefix}-cta-label`}>Ver</Text>
          <MaterialCommunityIcons color="#111518" name="chevron-right" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

export function CompetitionsPreviewCard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const isNarrow = useIsNarrowWeb();
  const { competitions, loading } = useMyCompetitions(userId, { status: 'active' });

  if (loading || competitions.length === 0) return null;

  const preview = sortCompetitionsForPreview(competitions).slice(0, 3);
  const wide = isWeb && !isNarrow;

  return (
    <View className={`mb-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface ${wide ? 'gap-3' : 'gap-3'}`} nativeID="competitions-preview-card" testID="competitions-preview-card">
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="competitions-preview-card-kicker" testID="competitions-preview-card-kicker">
        Tus competencias
      </Text>
      <View className={`${wide ? 'flex-row gap-3' : 'gap-3'}`} nativeID="competitions-preview-card-list" testID="competitions-preview-card-list">
        {preview.map((competition) => (
          <PreviewBox
            competition={competition}
            key={competition.id}
            onPress={() => router.push(`/teams/${competition.teamId}?tab=competencias`)}
            wide={wide}
          />
        ))}
      </View>
    </View>
  );
}
