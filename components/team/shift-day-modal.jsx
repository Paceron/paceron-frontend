import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { addDaysISO } from '../../utils/build-stamp-draft.js';
import { formatDisplayDate } from '../../utils/format-date-display.js';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

// Desplaza TODO lo que sigue desde `fromDate` (inclusive) N días adelante
// — no es "mover este día puntual", el backend corre todas las filas con
// date >= from_date (docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §4). El
// stepper +/- reusa el mismo patrón visual que la cantidad de días de un
// plan (components/plans/training-plan-form-fields.jsx).
export function ShiftDayModal({ visible, onClose, groupId, fromDate }) {
  const colors = useThemeColors();
  const { shiftCalendar, isShifting } = useGroupCalendarMutations(groupId);

  const [days, setDays] = useState(1);

  const resetKey = visible;
  const prevResetKeyRef = useRef(resetKey);
  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey;
    setDays(1);
  }

  if (!fromDate) return null;

  const handleSubmit = async () => {
    const result = await shiftCalendar({ fromDate, days });
    if (!result.success) {
      notifyError();
      if (result.conflict) {
        Toast.show({ type: 'error', text1: 'No pudimos desplazar', text2: result.message ?? 'El corrimiento chocaría con una fecha existente.' });
      } else {
        Toast.show({ type: 'error', text1: 'No pudimos desplazar el calendario', text2: result.error });
      }
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: `Calendario desplazado ${days} día${days === 1 ? '' : 's'}` });
    if (result.sameTeamWarnings?.length > 0) {
      Toast.show({ type: 'info', text1: 'Superposición con otro grupo', text2: 'Mismo equipo — se guardó igual.' });
    }
    onClose();
  };

  return (
    <Modal animationType="fade" nativeID="shift-day-modal" onRequestClose={onClose} testID="shift-day-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="shift-day-modal-backdrop" onPress={onClose} testID="shift-day-modal-backdrop">
        <Pressable
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="shift-day-modal-card"
          onPress={() => {}}
          testID="shift-day-modal-card"
        >
          <Text className="mb-2 text-lg font-bold text-slate-900 dark:text-white" nativeID="shift-day-modal-title" testID="shift-day-modal-title">
            Desplazar desde {formatDisplayDate(fromDate)}
          </Text>
          <Text className="mb-4 text-xs text-slate-500 dark:text-slate-400" nativeID="shift-day-modal-hint" testID="shift-day-modal-hint">
            Corre este día y todos los que siguen la cantidad de días elegida.
          </Text>

          <View className="mb-4 flex-row items-center justify-center gap-3" nativeID="shift-day-modal-stepper" testID="shift-day-modal-stepper">
            <Pressable
              accessibilityLabel="Menos días"
              className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 disabled:opacity-40 dark:border-slate-700"
              disabled={days <= 1}
              nativeID="shift-day-modal-decrement-button"
              onPress={() => setDays((d) => Math.max(1, d - 1))}
              testID="shift-day-modal-decrement-button"
            >
              <MaterialCommunityIcons color="#94a3b8" name="minus" size={18} />
            </Pressable>
            <Text className="w-16 text-center text-2xl font-bold text-slate-900 dark:text-white" nativeID="shift-day-modal-days-value" testID="shift-day-modal-days-value">
              {days}
            </Text>
            <Pressable
              accessibilityLabel="Más días"
              className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700"
              nativeID="shift-day-modal-increment-button"
              onPress={() => setDays((d) => d + 1)}
              testID="shift-day-modal-increment-button"
            >
              <MaterialCommunityIcons color="#94a3b8" name="plus" size={18} />
            </Pressable>
          </View>

          <Text className="mb-4 text-center text-xs text-slate-500 dark:text-slate-400" nativeID="shift-day-modal-preview" testID="shift-day-modal-preview">
            {formatDisplayDate(fromDate)} pasa a ser {formatDisplayDate(addDaysISO(fromDate, days))}
          </Text>

          <View className="flex-row gap-3" nativeID="shift-day-modal-actions" testID="shift-day-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="shift-day-modal-cancel-button"
              onPress={onClose}
              testID="shift-day-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="shift-day-modal-cancel-button-label" testID="shift-day-modal-cancel-button-label">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${isShifting ? 'opacity-60' : ''}`}
              disabled={isShifting}
              nativeID="shift-day-modal-confirm-button"
              onPress={handleSubmit}
              testID="shift-day-modal-confirm-button"
            >
              {isShifting ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="shift-day-modal-confirm-button-label" testID="shift-day-modal-confirm-button-label">
                  Desplazar
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
