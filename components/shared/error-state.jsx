import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function ErrorState({ idPrefix, message, onRetry, retrying = false }) {
  const colors = useThemeColors();

  return (
    <View className="items-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 dark:border-rose-900/50 dark:bg-rose-950/20" nativeID={idPrefix} testID={idPrefix}>
      <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={24} nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`} />
      <Text className="mt-2 text-center text-sm font-medium text-rose-700 dark:text-rose-300" nativeID={`${idPrefix}-message`} testID={`${idPrefix}-message`}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: retrying, disabled: retrying }}
          className="mt-3 h-9 flex-row items-center gap-1.5 rounded-full border border-rose-300 px-4 active:opacity-70 dark:border-rose-800"
          disabled={retrying}
          nativeID={`${idPrefix}-retry-button`}
          onPress={onRetry}
          testID={`${idPrefix}-retry-button`}
        >
          {retrying ? <ActivityIndicator color={colors.error} size="small" /> : null}
          <Text className="text-xs font-bold text-rose-700 dark:text-rose-300" nativeID={`${idPrefix}-retry-label`} testID={`${idPrefix}-retry-label`}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
