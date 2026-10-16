import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Panel colapsable genérico. Nació como `FilterPanel` de filtros y hoy lo usan
// dos pantallas de calendario; el dashboard lo usa para filtros Y para "Calidad
// de los datos", que es la misma mecánica con otro rótulo.
//
// Lo que hace que un colapsado siga siendo útil es el `badge`: al cerrarse
// desaparece el contenido, pero el resumen queda en el header. Un filtro
// colapsado que no dice qué hay seleccionado deja de servir, y un aviso de
// calidad colapsado que no dice cuántas series están malas esconde justo lo que
// había que ver.
export function FilterPanel({
  children,
  hasActiveFilters,
  idPrefix,
  label = 'Filtros',
  loading,
  onClear,
  clearLabel = 'Limpiar',
  badge = null,
  badgeTone = 'muted',
  initiallyOpen = true,
}) {
  const colors = useThemeColors();
  // Abierto por default — da indicio de qué y cómo se puede filtrar en vez de
  // esconderlo detrás de un toggle; se puede cerrar igual a voluntad.
  const [open, setOpen] = useState(initiallyOpen);


  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={`${idPrefix}-root`} testID={`${idPrefix}-root`}>
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <View className="flex-1 flex-row items-center gap-2" nativeID={`${idPrefix}-header-left`} testID={`${idPrefix}-header-left`}>
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
            {label}
          </Text>
          {badge ? (
            <View className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800" nativeID={`${idPrefix}-badge`} testID={`${idPrefix}-badge`}>
              <Text
                className={badgeTone === 'warning'
                  ? 'text-[11px] font-semibold text-amber-700 dark:text-amber-400'
                  : 'text-[11px] font-medium text-slate-600 dark:text-slate-300'}
                nativeID={`${idPrefix}-badge-label`}
                testID={`${idPrefix}-badge-label`}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>

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
                {clearLabel}
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityHint={open ? 'Contraer' : 'Expandir'}
            accessibilityLabel={`${label}: ${open ? 'contraer' : 'expandir'}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
            hitSlop={8}
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
