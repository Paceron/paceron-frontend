import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { ScreenCard } from '../shared/screen-card.jsx';
import { SkeletonBlock, SkeletonCircle, SkeletonPulse } from '../shared/skeleton.jsx';

export function TeamDetailSkeleton({ idPrefix = 'team-detail-skeleton', onBack }) {
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-6"
      nativeID={`${idPrefix}-scroll`}
      showsVerticalScrollIndicator={false}
      testID={`${idPrefix}-scroll`}
    >
      <ScreenCard nativeID={`${idPrefix}-container`} testID={`${idPrefix}-container`}>
        <Pressable
          accessibilityRole="button"
          className="mb-6 flex-row items-center gap-1.5 self-start py-1 pr-1 active:opacity-70"
          nativeID={`${idPrefix}-back-button`}
          onPress={onBack}
          testID={`${idPrefix}-back-button`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-back-label`} testID={`${idPrefix}-back-label`}>
            Equipos
          </Text>
        </Pressable>

        <SkeletonPulse nativeID={`${idPrefix}-pulse`} testID={`${idPrefix}-pulse`}>
          <View className="mb-5 flex-row items-start gap-4" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
            <SkeletonCircle nativeID={`${idPrefix}-avatar`} size={64} testID={`${idPrefix}-avatar`} />
            <View className="flex-1 gap-2" nativeID={`${idPrefix}-header-info`} testID={`${idPrefix}-header-info`}>
              <SkeletonBlock height={24} nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`} width="62%" />
              <SkeletonBlock height={16} nativeID={`${idPrefix}-location`} testID={`${idPrefix}-location`} width="42%" />
            </View>
            <SkeletonCircle nativeID={`${idPrefix}-action-1`} size={36} testID={`${idPrefix}-action-1`} />
            <SkeletonCircle nativeID={`${idPrefix}-action-2`} size={36} testID={`${idPrefix}-action-2`} />
          </View>

          <SkeletonBlock height={44} nativeID={`${idPrefix}-tabs`} testID={`${idPrefix}-tabs`} width="100%" />

          <View className="mt-5 gap-2" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
            {[0, 1, 2].map((i) => (
              <View className="flex-row items-center gap-3 px-4 py-3" key={i} nativeID={`${idPrefix}-row-${i}`} testID={`${idPrefix}-row-${i}`}>
                <SkeletonCircle nativeID={`${idPrefix}-row-${i}-avatar`} size={36} testID={`${idPrefix}-row-${i}-avatar`} />
                <View className="flex-1 gap-2" nativeID={`${idPrefix}-row-${i}-text`} testID={`${idPrefix}-row-${i}-text`}>
                  <SkeletonBlock height={14} nativeID={`${idPrefix}-row-${i}-name`} testID={`${idPrefix}-row-${i}-name`} width="52%" />
                  <SkeletonBlock height={12} nativeID={`${idPrefix}-row-${i}-meta`} testID={`${idPrefix}-row-${i}-meta`} width="34%" />
                </View>
              </View>
            ))}
          </View>
        </SkeletonPulse>
      </ScreenCard>
    </ScrollView>
  );
}

export function TeamGroupsSkeleton({ idPrefix = 'team-groups-skeleton' }) {
  return (
    <SkeletonPulse nativeID={`${idPrefix}-pulse`} testID={`${idPrefix}-pulse`}>
      <View className="gap-2" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
        {[0, 1].map((i) => (
          <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700" key={i} nativeID={`${idPrefix}-row-${i}`} testID={`${idPrefix}-row-${i}`}>
            <SkeletonBlock height={20} nativeID={`${idPrefix}-row-${i}-icon`} testID={`${idPrefix}-row-${i}-icon`} width={20} />
            <SkeletonBlock height={14} nativeID={`${idPrefix}-row-${i}-name`} testID={`${idPrefix}-row-${i}-name`} width="48%" />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}
