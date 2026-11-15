import { ActivityIndicator, Text, View } from 'react-native';

export function LoadingOverlay({ visible, id = 'loading-overlay', label, fullScreen = false }) {
  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal
      className={`absolute inset-0 items-center justify-center px-6 ${fullScreen ? '' : 'rounded-2xl'}`}
      nativeID={`${id}-overlay`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)', pointerEvents: 'auto', zIndex: 50 }}
      testID={`${id}-overlay`}
    >
      <ActivityIndicator color="#8cc63e" size="large" />
      {label ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-4 text-center text-base font-semibold text-white"
          nativeID={`${id}-label`}
          testID={`${id}-label`}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
