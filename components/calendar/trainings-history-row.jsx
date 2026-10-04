// components/calendar/trainings-history-row.jsx
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatDisplayDate } from '../../utils/format-date-display.js';

// `group` llega de utils/trainings-history-grouping.js -- una sesión
// (sessionInstanceId+athleteUserId), no una serie. Mismo color que
// trainer-session-review-screen.jsx (verde=completo, rojo=nada registrado
// todavía no aplica acá porque esto es historial YA cerrado -- gris, no
// rojo, para "0 completadas" no es una interrupción, puede ser una sesión
// toda salteada a propósito).
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
    <Pressable
      ref={ref}
      accessibilityLabel="Más opciones"
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={idPrefix}
      onPress={handlePress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
    </Pressable>
  );
}

export function TrainingsHistoryRow({ group, role, selectionMode, selected, onToggleSelected, onOpenMenu, onOpenReview, containerRef }) {
  const idPrefix = `trainings-history-row-${group.id}`;
  const meta = completionMeta(group);

  const chipLabel = role === 'trainer'
    ? (group.groupName ?? 'Sin grupo')
    : [group.teamName, group.groupName].filter(Boolean).join(' · ') || 'Sin equipo';

  const handlePress = () => {
    if (selectionMode) {
      onToggleSelected(group.id);
      return;
    }
    onOpenReview(group);
  };

  return (
    <Pressable
      className={`gap-1 rounded-xl border p-3 ${selected ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface'}`}
      nativeID={idPrefix}
      onPress={handlePress}
      testID={idPrefix}
    >
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-top`} testID={`${idPrefix}-top`}>
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-primary-label`} numberOfLines={1} testID={`${idPrefix}-primary-label`}>
          {role === 'trainer' ? (group.athleteName ?? 'Corredor') : formatDisplayDate(group.date)}
        </Text>
        <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-top-right`} testID={`${idPrefix}-top-right`}>
          <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
            <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={13} />
            <Text className={`text-xs font-medium ${meta.color}`} nativeID={`${idPrefix}-status-label`} testID={`${idPrefix}-status-label`}>
              {group.completedCount}/{group.totalCount} series
            </Text>
          </View>
          {selectionMode ? (
            <Pressable
              accessibilityLabel={selected ? 'Quitar de la selección' : 'Agregar a la selección'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              nativeID={`${idPrefix}-checkbox`}
              onPress={() => onToggleSelected(group.id)}
              testID={`${idPrefix}-checkbox`}
            >
              <MaterialCommunityIcons color={selected ? '#8cc63e' : '#94a3b8'} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} />
            </Pressable>
          ) : (
            <MenuToggle containerRef={containerRef} group={group} idPrefix={`${idPrefix}-menu-toggle`} onOpenMenu={onOpenMenu} />
          )}
        </View>
      </View>

      {role === 'trainer' && (
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
          {formatDisplayDate(group.date)}
        </Text>
      )}

      <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session-name`} numberOfLines={1} testID={`${idPrefix}-session-name`}>
        {group.sessionName ?? 'Sesión eliminada'}
      </Text>

      <Text className="text-right text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-chip`} numberOfLines={1} testID={`${idPrefix}-chip`}>
        {chipLabel}
      </Text>
    </Pressable>
  );
}
