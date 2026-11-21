import { View } from 'react-native';
import { SkeletonPulse } from '../shared/skeleton.jsx';

function SkeletonLine({ className, idPrefix }) {
  return <View className={className} nativeID={idPrefix} testID={idPrefix} />;
}

export function AchievementsGridSkeleton({ columnClass }) {
  return (
    <SkeletonPulse className="flex-row flex-wrap gap-3" idPrefix="achievements-tab-skeleton" testID="achievements-tab-skeleton">
      {Array.from({ length: 6 }).map((_, index) => {
        const idPrefix = `achievements-tab-skeleton-card-${index}`;
        return (
          <View className={`${columnClass} rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-800/50`} key={idPrefix} nativeID={idPrefix} testID={idPrefix}>
            <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
              <View className="h-6 w-6 rounded-full bg-slate-300 dark:bg-slate-600" nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`} />
              <SkeletonLine className="h-3 flex-1 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-title`} />
            </View>
            <SkeletonLine className="mt-2 h-3 w-2/3 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-subtitle`} />
            <SkeletonLine className="mt-3 h-2 w-full rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-progress`} />
          </View>
        );
      })}
    </SkeletonPulse>
  );
}

export function StreaksTabSkeleton() {
  return (
    <SkeletonPulse idPrefix="streaks-tab-skeleton" testID="streaks-tab-skeleton">
      <View className="flex-row gap-3" nativeID="streaks-tab-skeleton-cards" testID="streaks-tab-skeleton-cards">
        {[0, 1].map((index) => {
          const idPrefix = `streaks-tab-skeleton-card-${index}`;
          return (
            <View className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-700 dark:bg-slate-800/50" key={idPrefix} nativeID={idPrefix} testID={idPrefix}>
              <SkeletonLine className="h-6 w-20 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-value`} />
              <SkeletonLine className="mt-3 h-3 w-3/4 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-title`} />
              <SkeletonLine className="mt-3 h-2 w-1/2 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-best`} />
            </View>
          );
        })}
      </View>
      <View className="mt-5 rounded-2xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-700 dark:bg-slate-800/50" nativeID="streaks-tab-skeleton-week" testID="streaks-tab-skeleton-week">
        <SkeletonLine className="h-3 w-28 rounded bg-slate-300 dark:bg-slate-600" idPrefix="streaks-tab-skeleton-week-title" />
        <View className="mt-4 flex-row justify-between gap-1" nativeID="streaks-tab-skeleton-week-days" testID="streaks-tab-skeleton-week-days">
          {Array.from({ length: 7 }).map((_, index) => (
            <View className="h-11 flex-1 rounded-lg bg-slate-300 dark:bg-slate-600" key={index} nativeID={`streaks-tab-skeleton-week-day-${index}`} testID={`streaks-tab-skeleton-week-day-${index}`} />
          ))}
        </View>
        <SkeletonLine className="mt-4 h-2 w-1/3 rounded bg-slate-300 dark:bg-slate-600" idPrefix="streaks-tab-skeleton-week-footer" />
      </View>
    </SkeletonPulse>
  );
}

export function TrophyCaseTabSkeleton({ columnClass }) {
  return (
    <SkeletonPulse idPrefix="trophy-case-tab-skeleton" testID="trophy-case-tab-skeleton">
      <SkeletonLine className="mb-2 h-3 w-20 rounded bg-slate-300 dark:bg-slate-600" idPrefix="trophy-case-tab-skeleton-counters-title" />
      <View className="flex-row flex-wrap gap-3" nativeID="trophy-case-tab-skeleton-counters" testID="trophy-case-tab-skeleton-counters">
        {Array.from({ length: 4 }).map((_, index) => (
          <View className={`${columnClass} h-20 rounded-2xl bg-slate-200 dark:bg-slate-700`} key={index} nativeID={`trophy-case-tab-skeleton-counter-${index}`} testID={`trophy-case-tab-skeleton-counter-${index}`} />
        ))}
      </View>
      <SkeletonLine className="mb-2 mt-5 h-3 w-36 rounded bg-slate-300 dark:bg-slate-600" idPrefix="trophy-case-tab-skeleton-competitions-title" />
      <View className="flex-row flex-wrap gap-3" nativeID="trophy-case-tab-skeleton-competitions" testID="trophy-case-tab-skeleton-competitions">
        {Array.from({ length: 4 }).map((_, index) => (
          <View className={`${columnClass} h-24 rounded-2xl bg-slate-200 dark:bg-slate-700`} key={index} nativeID={`trophy-case-tab-skeleton-competition-${index}`} testID={`trophy-case-tab-skeleton-competition-${index}`} />
        ))}
      </View>
    </SkeletonPulse>
  );
}

export function CompetitionsTabSkeleton() {
  return (
    <SkeletonPulse idPrefix="my-competitions-tab-skeleton" testID="my-competitions-tab-skeleton">
      {Array.from({ length: 3 }).map((_, index) => {
        const idPrefix = `my-competitions-tab-skeleton-row-${index}`;
        return (
          <View className="m-2 rounded-xl bg-slate-200/70 p-4 dark:bg-slate-800/60" key={idPrefix} nativeID={idPrefix} testID={idPrefix}>
            <SkeletonLine className="h-4 w-3/4 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-title`} />
            <View className="mt-3 flex-row gap-3" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
              <SkeletonLine className="h-3 w-24 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-team`} />
              <SkeletonLine className="h-3 w-16 rounded bg-slate-300 dark:bg-slate-600" idPrefix={`${idPrefix}-status`} />
            </View>
          </View>
        );
      })}
    </SkeletonPulse>
  );
}
