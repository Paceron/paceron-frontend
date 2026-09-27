// components/calendar/trainings-history-row.jsx
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatClock } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { formatDisplayDate } from '../../utils/format-date-display.js';

const STATUS_META = {
  completed: { label: 'Completada', color: 'text-emerald-700 dark:text-emerald-400', icon: 'check-circle' },
  skipped: { label: 'Saltada', color: 'text-slate-500 dark:text-slate-400', icon: 'skip-next-circle-outline' },
};

function StatusBadge({ status, idPrefix }) {
  const meta = STATUS_META[status] ?? { label: status ?? 'Sin estado', color: 'text-slate-400 dark:text-slate-500', icon: 'circle-outline' };
  return (
    <View className="flex-row items-center gap-1" nativeID={idPrefix} testID={idPrefix}>
      <MaterialCommunityIcons color="currentColor" name={meta.icon} size={13} style={{ color: 'inherit' }} />
      <Text className={`text-xs font-medium ${meta.color}`} nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>{meta.label}</Text>
    </View>
  );
}

function MenuToggle({ item, onOpenMenu, containerRef, idPrefix }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, item);
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

export function TrainingsHistoryRow({ item, role, selectionMode, selected, onToggleSelected, onOpenMenu, containerRef }) {
  const idPrefix = `trainings-history-row-${item.id}`;
  const statLine = [
    `Serie ${item.setNumber}`,
    item.durationMs != null ? formatClock(item.durationMs) : null,
    item.distanceMeters != null ? formatMeters(item.distanceMeters) : null,
  ].filter(Boolean).join(' · ');

  const chipLabel = role === 'trainer'
    ? (item.groupName ?? 'Sin grupo')
    : [item.teamName, item.groupName].filter(Boolean).join(' · ') || 'Sin equipo';

  return (
    <Pressable
      className={`gap-1 rounded-xl border p-3 ${selected ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface'}`}
      nativeID={idPrefix}
      onPress={() => selectionMode && onToggleSelected(item.id)}
      testID={idPrefix}
    >
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-top`} testID={`${idPrefix}-top`}>
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-primary-label`} numberOfLines={1} testID={`${idPrefix}-primary-label`}>
          {role === 'trainer' ? (item.athleteName ?? 'Corredor') : formatDisplayDate(item.date)}
        </Text>
        <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-top-right`} testID={`${idPrefix}-top-right`}>
          <StatusBadge idPrefix={`${idPrefix}-status`} status={item.completionStatus} />
          {selectionMode ? (
            <Pressable
              accessibilityLabel={selected ? 'Quitar de la selección' : 'Agregar a la selección'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              nativeID={`${idPrefix}-checkbox`}
              onPress={() => onToggleSelected(item.id)}
              testID={`${idPrefix}-checkbox`}
            >
              <MaterialCommunityIcons color={selected ? '#8cc63e' : '#94a3b8'} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} />
            </Pressable>
          ) : (
            <MenuToggle containerRef={containerRef} idPrefix={`${idPrefix}-menu-toggle`} item={item} onOpenMenu={onOpenMenu} />
          )}
        </View>
      </View>

      {role === 'trainer' && (
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
          {formatDisplayDate(item.date)}
        </Text>
      )}

      <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session-exercise`} numberOfLines={1} testID={`${idPrefix}-session-exercise`}>
        {[item.sessionName, item.exerciseName].filter(Boolean).join(' · ') || 'Sesión eliminada'}
      </Text>

      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-bottom`} testID={`${idPrefix}-bottom`}>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat-line`} testID={`${idPrefix}-stat-line`}>
          {statLine || '—'}
        </Text>
        <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-chip`} numberOfLines={1} testID={`${idPrefix}-chip`}>
          {chipLabel}
        </Text>
      </View>
    </Pressable>
  );
}
