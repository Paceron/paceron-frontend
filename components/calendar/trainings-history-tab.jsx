import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function TrainingsHistoryTab() {
  const colors = useThemeColors();

  return (
    <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-surface" nativeID="trainings-history-tab-root" testID="trainings-history-tab-root">
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="history" size={32} />
      <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="trainings-history-tab-placeholder" testID="trainings-history-tab-placeholder">
        Próximamente vas a poder ver acá el historial de entrenamientos realizados.
      </Text>
    </View>
  );
}
