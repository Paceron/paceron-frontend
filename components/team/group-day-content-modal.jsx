import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { KIND_LABELS, KIND_CARD_CLASS } from '../../utils/calendar-kind-colors.js';
import { StartSessionButton } from '../calendar/start-session-button.jsx';
import { CalendarDayOverflowActions } from './calendar-day-overflow-actions.jsx';

const idPrefix = 'group-day-content-modal';
const PILL_TEXT_CLASS = 'text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200';

// Modal centrado con contenido asignado + acciones -- reemplaza a
// CalendarDayMenu solo para días con marking y kind !== 'rest' (ver
// group-calendar-screen.jsx). Tarjeta de contenido arriba, acciones
// debajo, en los dos layouts (2026-11-11, antes era 2 columnas lado a
// lado en ancho -- con la tarjeta mucho más alta que los pills, dejaba
// poco ancho real para el texto de los botones). Las acciones van en
// grilla de 2 columnas en web ancha (entra el texto completo con más
// ancho disponible) y apiladas en 1 columna en mobile/web angosta (2
// columnas angostas no alcanzaban para textos largos como "Desplazar
// desde acá", quedaban cortados).
export function GroupDayContentModal({ visible, day, teamId, groupId, closed, onClose, onClear, onCancel, onSelect, onShift, onStamp }) {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWideLayout = isWeb && !isNarrowWeb;
  const pillWidthClass = isWideLayout ? 'w-[48%]' : 'w-full';
  const pillClass = `${pillWidthClass} h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 px-2 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800`;

  if (!day) return null;

  const isCancelled = day.kind === 'cancelled';
  const isTraining = day.kind === 'training';
  const kindLabel = day.kind === 'other' ? (day.otherName || KIND_LABELS.other) : (KIND_LABELS[day.kind] ?? KIND_LABELS.other);
  const exerciseCount = day.sessionInstance?.exercises?.length ?? 0;

  const handleEdit = () => {
    onClose();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${day.date}`);
  };

  const handleStamp = () => {
    onClose();
    onStamp(day.date);
  };

  const handleSecondaryAction = (action) => {
    onClose();
    action(day.date);
  };

  return (
    <Modal animationType="fade" nativeID={idPrefix} onRequestClose={onClose} testID={idPrefix} transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable
          className={`relative w-full gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface ${isWideLayout ? 'max-w-xl' : 'max-w-md'}`}
          nativeID={`${idPrefix}-card`}
          onPress={() => {}}
          testID={`${idPrefix}-card`}
        >
          <View className={`rounded-xl border p-3 ${KIND_CARD_CLASS[day.kind] ?? KIND_CARD_CLASS.other}`} nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
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

          <View nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`}>
            <View className="w-full" nativeID={`${idPrefix}-start-session-slot`} testID={`${idPrefix}-start-session-slot`}>
              <StartSessionButton assignment={day} role="trainer" teamId={teamId} />
            </View>
            <View className={`mt-2 gap-2 ${isWideLayout ? 'flex-row flex-wrap' : ''}`} nativeID={`${idPrefix}-actions-grid`} testID={`${idPrefix}-actions-grid`}>
              <Pressable
                className={pillClass}
                nativeID={`${idPrefix}-edit`}
                onPress={handleEdit}
                testID={`${idPrefix}-edit`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={14} />
                <Text className={PILL_TEXT_CLASS} nativeID={`${idPrefix}-edit-label`} numberOfLines={1} testID={`${idPrefix}-edit-label`}>
                  Editar
                </Text>
              </Pressable>
              {!closed && (
                <Pressable
                  className={pillClass}
                  nativeID={`${idPrefix}-stamp`}
                  onPress={handleStamp}
                  testID={`${idPrefix}-stamp`}
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="stamper" size={14} />
                  <Text className={PILL_TEXT_CLASS} nativeID={`${idPrefix}-stamp-label`} numberOfLines={1} testID={`${idPrefix}-stamp-label`}>
                    Estampar plan
                  </Text>
                </Pressable>
              )}
              <CalendarDayOverflowActions
                closed={closed}
                hasContent
                idPrefix={`${idPrefix}-action`}
                isTraining={isTraining}
                onCancel={() => handleSecondaryAction(onCancel)}
                onClear={() => handleSecondaryAction(onClear)}
                onSelect={() => handleSecondaryAction(onSelect)}
                onShift={() => handleSecondaryAction(onShift)}
                pillWidthClass={pillWidthClass}
                variant="pill"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
