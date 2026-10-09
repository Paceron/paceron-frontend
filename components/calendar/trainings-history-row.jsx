// components/calendar/trainings-history-row.jsx
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatDisplayDate } from '../../utils/format-date-display.js';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// `group` llega de utils/trainings-history-grouping.js -- una sesión
// (sessionInstanceId+athleteUserId), no una serie. Verde=todo completo,
// gris=nada registrado (no es un rojo de interrupción -- esto es historial
// ya cerrado, 0 completadas puede ser una sesión salteada a propósito),
// ámbar=mezcla.
function completionMeta(group) {
  if (group.completedCount === group.totalCount) {
    return { color: 'text-emerald-700 dark:text-emerald-400', icon: 'check-circle', iconColor: '#047857' };
  }
  if (group.completedCount === 0) {
    return { color: 'text-slate-500 dark:text-slate-400', icon: 'skip-next-circle-outline', iconColor: '#64748b' };
  }
  return { color: 'text-amber-700 dark:text-amber-400', icon: 'circle-slice-5', iconColor: '#b45309' };
}

function MenuToggle({ group, onOpenMenu, containerRef, idPrefix }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, group);
      });
    });
  };

  return (
    <IconTooltip idPrefix={`${idPrefix}-tooltip`} label="Más opciones">
      <Pressable
        ref={ref}
        accessibilityLabel="Más opciones"
        className="shrink-0 rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
        nativeID={idPrefix}
        onPress={handlePress}
        testID={idPrefix}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
      </Pressable>
    </IconTooltip>
  );
}

export function TrainingsHistoryRow({ group, role, selectionMode, selected, onToggleSelected, onOpenMenu, onOpenReview, containerRef }) {
  const colors = useThemeColors();
  const idPrefix = `trainings-history-row-${group.id}`;
  const meta = completionMeta(group);

  const handlePress = () => {
    if (selectionMode) {
      onToggleSelected(group.id);
      return;
    }
    onOpenReview(group);
  };

  return (
    <Pressable
      className={`gap-1.5 rounded-xl border p-2.5 ${selected ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface'}`}
      nativeID={idPrefix}
      onPress={handlePress}
      testID={idPrefix}
    >
      <View className="flex-row items-start justify-between gap-2" nativeID={`${idPrefix}-top`} testID={`${idPrefix}-top`}>
        {/* Orden fijo: fecha, nombre de sesión, corredor (solo entrenador) --
            flex-wrap deja que reordene a varias líneas solo cuando el ancho
            no alcanza, sin breakpoints de plataforma (mismo truco que
            session-review-screen-title-row). */}
        <View className="flex-1 flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5" nativeID={`${idPrefix}-primary`} testID={`${idPrefix}-primary`}>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
            {formatDisplayDate(group.date)}
          </Text>
          <Text className="text-slate-300 dark:text-slate-600" nativeID={`${idPrefix}-sep-session`} testID={`${idPrefix}-sep-session`}>·</Text>
          <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session-name`} numberOfLines={1} testID={`${idPrefix}-session-name`}>
            {group.sessionName ?? 'Sesión eliminada'}
          </Text>
          {role === 'trainer' && (
            <>
              <Text className="text-slate-300 dark:text-slate-600" nativeID={`${idPrefix}-sep-athlete`} testID={`${idPrefix}-sep-athlete`}>·</Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-athlete-name`} numberOfLines={1} testID={`${idPrefix}-athlete-name`}>
                {group.athleteName ?? 'Corredor'}
              </Text>
            </>
          )}
        </View>

        {selectionMode ? (
          <IconTooltip idPrefix={`${idPrefix}-checkbox-tooltip`} label={selected ? 'Quitar de la selección' : 'Agregar a la selección'}>
            <Pressable
              accessibilityLabel={selected ? 'Quitar de la selección' : 'Agregar a la selección'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              className="shrink-0"
              nativeID={`${idPrefix}-checkbox`}
              onPress={() => onToggleSelected(group.id)}
              testID={`${idPrefix}-checkbox`}
            >
              <MaterialCommunityIcons color={selected ? '#8cc63e' : '#94a3b8'} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} />
            </Pressable>
          </IconTooltip>
        ) : (
          <MenuToggle containerRef={containerRef} group={group} idPrefix={`${idPrefix}-menu-toggle`} onOpenMenu={onOpenMenu} />
        )}
      </View>

      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
        {role !== 'trainer' && group.teamName && (
          <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-team`} testID={`${idPrefix}-team`}>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={13} />
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team-label`} numberOfLines={1} testID={`${idPrefix}-team-label`}>
              {group.teamName}
            </Text>
          </View>
        )}
        {group.groupName && (
          <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={13} />
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-group-label`} numberOfLines={1} testID={`${idPrefix}-group-label`}>
              {group.groupName}
            </Text>
          </View>
        )}
        <View className="ml-auto flex-row items-center gap-1" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
          <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={13} />
          <Text className={`text-xs font-medium ${meta.color}`} nativeID={`${idPrefix}-status-label`} testID={`${idPrefix}-status-label`}>
            {group.completedCount}/{group.totalCount} series
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
