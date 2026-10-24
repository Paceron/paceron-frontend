import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Panel colapsable genérico. Nació como `FilterPanel` de filtros y hoy lo usan
// dos pantallas de calendario; el dashboard lo usa dos veces: para "Filtros" y
// para "Calidad de los datos" (con `tone="warning"`).
//
// Lo que hace que un colapsado siga siendo útil es el `badge`: al cerrarse
// desaparece el contenido, pero el resumen queda en el header. Un filtro
// colapsado que no dice qué hay seleccionado deja de servir, y un aviso de
// calidad colapsado que no dice cuántas series están malas esconde justo lo que
// había que ver. Por eso el dashboard los usa como DOS paneles hermanos y no
// como uno solo con las dos cosas adentro: cada badge dice lo suyo y cada uno se
// cierra por su cuenta (ver dashboard-screen.jsx).
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
  contentClassName = 'mt-3 flex-row flex-wrap gap-2',
  icon = null,
  initiallyOpen = true,
  meta = null,
  tone = 'default',
}) {
  const colors = useThemeColors();
  // Abierto por default — da indicio de qué y cómo se puede filtrar en vez de
  // esconderlo detrás de un toggle; se puede cerrar igual a voluntad.
  const [open, setOpen] = useState(initiallyOpen);

  // El tono cambia la identidad de la card, no su mecánica: el aviso de calidad
  // se tiene que seguir leyendo como aviso (ámbar + el `border-l-4` grueso que
  // lo separa de las tarjetas de KPI) aunque ahora sea un panel colapsable.
  const isWarning = tone === 'warning';
  const cardClass = isWarning
    ? 'mb-4 rounded-2xl border border-l-4 border-amber-300 border-l-amber-600 bg-amber-50 p-4 dark:border-amber-900/50 dark:border-l-amber-400 dark:bg-amber-950/20'
    : 'mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface';
  const labelClass = isWarning
    ? 'text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300'
    : 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
  const iconColor = isWarning ? '#f59e0b' : colors.onSurfaceVariant;
  const badgeClass = isWarning
    ? 'rounded-full bg-amber-100/70 px-2 py-0.5 dark:bg-amber-900/40'
    : 'rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800';
  const toggleClass = isWarning
    ? 'h-8 w-8 items-center justify-center rounded-full hover:bg-amber-100/70 active:opacity-70 dark:hover:bg-amber-900/40'
    : 'h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800';

  return (
    <View className={cardClass} nativeID={`${idPrefix}-root`} testID={`${idPrefix}-root`}>
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <View className="flex-1 flex-row items-center gap-2" nativeID={`${idPrefix}-header-left`} testID={`${idPrefix}-header-left`}>
          {icon ? <MaterialCommunityIcons color={iconColor} name={icon} size={16} /> : null}
          <Text className={labelClass} nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
            {label}
          </Text>
          {badge ? (
            <View className={badgeClass} nativeID={`${idPrefix}-badge`} testID={`${idPrefix}-badge`}>
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
          {/* `meta`: el contexto que no es un conteo — hoy el scope de los
              filtros ("Todo el equipo · Pasadas 1000 m"). Va dentro de
              `header-left` (que es `flex-1`) para que pueda encogerse y cortarse
              con puntos suspensivos en vez de empujar los botones fuera de la
              card, y alineado a la derecha del bloque. */}
          {meta ? (
            <Text
              className="ml-auto text-right text-[11px] text-slate-500 dark:text-slate-400"
              nativeID={`${idPrefix}-meta`}
              numberOfLines={1}
              testID={`${idPrefix}-meta`}
            >
              {meta}
            </Text>
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
            className={toggleClass}
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
        <View className={contentClassName} nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
          {children}
        </View>
      )}
    </View>
  );
}
