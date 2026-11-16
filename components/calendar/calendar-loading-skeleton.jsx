import { View } from 'react-native';
import { SkeletonPulse } from '../shared/skeleton.jsx';

const WEEK_DAYS = 7;
const WEEKS = 6;
const BLOCK = 'bg-slate-200 dark:bg-slate-700';

export function CalendarLoadingSkeleton({ idPrefix = 'calendar-loading', surfaceClassName = 'bg-white dark:bg-surface' }) {
  return (
    <View
      accessibilityLabel="Cargando calendario"
      className={`absolute inset-0 overflow-hidden rounded-2xl p-2 ${surfaceClassName}`}
      nativeID={`${idPrefix}-skeleton`}
      pointerEvents="auto"
      testID={`${idPrefix}-skeleton`}
    >
      <SkeletonPulse className="flex-1" nativeID={`${idPrefix}-skeleton-pulse`} testID={`${idPrefix}-skeleton-pulse`}>
        <View className="mb-3 flex-row items-center justify-between px-1" nativeID={`${idPrefix}-skeleton-header`} testID={`${idPrefix}-skeleton-header`}>
          <View className={`h-8 w-32 rounded-lg ${BLOCK}`} nativeID={`${idPrefix}-skeleton-title`} testID={`${idPrefix}-skeleton-title`} />
          <View className="flex-row gap-2" nativeID={`${idPrefix}-skeleton-actions`} testID={`${idPrefix}-skeleton-actions`}>
            <View className={`h-8 w-8 rounded-full ${BLOCK}`} nativeID={`${idPrefix}-skeleton-action-1`} testID={`${idPrefix}-skeleton-action-1`} />
            <View className={`h-8 w-8 rounded-full ${BLOCK}`} nativeID={`${idPrefix}-skeleton-action-2`} testID={`${idPrefix}-skeleton-action-2`} />
          </View>
        </View>
        <View className="mb-1 flex-row" nativeID={`${idPrefix}-skeleton-weekdays`} testID={`${idPrefix}-skeleton-weekdays`}>
          {Array.from({ length: WEEK_DAYS }).map((_, index) => (
            <View className="flex-1 items-center py-1" key={index} nativeID={`${idPrefix}-skeleton-weekday-${index}`} testID={`${idPrefix}-skeleton-weekday-${index}`}>
              <View className={`h-2.5 w-5 rounded-full ${BLOCK}`} nativeID={`${idPrefix}-skeleton-weekday-block-${index}`} testID={`${idPrefix}-skeleton-weekday-block-${index}`} />
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap" nativeID={`${idPrefix}-skeleton-grid`} testID={`${idPrefix}-skeleton-grid`}>
          {Array.from({ length: WEEK_DAYS * WEEKS }).map((_, index) => (
            <View className="w-[14.2857%] items-center p-0.5" key={index} nativeID={`${idPrefix}-skeleton-cell-${index}`} testID={`${idPrefix}-skeleton-cell-${index}`}>
              <View className={`h-14 w-full rounded-xl ${BLOCK}`} nativeID={`${idPrefix}-skeleton-cell-block-${index}`} testID={`${idPrefix}-skeleton-cell-block-${index}`} />
            </View>
          ))}
        </View>
      </SkeletonPulse>
    </View>
  );
}
