import { View } from 'react-native';
import { SkeletonBlock, SkeletonPulse } from '../shared/skeleton.jsx';

export function TrainingsHistorySkeleton({ idPrefix = 'trainings-history-skeleton' }) {
  return (
    <SkeletonPulse nativeID={idPrefix} testID={idPrefix}>
      <View className="gap-2" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
        {[0, 1, 2].map((i) => (
          <View className="gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700" key={i} nativeID={`${idPrefix}-row-${i}`} testID={`${idPrefix}-row-${i}`}>
            <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-row-${i}-top`} testID={`${idPrefix}-row-${i}-top`}>
              <SkeletonBlock height={14} nativeID={`${idPrefix}-row-${i}-date`} testID={`${idPrefix}-row-${i}-date`} width="22%" />
              <SkeletonBlock height={14} nativeID={`${idPrefix}-row-${i}-name`} testID={`${idPrefix}-row-${i}-name`} width="44%" />
            </View>
            <SkeletonBlock height={12} nativeID={`${idPrefix}-row-${i}-meta`} testID={`${idPrefix}-row-${i}-meta`} width="58%" />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}
