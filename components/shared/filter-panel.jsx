import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function FilterPanel({ hasActiveFilters, loading, onClear, children, idPrefix }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <View className="mb-4" nativeID={`${idPrefix}-root`} testID={`${idPrefix}-root`}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-70 ${
            open ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700'
          }`}
          nativeID={`${idPrefix}-toggle`}
          onPress={() => setOpen((v) => !v)}
          testID={`${idPrefix}-toggle`}
        >
          {loading ? (
            <ActivityIndicator color={colors.onSurfaceVariant} nativeID={`${idPrefix}-toggle-loading`} size="small" testID={`${idPrefix}-toggle-loading`} />
          ) : (
            <MaterialCommunityIcons color={open ? colors.primary : colors.onSurfaceVariant} name="filter-variant" size={16} />
          )}
          <Text className={`text-xs font-semibold ${open ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`} nativeID={`${idPrefix}-toggle-label`} testID={`${idPrefix}-toggle-label`}>
            Filtros
          </Text>
        </Pressable>

        {hasActiveFilters && (
          <Pressable
            className="flex-row items-center gap-1 rounded-full px-2 py-1.5 active:opacity-70"
            nativeID={`${idPrefix}-clear`}
            onPress={onClear}
            testID={`${idPrefix}-clear`}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle-outline" size={14} />
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-clear-label`} testID={`${idPrefix}-clear-label`}>
              Limpiar filtros
            </Text>
          </Pressable>
        )}
      </View>

      {open && (
        <View className="mt-3 gap-2" nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
          {children}
        </View>
      )}
    </View>
  );
}
