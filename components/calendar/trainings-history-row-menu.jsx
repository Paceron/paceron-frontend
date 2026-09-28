import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function TrainingsHistoryRowMenu({ onSelect, onViewReview }) {
  return (
    <View className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="trainings-history-row-menu-panel" testID="trainings-history-row-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="trainings-history-row-menu-select"
        onPress={onSelect}
        testID="trainings-history-row-menu-select"
      >
        <MaterialCommunityIcons color="#64748b" name="checkbox-marked-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="trainings-history-row-menu-select-label" testID="trainings-history-row-menu-select-label">
          Seleccionar
        </Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="trainings-history-row-menu-review"
        onPress={onViewReview}
        testID="trainings-history-row-menu-review"
      >
        <MaterialCommunityIcons color="#64748b" name="clipboard-text-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="trainings-history-row-menu-review-label" testID="trainings-history-row-menu-review-label">
          Ver/editar registro
        </Text>
      </Pressable>
    </View>
  );
}
