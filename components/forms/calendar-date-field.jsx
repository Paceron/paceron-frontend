import { useMemo, useState } from 'react';
import { Keyboard, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useThemeColors } from '../../theme/colors.js';
import { formatCalendarDate, formatDateInput, parseCalendarDate } from '../../utils/date-field-format.js';
import { isWeb } from '../../utils/platform.js';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_MS = 86_400_000;

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function calendarDays(month) {
  const first = monthStart(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

function normalizeBoundary(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : parseCalendarDate(value);
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function sameDay(a, b) {
  return Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
}

function dayOrdinal(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function CalendarDateField({
  idPrefix,
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  minimumDate,
  maximumDate,
  disableFutureLimit = true,
  hideLabel = false,
  hideErrorRow = false,
  touched = false,
  labelClassName = 'mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200',
  dense = false,
  compactControl = false,
  className,
}) {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => monthStart(parseCalendarDate(value) ?? new Date()));
  const selectedDate = parseCalendarDate(value);
  const min = useMemo(() => normalizeBoundary(minimumDate), [minimumDate]);
  const explicitMax = useMemo(() => normalizeBoundary(maximumDate), [maximumDate]);
  const max = useMemo(() => {
    const today = disableFutureLimit ? normalizeBoundary(new Date()) : null;
    if (today && explicitMax) return dayOrdinal(today) < dayOrdinal(explicitMax) ? today : explicitMax;
    return today ?? explicitMax;
  }, [disableFutureLimit, explicitMax]);
  const days = useMemo(() => calendarDays(displayMonth), [displayMonth]);
  const monthName = displayMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const classNameValue = className ?? (dense ? 'mb-3' : 'mb-5');
  const modalMotion = reducedMotion ? 'none' : 'fade';
  const controlBorderClass = disabled
    ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
    : error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
  const controlHeightClass = compactControl ? 'h-8' : 'h-11';
  const calendarButtonClass = compactControl ? 'h-8 w-8' : 'h-11 w-11';
  const calendarIconSize = compactControl ? 16 : 19;
  const navigationButtonClass = isWeb ? 'h-9 w-9' : 'h-11 w-11';
  const dayButtonClass = isWeb ? 'h-9 w-9' : 'h-11 w-11';

  const close = () => {
    Keyboard.dismiss();
    setVisible(false);
  };

  const open = () => {
    setDisplayMonth(monthStart(selectedDate ?? new Date()));
    setVisible(true);
  };

  const selectDate = (date) => {
    onChange(formatCalendarDate(date));
    close();
    onBlur?.();
  };

  const dayDisabled = (date) => (
    (min && dayOrdinal(date) < dayOrdinal(min)) || (max && dayOrdinal(date) > dayOrdinal(max))
  );
  const nextMonth = shiftMonth(displayMonth, 1);
  const nextMonthDisabled = Boolean(max && dayOrdinal(monthStart(nextMonth)) > dayOrdinal(monthStart(max)));

  return (
    <>
      <View className={classNameValue} nativeID={idPrefix} testID={idPrefix}>
        {!hideLabel ? (
          <Text className={labelClassName} nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
            {label}
          </Text>
        ) : null}
        <View
          className={`${controlHeightClass} flex-row items-center gap-1 rounded-xl border px-3 ${controlBorderClass}`}
          nativeID={`${idPrefix}-control`}
          testID={`${idPrefix}-control`}
        >
          <TextInput
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            autoCorrect={false}
            className="h-full min-w-0 flex-1 p-0 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-white"
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={10}
            nativeID={`${idPrefix}-input`}
            onBlur={onBlur}
            onChangeText={(text) => onChange(formatDateInput(text))}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={colors.onSurfaceVariant}
            testID={`${idPrefix}-input`}
            value={value ?? ''}
          />
          <Pressable
            accessibilityLabel={`Abrir calendario para ${label}`}
            accessibilityRole="button"
            accessibilityState={{ disabled, expanded: visible }}
            aria-expanded={visible}
            className={`${calendarButtonClass} items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary active:opacity-70 dark:hover:bg-slate-800`}
            focusable
            disabled={disabled}
            nativeID={`${idPrefix}-calendar-button`}
            onPress={open}
            testID={`${idPrefix}-calendar-button`}
          >
            <MaterialCommunityIcons color={disabled ? colors.onSurfaceVariant : colors.primary} name="calendar-month-outline" size={calendarIconSize} />
          </Pressable>
        </View>
        {!hideErrorRow ? (
          <View className="h-5" nativeID={`${idPrefix}-error-row`} testID={`${idPrefix}-error-row`}>
            {error ? <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`${idPrefix}-error`} testID={`${idPrefix}-error`}>{error}</Text> : null}
          </View>
        ) : null}
      </View>

      <Modal
        animationType={modalMotion}
        aria-labelledby={`${idPrefix}-calendar-title`}
        nativeID={`${idPrefix}-calendar-modal`}
        onRequestClose={close}
        testID={`${idPrefix}-calendar-modal`}
        transparent
        visible={visible}
      >
        <View
          className={`flex-1 bg-black/50 px-4 ${isWeb ? 'items-center justify-center' : 'justify-end'}`}
          nativeID={`${idPrefix}-calendar-modal-root`}
          testID={`${idPrefix}-calendar-modal-root`}
        >
          <Pressable
            accessibilityLabel="Cerrar calendario"
            className="absolute inset-0"
            nativeID={`${idPrefix}-calendar-modal-backdrop`}
            onPress={close}
            testID={`${idPrefix}-calendar-modal-backdrop`}
          />
          <View
            className={`w-full border border-slate-200 shadow-xl dark:border-slate-700 ${isWeb ? 'max-w-xs rounded-xl bg-white p-3 dark:bg-surface' : 'rounded-t-2xl bg-white p-4 dark:bg-surface'}`}
            nativeID={`${idPrefix}-calendar-card`}
            testID={`${idPrefix}-calendar-card`}
          >
            <View className={`${isWeb ? 'mb-2' : 'mb-4'} flex-row items-center gap-2`} nativeID={`${idPrefix}-calendar-header`} testID={`${idPrefix}-calendar-header`}>
              <Pressable
                accessibilityLabel="Mes anterior"
                accessibilityRole="button"
                className={`${navigationButtonClass} items-center justify-center rounded-full hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary active:opacity-70 dark:hover:bg-slate-800`}
                focusable
                nativeID={`${idPrefix}-calendar-previous-month`}
                onPress={() => setDisplayMonth((current) => shiftMonth(current, -1))}
                testID={`${idPrefix}-calendar-previous-month`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-left" size={22} />
              </Pressable>
              <Text className={`flex-1 text-center ${isWeb ? 'text-sm' : 'text-base'} font-bold capitalize text-slate-900 dark:text-white`} nativeID={`${idPrefix}-calendar-title`} testID={`${idPrefix}-calendar-title`}>
                {monthName}
              </Text>
              <Pressable
                accessibilityLabel="Mes siguiente"
                accessibilityRole="button"
                accessibilityState={{ disabled: nextMonthDisabled }}
                className={`${navigationButtonClass} items-center justify-center rounded-full hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary active:opacity-70 dark:hover:bg-slate-800`}
                disabled={nextMonthDisabled}
                focusable
                nativeID={`${idPrefix}-calendar-next-month`}
                onPress={() => setDisplayMonth((current) => shiftMonth(current, 1))}
                testID={`${idPrefix}-calendar-next-month`}
              >
                <MaterialCommunityIcons color={nextMonthDisabled ? colors.outlineVariant : colors.onSurfaceVariant} name="chevron-right" size={22} />
              </Pressable>
            </View>
            <View className="mb-1 flex-row" nativeID={`${idPrefix}-calendar-weekdays`} testID={`${idPrefix}-calendar-weekdays`}>
              {WEEKDAYS.map((weekday, index) => (
                <View className={`${isWeb ? 'h-7' : 'h-8'} flex-1 items-center justify-center`} key={weekday} nativeID={`${idPrefix}-weekday-${index}`} testID={`${idPrefix}-weekday-${index}`}>
                  <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-weekday-${index}-label`} testID={`${idPrefix}-weekday-${index}-label`}>{weekday}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap" nativeID={`${idPrefix}-calendar-grid`} testID={`${idPrefix}-calendar-grid`}>
              {days.map((date, index) => {
                const outsideMonth = date.getMonth() !== displayMonth.getMonth();
                const selected = sameDay(date, selectedDate);
                const today = sameDay(date, new Date());
                const isDisabled = dayDisabled(date);
                return (
                  <View className="w-[14.2857%] items-center py-0.5" key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`} nativeID={`${idPrefix}-calendar-cell-${index}`} testID={`${idPrefix}-calendar-cell-${index}`}>
                    <Pressable
                      accessibilityLabel={date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: Boolean(isDisabled), selected }}
                      aria-pressed={selected}
                      className={`${dayButtonClass} items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-primary ${selected ? 'bg-primary' : today ? 'border border-primary' : ''} ${isDisabled ? 'opacity-30' : 'hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800'}`}
                      disabled={Boolean(isDisabled)}
                      focusable
                      key={`day-${index}`}
                      nativeID={`${idPrefix}-calendar-day-${index}`}
                      onPress={() => selectDate(date)}
                      testID={`${idPrefix}-calendar-day-${index}`}
                    >
                      <Text className={`${selected ? 'font-bold text-[#111518]' : outsideMonth ? 'text-slate-400 dark:text-slate-600' : 'text-slate-800 dark:text-slate-100'} text-sm`} nativeID={`${idPrefix}-calendar-day-${index}-label`} testID={`${idPrefix}-calendar-day-${index}-label`}>
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <View className={`${isWeb ? 'mt-2' : 'mt-3'} flex-row justify-end`} nativeID={`${idPrefix}-calendar-footer`} testID={`${idPrefix}-calendar-footer`}>
              <Pressable
                accessibilityRole="button"
                className={`${isWeb ? 'h-9 px-4' : 'h-11 px-5'} flex-row items-center justify-center rounded-full hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary active:opacity-70 dark:hover:bg-slate-800`}
                focusable
                nativeID={`${idPrefix}-calendar-close`}
                onPress={close}
                testID={`${idPrefix}-calendar-close`}
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-calendar-close-label`} testID={`${idPrefix}-calendar-close-label`}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
