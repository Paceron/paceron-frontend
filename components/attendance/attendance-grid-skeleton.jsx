import { View } from 'react-native';
import { SkeletonBlock, SkeletonPulse } from '../shared/skeleton.jsx';

export function AttendanceGridSkeleton({ idPrefix = 'attendance-grid-skeleton' }) {
  return (
    <View nativeID={idPrefix} testID={idPrefix}>
      <SkeletonPulse idPrefix={`${idPrefix}-pulse`}>
        <View className="flex-row gap-2" nativeID={`${idPrefix}-metrics`} testID={`${idPrefix}-metrics`}>
          {[0, 1, 2].map((index) => (
            <SkeletonBlock
              className="flex-1"
              height={72}
              key={index}
              nativeID={`${idPrefix}-metric-${index}`}
              rounded="rounded-2xl"
              testID={`${idPrefix}-metric-${index}`}
            />
          ))}
        </View>
        <View className="mt-4 flex-row items-center gap-3" nativeID={`${idPrefix}-toolbar`} testID={`${idPrefix}-toolbar`}>
          <SkeletonBlock className="flex-1" height={44} nativeID={`${idPrefix}-search`} rounded="rounded-xl" testID={`${idPrefix}-search`} />
          <SkeletonBlock height={44} nativeID={`${idPrefix}-action`} rounded="rounded-xl" testID={`${idPrefix}-action`} width={44} />
        </View>
        <View className="mt-4 gap-2" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
          {[0, 1, 2, 3].map((index) => (
            <SkeletonBlock
              height={56}
              key={index}
              nativeID={`${idPrefix}-row-${index}`}
              rounded="rounded-xl"
              testID={`${idPrefix}-row-${index}`}
            />
          ))}
        </View>
      </SkeletonPulse>
    </View>
  );
}
