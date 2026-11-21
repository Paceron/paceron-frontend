import { ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { SkeletonBlock, SkeletonPulse } from '../shared/skeleton.jsx';
import { ScreenCard } from '../shared/screen-card.jsx';

export function PaymentsScreenSkeleton({ idPrefix = 'payments-screen-skeleton', onBack = null }) {
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-6"
      nativeID={`${idPrefix}-scroll`}
      showsVerticalScrollIndicator={false}
      testID={`${idPrefix}-scroll`}
    >
      <ScreenCard maxWidthClassName="max-w-5xl" nativeID={`${idPrefix}-container`} testID={`${idPrefix}-container`}>
        <View className="mb-6 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          {onBack ? (
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          ) : null}
          <Text
            className="text-xl text-slate-900 dark:text-white"
            nativeID={`${idPrefix}-title`}
            style={{ fontFamily: 'Orbitron_700Bold' }}
            testID={`${idPrefix}-title`}
          >
            Pagos
          </Text>
        </View>

        <SkeletonPulse nativeID={`${idPrefix}-pulse`} testID={`${idPrefix}-pulse`}>
          <View className="mb-5 flex-row gap-2" nativeID={`${idPrefix}-tabs`} testID={`${idPrefix}-tabs`}>
            <SkeletonBlock height={40} nativeID={`${idPrefix}-tab-1`} rounded="rounded-full" testID={`${idPrefix}-tab-1`} width={110} />
            <SkeletonBlock height={40} nativeID={`${idPrefix}-tab-2`} rounded="rounded-full" testID={`${idPrefix}-tab-2`} width={110} />
          </View>

          <View className="mb-4 flex-row flex-wrap gap-3" nativeID={`${idPrefix}-tiles`} testID={`${idPrefix}-tiles`}>
            {['one', 'two', 'three'].map((slot) => (
              <SkeletonBlock
                height={92}
                key={slot}
                nativeID={`${idPrefix}-tile-${slot}`}
                rounded="rounded-2xl"
                testID={`${idPrefix}-tile-${slot}`}
                width="31%"
              />
            ))}
          </View>

          <SkeletonBlock height={150} nativeID={`${idPrefix}-chart`} rounded="rounded-2xl" testID={`${idPrefix}-chart`} width="100%" />

          <View className="mt-4" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
            {['one', 'two', 'three', 'four'].map((slot) => (
              <View className="mb-3" key={slot} nativeID={`${idPrefix}-row-${slot}`} testID={`${idPrefix}-row-${slot}`}>
                <SkeletonBlock height={58} nativeID={`${idPrefix}-row-${slot}-block`} rounded="rounded-xl" testID={`${idPrefix}-row-${slot}-block`} width="100%" />
              </View>
            ))}
          </View>
        </SkeletonPulse>
      </ScreenCard>
    </ScrollView>
  );
}
