import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';

export function HomeLoadingOverlay({ visible, idPrefix = 'home-loading' }) {
  const colors = useThemeColors();

  if (!visible) return null;

  return (
    <View
      accessibilityLabel="Cargando inicio"
      accessibilityViewIsModal
      nativeID={`${idPrefix}-overlay`}
      pointerEvents="auto"
      style={styles.overlay}
      testID={`${idPrefix}-overlay`}
    >
      <View className="absolute inset-0 bg-paper dark:bg-ink" nativeID={`${idPrefix}-background`} testID={`${idPrefix}-background`} />
      <View className="absolute inset-0 items-center justify-center" nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </View>
  );
}

const styles = {
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
};
