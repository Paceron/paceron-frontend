import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { KIND_LABELS } from '../../utils/calendar-kind-colors.js';
import { StartSessionButton } from '../calendar/start-session-button.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { CalendarDayOverflowActions } from './calendar-day-overflow-actions.jsx';

// Fondos de tarjeta por kind -- paleta suave (a diferencia de
// KIND_FILLED_CLASS de group-calendar-screen.jsx, que es sólida/alto
// contraste para una celda de 56px): acá hay texto largo encima.
const KIND_CARD_CLASS = {
  training: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  other: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30',
  cancelled: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30',
};

const idPrefix = 'group-day-content-modal';

// Modal centrado con contenido asignado + acciones -- reemplaza a
// CalendarDayMenu solo para días con marking y kind !== 'rest' (ver
// group-calendar-screen.jsx). Editar/Estampar se promueven a pills
// propios; las 4 acciones menos frecuentes (Vaciar/Cancelar/Seleccionar/
// Desplazar) quedan en un overflow "..." vía CalendarDayOverflowActions,
// el mismo componente que usa CalendarDayMenu.
export function GroupDayContentModal({ visible, day, teamId, groupId, closed, onClose, onClear, onCancel, onSelect, onShift, onStamp }) {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWideLayout = isWeb && !isNarrowWeb;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState(null);
  const cardRef = useRef(null);
  const overflowButtonRef = useRef(null);

  if (!day) return null;

  const isCancelled = day.kind === 'cancelled';
  const isTraining = day.kind === 'training';
  const kindLabel = day.kind === 'other' ? (day.otherName || KIND_LABELS.other) : (KIND_LABELS[day.kind] ?? KIND_LABELS.other);
  const exerciseCount = day.sessionInstance?.exercises?.length ?? 0;

  const handleOpenOverflow = () => {
    if (!cardRef.current || !overflowButtonRef.current) return;
    cardRef.current.measureInWindow((containerX, containerY) => {
      overflowButtonRef.current?.measureInWindow((x, y, width, height) => {
        setOverflowAnchor({ x: x - containerX, y: y - containerY + height + 4 });
      });
    });
    setOverflowOpen(true);
  };

  const handleEdit = () => {
    onClose();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${day.date}`);
  };

  const handleStamp = () => {
    onClose();
    onStamp(day.date);
  };

  const handleOverflowAction = (action) => {
    setOverflowOpen(false);
    onClose();
    action(day.date);
  };

  return (
    <Modal animationType="fade" nativeID={idPrefix} onRequestClose={onClose} testID={idPrefix} transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable
          className={`relative w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface ${isWideLayout ? 'max-w-2xl flex-row gap-4' : 'max-w-md gap-4'}`}
          nativeID={`${idPrefix}-card`}
          onPress={() => {}}
          ref={cardRef}
          testID={`${idPrefix}-card`}
        >
          <View className={`rounded-xl border p-3 ${isWideLayout ? 'flex-1' : ''} ${KIND_CARD_CLASS[day.kind] ?? KIND_CARD_CLASS.other}`} nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-kicker`} testID={`${idPrefix}-kicker`}>
              {formatWeekdayLabel(day.date, { short: true })}, {formatDisplayDate(day.date)}
            </Text>
            <Text className="mt-1 text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
              {isCancelled ? 'Sesión cancelada' : kindLabel}
            </Text>
            {!isCancelled && day.sessionInstance && (
              <Text className="mt-0.5 text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session`} testID={`${idPrefix}-session`}>
                {day.sessionInstance.name}
                {exerciseCount > 0 ? ` · ${exerciseCount} ejercicio${exerciseCount === 1 ? '' : 's'}` : ''}
              </Text>
            )}
            {day.isPresencial && (
              <View className="mt-2 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
                <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
                  {day.presencialTimeFrom}–{day.presencialTimeTo}
                  {day.presencialLocation?.label ? ` · ${day.presencialLocation.label}` : ''}
                </Text>
              </View>
            )}
          </View>

          <View className={isWideLayout ? 'w-40 gap-2' : 'gap-2'} nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`}>
            <StartSessionButton assignment={day} role="trainer" teamId={teamId} />
            <Pressable
              className="h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID={`${idPrefix}-edit`}
              onPress={handleEdit}
              testID={`${idPrefix}-edit`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={14} />
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-edit-label`} testID={`${idPrefix}-edit-label`}>
                Editar
              </Text>
            </Pressable>
            {!closed && (
              <Pressable
                className="h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                nativeID={`${idPrefix}-stamp`}
                onPress={handleStamp}
                testID={`${idPrefix}-stamp`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="stamper" size={14} />
                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-stamp-label`} testID={`${idPrefix}-stamp-label`}>
                  Estampar plan
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityLabel="Más acciones"
              className="h-9 w-9 items-center justify-center self-end rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID={`${idPrefix}-overflow-trigger`}
              onPress={handleOpenOverflow}
              ref={overflowButtonRef}
              testID={`${idPrefix}-overflow-trigger`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-horizontal" size={18} />
            </Pressable>
          </View>

          <AnimatedDropdown anchorStyle={overflowAnchor ? { right: 8, top: overflowAnchor.y } : {}} onClose={() => setOverflowOpen(false)} open={overflowOpen}>
            <View className="w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID={`${idPrefix}-overflow-panel`} testID={`${idPrefix}-overflow-panel`}>
              <CalendarDayOverflowActions
                closed={closed}
                hasContent
                idPrefix={`${idPrefix}-overflow`}
                isTraining={isTraining}
                onCancel={() => handleOverflowAction(onCancel)}
                onClear={() => handleOverflowAction(onClear)}
                onSelect={() => handleOverflowAction(onSelect)}
                onShift={() => handleOverflowAction(onShift)}
              />
            </View>
          </AnimatedDropdown>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
