import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function FilterPanel({ hasActiveFilters, loading, onClear, children, idPrefix }) {
  const colors = useThemeColors();
  // Abierto por default -- da indicio de qué y cómo se puede filtrar en vez
  // de esconderlo detrás de un toggle; se puede cerrar igual a voluntad.
  const [open, setOpen] = useState(true);

  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={`${idPrefix}-root`} testID={`${idPrefix}-root`}>
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          Filtros
        </Text>

        <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header-actions`} testID={`${idPrefix}-header-actions`}>
          {hasActiveFilters && (
            <Pressable
              className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
              nativeID={`${idPrefix}-clear`}
              onPress={onClear}
              testID={`${idPrefix}-clear`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle-outline" size={14} />
              <Text className="text-xs font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-clear-label`} testID={`${idPrefix}-clear-label`}>
                Limpiar
              </Text>
            </Pressable>
          )}

          <Pressable
            className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
            nativeID={`${idPrefix}-toggle`}
            onPress={() => setOpen((v) => !v)}
            testID={`${idPrefix}-toggle`}
          >
            {loading ? (
              <ActivityIndicator color={colors.onSurfaceVariant} nativeID={`${idPrefix}-toggle-loading`} size="small" testID={`${idPrefix}-toggle-loading`} />
            ) : (
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name={open ? 'chevron-up' : 'chevron-down'} size={20} />
            )}
          </Pressable>
        </View>
      </View>

      {open && (
        <View className="mt-3 flex-row flex-wrap gap-2" nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
          {children}
        </View>
      )}
    </View>
  );
}
