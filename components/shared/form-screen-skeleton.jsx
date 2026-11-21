import { ScrollView, Text, View } from 'react-native';
import { ScreenCard } from './screen-card.jsx';
import { SkeletonBlock, SkeletonPulse } from './skeleton.jsx';
import { IconButton } from './icon-button.jsx';
import { ErrorState } from './error-state.jsx';

function FormScreenHeader({ idPrefix, onBack, title }) {
  return (
    <View className="mb-8 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
      <IconButton
        icon="arrow-left"
        idPrefix={`${idPrefix}-back-button`}
        label="Volver"
        onPress={onBack}
        size={32}
        variant="ghost"
      />
      {title ? (
        <Text className="text-xl text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} style={{ fontFamily: 'Orbitron_700Bold' }} testID={`${idPrefix}-title`}>
          {title}
        </Text>
      ) : (
        <SkeletonBlock height={24} nativeID={`${idPrefix}-title-skeleton`} testID={`${idPrefix}-title-skeleton`} width={150} />
      )}
    </View>
  );
}

export function FormScreenSkeleton({ idPrefix = 'form-screen', onBack }) {
  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID={`${idPrefix}-skeleton-scroll`}
      showsVerticalScrollIndicator={false}
      testID={`${idPrefix}-skeleton-scroll`}
    >
      <ScreenCard nativeID={`${idPrefix}-skeleton-card`} testID={`${idPrefix}-skeleton-card`}>
        <SkeletonPulse nativeID={`${idPrefix}-skeleton`} testID={`${idPrefix}-skeleton`}>
          <FormScreenHeader idPrefix={`${idPrefix}-skeleton`} onBack={onBack} />
          {[0, 1].map((section) => (
            <View
              className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-surface-2"
              key={section}
              nativeID={`${idPrefix}-skeleton-section-${section}`}
              testID={`${idPrefix}-skeleton-section-${section}`}
            >
              <SkeletonBlock height={18} nativeID={`${idPrefix}-skeleton-section-${section}-title`} testID={`${idPrefix}-skeleton-section-${section}-title`} width={120} />
              <View
                className="mt-4 gap-3"
                nativeID={`${idPrefix}-skeleton-section-${section}-fields`}
                testID={`${idPrefix}-skeleton-section-${section}-fields`}
              >
                <SkeletonBlock height={48} nativeID={`${idPrefix}-skeleton-section-${section}-field-0`} testID={`${idPrefix}-skeleton-section-${section}-field-0`} width="100%" />
                <SkeletonBlock height={48} nativeID={`${idPrefix}-skeleton-section-${section}-field-1`} testID={`${idPrefix}-skeleton-section-${section}-field-1`} width="100%" />
              </View>
            </View>
          ))}
        </SkeletonPulse>
      </ScreenCard>
    </ScrollView>
  );
}

export function FormScreenError({ idPrefix = 'form-screen', message, onBack, onRetry, retrying = false, title }) {
  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID={`${idPrefix}-error-scroll`}
      showsVerticalScrollIndicator={false}
      testID={`${idPrefix}-error-scroll`}
    >
      <ScreenCard nativeID={`${idPrefix}-error-card`} testID={`${idPrefix}-error-card`}>
        <FormScreenHeader idPrefix={`${idPrefix}-error`} onBack={onBack} title={title} />
        <ErrorState idPrefix={`${idPrefix}-error-state`} message={message} onRetry={onRetry} retrying={retrying} />
      </ScreenCard>
    </ScrollView>
  );
}
