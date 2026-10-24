import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { isWeb } from '../../utils/platform.js';
import { formatDurationInput } from '../../utils/time.js';
import { formatDateInput } from '../../utils/date-field-format.js';
import { BREAKPOINTS } from '../../theme/tokens.js';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// Primitivos de formulario compartidos por register y edit de perfil.

export const INPUT_CLASS = 'flex-1 px-4 text-sm text-slate-900 dark:text-white outline-none';
// `mb-1.5` vive acá y no en el wrapper de cada label porque 24 call sites lo
// usan directamente. Dentro de InputField el margen se corre al subtext
// (ver abajo) para que la fila de label ocupe siempre el mismo alto.
export const FIELD_LABEL = 'mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200';
// min-h-12, no h-12: en web, Chrome ignora `height` en <select>/<input
// type="date"> (controles de formulario "reemplazados" con su propio
// alto intrínseco) — con h-12 renderizaban a ~38-40px reales pese a la
// clase, aunque medía 48px en cualquier View normal. min-height sí lo
// respeta. Detectado 2026-09-05 al notar el botón "+" de
// SelectWithCreateField más alto que el select de al lado.
export const SELECT_CLASS = 'min-h-12 flex-1 px-4 py-2 text-sm text-slate-900 dark:text-white rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 outline-none appearance-none';
// Variante sin caja para selects incrustados en contextos que ya tienen
// su propio fondo/borde (ej. el header de mes/año del calendario) — solo
// texto + la flechita propia que se agrega al lado, sin duplicar chrome.
// `bg-white dark:bg-surface` (NO `bg-transparent`, a pesar del nombre) --
// bug real 2026-10-15: con fondo transparente, el navegador igual pinta
// el popup de opciones con SU propio fondo por defecto (blanco, sin
// seguir nuestro tema) pero sí hereda el `color` que declaramos acá
// (`dark:text-white`) -- en tema oscuro, texto blanco sobre ese fondo
// blanco del navegador, opciones ilegibles salvo al pasar el mouse (el
// hover trae su propio contraste). La variante no-plain (`SELECT_CLASS`
// arriba) nunca tuvo este bug porque SÍ declara un fondo sólido
// (`bg-white dark:bg-slate-900`) -- el navegador propaga fondo Y color
// juntos al popup cuando el `<select>` tiene un `background-color` real.
// `bg-white dark:bg-surface` (en vez de `dark:bg-slate-900`) para que
// combine con el fondo de la card que lo contiene en vez de un gris
// genérico.
const SELECT_CLASS_PLAIN = 'bg-white dark:bg-surface border-0 pl-0 pr-4 py-1 text-sm font-semibold text-slate-900 dark:text-white outline-none appearance-none cursor-pointer';
const DATE_BASE = 'min-h-12 flex-1 px-4 py-2 text-sm text-slate-900 dark:text-white rounded-xl border outline-none appearance-none';
// Variante compacta de DATE_BASE -- `dense` de DateField (no de TimeField,
// que sigue usando DATE_BASE sin tocar). Pensada para selects incrustados
// en una fila angosta (ej. rango personalizado del leaderboard): el
// min-h-12 normal hacía crecer esa fila al aparecer, salto real pedido
// 2026-10-15.
const DATE_BASE_DENSE = 'min-h-8 flex-1 px-3 py-1 text-sm text-slate-900 dark:text-white rounded-xl border outline-none appearance-none';

// Slugifica un label para usarlo como parte de un id estable y legible.
function slugify(label) {
  return String(label ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Fila responsive: con suficiente ancho reparte los hijos en columnas, si
// no apila. Decide por ANCHO real (useWindowDimensions + BREAKPOINTS.lg,
// mismo breakpoint que useIsNarrowWeb() en el shell responsive), no por
// plataforma — así una ventana de escritorio angosta también apila, no
// solo la app nativa. `narrowClassName` (default sin gap, el comportamiento
// de siempre) deja opinar el espaciado entre hijos apilados a quien use
// Row — por default los hijos manejan su propio margen (ej. el mb-3/mb-5
// de los fields), pero un caller que ya anula ese margen (className="mb-0"
// en cada field) puede pedir un gap explícito acá en su lugar.
export function Row({ children, narrowClassName = '' }) {
  const { width } = useWindowDimensions();
  const wide = width >= BREAKPOINTS.lg;
  return (
    <View className={wide ? 'flex-row gap-4' : narrowClassName} nativeID="row-wrapper" testID="row-wrapper">
      {children}
    </View>
  );
}

// Columna con peso de ancho (solo si hay suficiente ancho); si no, ocupa
// el ancho completo. Mismo criterio de ancho que Row.
export function Col({ children, flex = 1 }) {
  const { width } = useWindowDimensions();
  const wide = width >= BREAKPOINTS.lg;
  return (
    <View nativeID="col-wrapper" style={wide ? { flex } : undefined} testID="col-wrapper">
      {children}
    </View>
  );
}

export function SelectField({ label, options, value, onChange, placeholder, disabled, error, dense, className, hideErrorRow, required, hideLabel, plain }) {
  const colors = useThemeColors();
  const slug = slugify(label);

  // Normaliza opciones: acepta strings (ej. localidades) u objetos { id, name }.
  const items = options.map((opt) => (typeof opt === 'string' ? { id: opt, name: opt } : opt));

  return (
    <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={`select-field-${slug}`} testID={`select-field-${slug}`}>
      {!hideLabel && (
        <Text className={FIELD_LABEL} nativeID={`select-field-${slug}-label`} testID={`select-field-${slug}-label`}>
          {label}
          {required && (
            <>
              {' '}
              <Text
                accessibilityRole="text"
                className="text-red-500 dark:text-red-400"
                nativeID={`select-field-${slug}-required`}
                testID={`select-field-${slug}-required`}
              >
                *
              </Text>
            </>
          )}
        </Text>
      )}
      <View
        className="flex-row items-center gap-2"
        nativeID={`select-field-${slug}-row`}
        testID={`select-field-${slug}-row`}
      >
        <View className={plain ? 'relative' : 'flex-1 relative'} nativeID={`select-field-${slug}-input-wrapper`} testID={`select-field-${slug}-input-wrapper`}>
          <select
            className={plain ? SELECT_CLASS_PLAIN : SELECT_CLASS}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            {(!required || !value) && <option value="">{placeholder}</option>}
            {items.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          {plain && (
            <View className="absolute right-0 top-1/2 -translate-y-1/2" nativeID={`select-field-${slug}-chevron`} pointerEvents="none" testID={`select-field-${slug}-chevron`}>
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={16} />
            </View>
          )}
          {!plain && !disabled && !required && Boolean(value) && (
            <Pressable
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full hover:opacity-70"
              onPress={() => onChange('')}
              accessibilityLabel="Limpiar selección"
              nativeID={`select-field-${slug}-clear-button`}
              testID={`select-field-${slug}-clear-button`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle" size={20} />
            </Pressable>
          )}
        </View>
      </View>
      {!hideErrorRow && (
        <View className="h-5" nativeID={`select-field-${slug}-error-row`} testID={`select-field-${slug}-error-row`}>
          {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`select-field-${slug}-error`} testID={`select-field-${slug}-error`}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

// DD/MM/YYYY (formato interno que ya consumen validators/normalizers) <-> Date.
function parseDDMMYYYY(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!m) return new Date();
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function formatDDMMYYYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function DateField({ label, value, onChange, onBlur, error, touched, disabled, minimumDate, disableFutureLimit = false, hideLabel = false, hideErrorRow = false, className, dense = false, labelClassName = FIELD_LABEL }) {
  const colors = useThemeColors();
  const { themeMode } = useThemeMode();
  const [pickerVisible, setPickerVisible] = useState(false);
  const slug = slugify(label);

  const borderClass = error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  if (isWeb) {
    // Input de texto enmascarado en vez de <input type="date"> nativo: ese
    // control exige el VALOR en ISO por spec de HTML, pero el formato VISUAL
    // (y el orden día/mes al tipear) lo decide el navegador/SO según su
    // configuración regional — no hay forma de forzarlo por CSS/HTML. Con un
    // navegador en inglés (en-US) eso se ve mm/dd/aaaa sin que podamos
    // evitarlo. Acá el formato es 100% nuestro (ver utils/date-field-format.js),
    // igual que ya pasaba en mobile nativo — que nunca delegó el render del
    // valor al picker del sistema. `value` queda en 'DD/MM/YYYY' en cualquier
    // plataforma (antes era 'YYYY-MM-DD' solo en web).
    const handleWebChange = (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
      onChange(formatDateInput(digits));
    };

    return (
      <View className={className ?? 'mb-5'} nativeID={`date-field-${slug}`} testID={`date-field-${slug}`}>
        {!hideLabel && <Text className={labelClassName} nativeID={`date-field-${slug}-label`} testID={`date-field-${slug}-label`}>{label}</Text>}
        <View
          className="flex-row items-center gap-2"
          nativeID={`date-field-${slug}-row`}
          testID={`date-field-${slug}-row`}
        >
          <View className="flex-1 relative" nativeID={`date-field-${slug}-input-wrapper`} testID={`date-field-${slug}-input-wrapper`}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              className={`${dense ? DATE_BASE_DENSE : DATE_BASE} ${borderClass}`}
              value={value}
              onChange={handleWebChange}
              onBlur={onBlur}
              disabled={disabled}
            />
          </View>
        </View>
        {!hideErrorRow && (
          <View className="h-5" nativeID={`date-field-${slug}-error-row`} testID={`date-field-${slug}-error-row`}>
            {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`date-field-${slug}-error`} testID={`date-field-${slug}-error`}>{error}</Text>}
          </View>
        )}
      </View>
    );
  }

  // Android: diálogo nativo del sistema, se abre/cierra de forma imperativa.
  // iOS: calendario inline dentro de un modal propio, con botón "Listo".
  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setPickerVisible(false);
      onBlur?.();
    }
    if (selectedDate) onChange(formatDDMMYYYY(selectedDate));
  };

  const handleClose = () => {
    setPickerVisible(false);
    onBlur?.();
  };

  return (
    <View className={className ?? 'mb-5'} nativeID={`date-field-${slug}`} testID={`date-field-${slug}`}>
      {!hideLabel && <Text className={labelClassName} nativeID={`date-field-${slug}-label`} testID={`date-field-${slug}-label`}>{label}</Text>}
      <Pressable
        className={`${dense ? 'h-8 px-3' : 'h-12 px-4'} flex-row items-center rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 ${borderClass}`}
        disabled={disabled}
        onPress={() => setPickerVisible(true)}
        nativeID={`date-field-${slug}-trigger`}
        testID={`date-field-${slug}-trigger`}
      >
        <Text
          className={`flex-1 text-sm ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
          nativeID={`date-field-${slug}-value`}
          testID={`date-field-${slug}-value`}
        >
          {value || 'DD/MM/AAAA'}
        </Text>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar" size={20} />
      </Pressable>
      {!hideErrorRow && (
        <View className="h-5" nativeID={`date-field-${slug}-error-row`} testID={`date-field-${slug}-error-row`}>
          {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`date-field-${slug}-error`} testID={`date-field-${slug}-error`}>{error}</Text>}
        </View>
      )}

      {pickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          accentColor="#8cc63e"
          display="default"
          maximumDate={disableFutureLimit ? undefined : new Date()}
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={parseDDMMYYYY(value)}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          animationType="fade"
          onRequestClose={handleClose}
          transparent
          visible={pickerVisible}
          nativeID={`date-field-${slug}-modal`}
          testID={`date-field-${slug}-modal`}
        >
          <Pressable
            className="flex-1 justify-end bg-black/50"
            onPress={handleClose}
            nativeID={`date-field-${slug}-modal-backdrop`}
            testID={`date-field-${slug}-modal-backdrop`}
          >
            <Pressable
              className="rounded-t-2xl bg-white p-4 dark:bg-surface-2"
              onPress={() => {}}
              nativeID={`date-field-${slug}-modal-content`}
              testID={`date-field-${slug}-modal-content`}
            >
              <DateTimePicker
                display="inline"
                maximumDate={disableFutureLimit ? undefined : new Date()}
                minimumDate={minimumDate}
                mode="date"
                onChange={handleChange}
                themeVariant={themeMode}
                value={parseDDMMYYYY(value)}
              />
              <Pressable
                className="mt-2 h-11 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
                onPress={handleClose}
                nativeID={`date-field-${slug}-modal-done-button`}
                testID={`date-field-${slug}-modal-done-button`}
              >
                <Text
                  className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
                  nativeID={`date-field-${slug}-modal-done-label`}
                  testID={`date-field-${slug}-modal-done-label`}
                >
                  Listo
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// HH:mm <-> Date. Hermano de DateField (no una variante con prop de modo)
// — formato y validación de tiempo son distintos de fecha, y DateField ya
// está hardcodeado a mode="date"/DD-MM-AAAA.
function parseHHmm(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(value || '');
  const date = new Date();
  if (!m) {
    date.setHours(0, 0, 0, 0);
    return date;
  }
  date.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return date;
}

function formatHHmm(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function TimeField({ label, value, onChange, onBlur, error, touched, disabled, hideErrorRow, className }) {
  const colors = useThemeColors();
  const { themeMode } = useThemeMode();
  const [pickerVisible, setPickerVisible] = useState(false);
  const slug = slugify(label);

  const borderClass = error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  if (isWeb) {
    return (
      <View className={className ?? 'mb-5'} nativeID={`time-field-${slug}`} testID={`time-field-${slug}`}>
        <Text className={FIELD_LABEL} nativeID={`time-field-${slug}-label`} testID={`time-field-${slug}-label`}>{label}</Text>
        <View className="flex-row items-center gap-2" nativeID={`time-field-${slug}-row`} testID={`time-field-${slug}-row`}>
          <View className="flex-1 relative" nativeID={`time-field-${slug}-input-wrapper`} testID={`time-field-${slug}-input-wrapper`}>
            <input
              type="time"
              className={`${DATE_BASE} ${borderClass}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              disabled={disabled}
            />
          </View>
        </View>
        {!hideErrorRow && (
          <View className="h-5" nativeID={`time-field-${slug}-error-row`} testID={`time-field-${slug}-error-row`}>
            {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`time-field-${slug}-error`} testID={`time-field-${slug}-error`}>{error}</Text>}
          </View>
        )}
      </View>
    );
  }

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setPickerVisible(false);
      onBlur?.();
    }
    if (selectedDate) onChange(formatHHmm(selectedDate));
  };

  const handleClose = () => {
    setPickerVisible(false);
    onBlur?.();
  };

  return (
    <View className={className ?? 'mb-5'} nativeID={`time-field-${slug}`} testID={`time-field-${slug}`}>
      <Text className={FIELD_LABEL} nativeID={`time-field-${slug}-label`} testID={`time-field-${slug}-label`}>{label}</Text>
      <Pressable
        className={`h-12 flex-row items-center rounded-xl border px-4 hover:bg-slate-100 dark:hover:bg-slate-800 ${borderClass}`}
        disabled={disabled}
        onPress={() => setPickerVisible(true)}
        nativeID={`time-field-${slug}-trigger`}
        testID={`time-field-${slug}-trigger`}
      >
        <Text
          className={`flex-1 text-sm ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
          nativeID={`time-field-${slug}-value`}
          testID={`time-field-${slug}-value`}
        >
          {value || 'HH:mm'}
        </Text>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={20} />
      </Pressable>
      {!hideErrorRow && (
        <View className="h-5" nativeID={`time-field-${slug}-error-row`} testID={`time-field-${slug}-error-row`}>
          {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`time-field-${slug}-error`} testID={`time-field-${slug}-error`}>{error}</Text>}
        </View>
      )}

      {pickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          accentColor="#8cc63e"
          display="default"
          mode="time"
          onChange={handleChange}
          value={parseHHmm(value)}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          animationType="fade"
          onRequestClose={handleClose}
          transparent
          visible={pickerVisible}
          nativeID={`time-field-${slug}-modal`}
          testID={`time-field-${slug}-modal`}
        >
          <Pressable
            className="flex-1 justify-end bg-black/50"
            onPress={handleClose}
            nativeID={`time-field-${slug}-modal-backdrop`}
            testID={`time-field-${slug}-modal-backdrop`}
          >
            <Pressable
              className="rounded-t-2xl bg-white p-4 dark:bg-surface-2"
              onPress={() => {}}
              nativeID={`time-field-${slug}-modal-content`}
              testID={`time-field-${slug}-modal-content`}
            >
              <DateTimePicker
                display="inline"
                mode="time"
                onChange={handleChange}
                themeVariant={themeMode}
                value={parseHHmm(value)}
              />
              <Pressable
                className="mt-2 h-11 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
                onPress={handleClose}
                nativeID={`time-field-${slug}-modal-done-button`}
                testID={`time-field-${slug}-modal-done-button`}
              >
                <Text
                  className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
                  nativeID={`time-field-${slug}-modal-done-label`}
                  testID={`time-field-${slug}-modal-done-label`}
                >
                  Listo
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// Duración (mm:ss o h:mm:ss) — el usuario tipea SOLO dígitos y los ':' se
// insertan solos: "330" → 3:30, "0330" → 03:30, "13045" → 1:30:45. A diferencia
// de TimeField (que es una hora de reloj y va 00:00–23:59), acá el rango es
// duración: los minutos pasan de 60 sin problema, que es el caso normal de una
// serie larga. El valor sigue siendo un string formateado; el guardado lo
// convierte a ms (el backend siempre recibe ms).
export function DurationField({ label, value, onChange, error, touched, disabled, dense, className, hideErrorRow, hideLabel, placeholder = 'mm:ss' }) {
  const colors = useThemeColors();
  const slug = slugify(label);

  const borderColor = disabled
    ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
    : error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched && !error
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900';

  // Solo dígitos, máximo 6 (HH:MM:SS). Cada tecla re-formatea el string completo
  // desde los dígitos underlying, así el cursor no salta: el usuario nunca
  // escribe un ':' (por eso los ':' "se escriben solos").
  const handleChange = (text) => {
    const digits = String(text ?? '').replace(/\D/g, '').slice(0, 6);
    onChange(formatDurationInput(digits));
  };

  return (
    <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={`duration-field-${slug}`} testID={`duration-field-${slug}`}>
      {!hideLabel && <Text className={FIELD_LABEL} nativeID={`duration-field-${slug}-label`} testID={`duration-field-${slug}-label`}>{label}</Text>}
      <View className={`min-h-12 flex-row items-center rounded-xl border px-4 ${borderColor}`} nativeID={`duration-field-${slug}-box`} testID={`duration-field-${slug}-box`}>
        <TextInput
          className={INPUT_CLASS}
          editable={!disabled}
          keyboardType="number-pad"
          nativeID={`duration-field-${slug}-input`}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant}
          testID={`duration-field-${slug}-input`}
          value={value ?? ''}
        />
      </View>
      {!hideErrorRow && (
        <View className="h-5" nativeID={`duration-field-${slug}-error-row`} testID={`duration-field-${slug}-error-row`}>
          {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`duration-field-${slug}-error`} testID={`duration-field-${slug}-error`}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

export function InputField({ label, value, onChange, onBlur, onSelectionChange, error, hint, touched, placeholder, secureTextEntry, keyboardType, autoComplete, textContentType, autoCapitalize, onSubmitEditing, returnKeyType, onToggleSecure, showSecure, disabled, multiline, numberOfLines, dense, className, hideErrorRow, autoFocus, hideLabel, required, labelSubtext, stepper, onStepper }) {
  const colors = useThemeColors();
  const slug = slugify(label);

  const borderColor = disabled
    ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
    : error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched && !error
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900';

  const rowSizeClass = multiline ? 'min-h-24 items-start py-3' : 'h-12 items-center';

  return (
    <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={`input-field-${slug}`} testID={`input-field-${slug}`}>
      {!hideLabel && (
        <View nativeID={`input-field-${slug}-label-row`} testID={`input-field-${slug}-label-row`}>
          <Text
            className={labelSubtext ? 'text-sm font-semibold text-slate-700 dark:text-slate-200' : FIELD_LABEL}
            nativeID={`input-field-${slug}-label`}
            testID={`input-field-${slug}-label`}
          >
            {label}
            {required && (
              // El asterisco va pegado al label, no en otro lado: el lector de
              // pantalla lee el Text entero, así que "Nombre *" se anuncia junto.
              <>
                {' '}
                <Text
                  accessibilityRole="text"
                  className="text-red-500 dark:text-red-400"
                  nativeID={`input-field-${slug}-required`}
                  testID={`input-field-${slug}-required`}
                >
                  *
                </Text>
              </>
            )}
          </Text>
          {/* Unidad y "(opcional)" van en una línea propia, SIEMPRE presente.
              No es estética: si el "(opcional)" fuera parte del label, un
              label más largo que otro partiría en dos líneas y desalinearía
              los inputs de al lado, que es justo lo que pasa en dos campos
              en el mismo renglón. Con la línea siempre reservada, los boxes
              quedan a la misma altura sin importar el contenido. */}
          {labelSubtext ? (
            <Text
              className="mb-1.5 mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400"
              nativeID={`input-field-${slug}-subtext`}
              numberOfLines={1}
              testID={`input-field-${slug}-subtext`}
            >
              {labelSubtext}
            </Text>
          ) : null}
        </View>
      )}
      <View
        className={`${rowSizeClass} flex-row rounded-xl border ${borderColor}`}
        nativeID={`input-field-${slug}-row`}
        testID={`input-field-${slug}-row`}
      >
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          // Con stepper: px-3 en vez de px-4, y `min-w-0`.
          //
          // El min-w-0 es lo que hace que los botones se vean. Un flex item
          // tiene `min-width: auto` por defecto, o sea NUNCA baja de su ancho
          // intrínseco — y el <input> de react-native-web trae un `size`
          // default de ~20 caracteres. Sin min-w-0, el input pedía ~170px,
          // empujaba el stepper fuera de la caja y los botones quedaban
          // ocultos detrás. Con min-w-0 el input se encoge a lo que sobra,
          // que es lo que necesita: estos campos son de 3 a 6 dígitos.
          className={stepper ? 'min-w-0 flex-1 px-3 text-sm text-slate-900 outline-none dark:text-white' : INPUT_CLASS}
          editable={!disabled}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onBlur={onBlur}
          onChangeText={onChange}
          onSelectionChange={onSelectionChange}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          textAlignVertical={multiline ? 'top' : 'center'}
          textContentType={textContentType}
          value={value}
          nativeID={`input-field-${slug}-input`}
          testID={`input-field-${slug}-input`}
        />
        {stepper && (
          // Stepper −/+ para campos numéricos. Va adentro de la caja, al lado
          // del input, por el mismo motivo que el toggle de contraseña: tipear
          // "3000" con teclado numérico es lento, y ajustar de a uno es el
          // gesto más común una vez que el orden de magnitud está cerca.
          // Se lee como UN control (fondo propio + divisoria entre los dos) en
          // vez de dos botones flotando sueltos. `stepper` es opt-in: los
          // demás campos del repo no cambian.
          <View
            accessibilityRole="adjustable"
            className="mr-1.5 flex-row items-center self-center overflow-hidden rounded-lg"
            nativeID={`input-field-${slug}-stepper`}
            testID={`input-field-${slug}-stepper`}
          >
            {/* Colores con significado: + es el mismo verde del botón de crear
                (bg-primary, #8cc63e, con el ícono en #111518 porque es un
                verde claro) y − es un gris un paso más oscuro que la caja de
                texto (slate-200 sobre slate-50, slate-700 sobre slate-900), que
                es lo que lo separa del input sin gritar. La divisoria separa
                los dos gestos opuestos. */}
            <Pressable
              accessibilityLabel={`Restar 1 a ${label}`}
              accessibilityRole="button"
              className="h-8 w-8 items-center justify-center rounded-l-lg bg-slate-200 active:bg-slate-300 dark:bg-slate-700 dark:active:bg-slate-600"
              disabled={disabled}
              hitSlop={6}
              onPress={() => onStepper?.(-1)}
              nativeID={`input-field-${slug}-stepper-minus`}
              testID={`input-field-${slug}-stepper-minus`}
            >
              <MaterialCommunityIcons color="#475569" name="minus" size={16} />
            </Pressable>
            <View
              className="h-4 w-px bg-slate-200 dark:bg-slate-700"
              nativeID={`input-field-${slug}-stepper-divider`}
              testID={`input-field-${slug}-stepper-divider`}
            />
            <Pressable
              accessibilityLabel={`Sumar 1 a ${label}`}
              accessibilityRole="button"
              className="h-8 w-8 items-center justify-center rounded-r-lg bg-primary active:opacity-80"
              disabled={disabled}
              hitSlop={6}
              onPress={() => onStepper?.(1)}
              nativeID={`input-field-${slug}-stepper-plus`}
              testID={`input-field-${slug}-stepper-plus`}
            >
              <MaterialCommunityIcons color="#111518" name="plus" size={16} />
            </Pressable>
          </View>
        )}
        {onToggleSecure && (
          <Pressable
            className="rounded-lg px-3 hover:bg-slate-100 dark:hover:bg-slate-800"
            onPress={onToggleSecure}
            nativeID={`input-field-${slug}-toggle-secure-button`}
            testID={`input-field-${slug}-toggle-secure-button`}
          >
            <MaterialCommunityIcons
              color={colors.onSurfaceVariant}
              name={showSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
            />
          </Pressable>
        )}
      </View>
      {!hideErrorRow && (
        <View className="h-5 pt-1" nativeID={`input-field-${slug}-error-row`} testID={`input-field-${slug}-error-row`}>
          {error ? (
            <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`input-field-${slug}-error`} testID={`input-field-${slug}-error`}>{error}</Text>
          ) : hint ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`input-field-${slug}-hint`} testID={`input-field-${slug}-hint`}>{hint}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function PickerField({ label, options, value, onChange, placeholder, disabled, error, dense, className, hideErrorRow, required, hideLabel, plain }) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const slug = slugify(label);

  const items = options.map((opt) => {
    if (typeof opt === 'string') return { id: opt, name: opt };
    return opt;
  });

  const selected = items.find((item) => item.id === value);
  const borderClass = error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : disabled
    ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900';
  const triggerClass = plain
    ? 'h-8 flex-row items-center gap-1'
    : `h-12 flex-row items-center rounded-xl border px-4 hover:bg-slate-100 dark:hover:bg-slate-800 ${borderClass}`;

  return (
    <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={`picker-field-${slug}`} testID={`picker-field-${slug}`}>
      {!hideLabel && (
        <Text className={FIELD_LABEL} nativeID={`picker-field-${slug}-label`} testID={`picker-field-${slug}-label`}>
          {label}
          {required && (
            <>
              {' '}
              <Text
                accessibilityRole="text"
                className="text-red-500 dark:text-red-400"
                nativeID={`picker-field-${slug}-required`}
                testID={`picker-field-${slug}-required`}
              >
                *
              </Text>
            </>
          )}
        </Text>
      )}
      <Pressable
        className={triggerClass}
        onPress={disabled ? undefined : () => setVisible(true)}
        nativeID={`picker-field-${slug}-trigger`}
        testID={`picker-field-${slug}-trigger`}
      >
        <Text
          className={plain
            ? 'text-sm font-semibold text-slate-900 dark:text-white'
            : `flex-1 text-sm ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
          nativeID={`picker-field-${slug}-value`}
          testID={`picker-field-${slug}-value`}
        >
          {selected ? selected.name : placeholder}
        </Text>
        {!plain && !disabled && !required && Boolean(value) && (
          <Pressable
            className="rounded-full hover:opacity-70"
            onPress={() => { onChange(''); setVisible(false); }}
            accessibilityLabel="Limpiar selección"
            nativeID={`picker-field-${slug}-clear-button`}
            testID={`picker-field-${slug}-clear-button`}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle" size={20} />
          </Pressable>
        )}
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={plain ? 16 : 20} />
      </Pressable>
      {!hideErrorRow && (
        <View className="h-5" nativeID={`picker-field-${slug}-error-row`} testID={`picker-field-${slug}-error-row`}>
          {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`picker-field-${slug}-error`} testID={`picker-field-${slug}-error`}>{error}</Text>}
        </View>
      )}

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
        nativeID={`picker-field-${slug}-modal`}
        testID={`picker-field-${slug}-modal`}
      >
        <Pressable
          className="flex-1 justify-center bg-black/50 px-6"
          onPress={() => setVisible(false)}
          nativeID={`picker-field-${slug}-modal-backdrop`}
          testID={`picker-field-${slug}-modal-backdrop`}
        >
          <Pressable
            className="max-h-80 rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-surface-2"
            onPress={() => {}}
            nativeID={`picker-field-${slug}-modal-content`}
            testID={`picker-field-${slug}-modal-content`}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              nativeID={`picker-field-${slug}-modal-list`}
              testID={`picker-field-${slug}-modal-list`}
            >
              {items.length === 0 ? (
                <View className="items-center py-8" nativeID={`picker-field-${slug}-modal-empty`} testID={`picker-field-${slug}-modal-empty`}>
                  <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`picker-field-${slug}-modal-empty-label`} testID={`picker-field-${slug}-modal-empty-label`}>Sin opciones disponibles</Text>
                </View>
              ) : (
                items.map((item) => {
                  const isSelected = item.id === value;
                  const itemSlug = slugify(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      className={`flex-row items-center gap-3 border-b border-slate-100 px-5 py-3.5 active:opacity-70 dark:border-slate-800 ${
                        isSelected ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      onPress={() => { onChange(item.id); setVisible(false); }}
                      nativeID={`picker-field-${slug}-modal-option-${itemSlug}`}
                      testID={`picker-field-${slug}-modal-option-${itemSlug}`}
                    >
                      <Text
                        className={`flex-1 text-sm ${
                          isSelected ? 'font-semibold text-on-primary-tint dark:text-primary' : 'text-slate-700 dark:text-slate-200'
                        }`}
                        nativeID={`picker-field-${slug}-modal-option-${itemSlug}-label`}
                        testID={`picker-field-${slug}-modal-option-${itemSlug}-label`}
                      >
                        {item.name}
                      </Text>
                      {isSelected && <MaterialCommunityIcons color="inherit" name="check" size={18} style={{ color: '#8cc63e' }} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// Trigger + modal de selección compacto, sin label ni fila de error propios
// — pensado para convivir con otros campos en una misma fila (ej. el grupo
// de una invitación, o el plan de un grupo). scope identifica la instancia
// para nativeID/testID (no se muestra), ya que a diferencia de PickerField
// no hay un label del que derivarlo.
export function InlinePicker({ scope, value, onChange, options, placeholder = 'Elegir', widthClass = 'max-w-[128px]', showPlaceholderOption = true, textClassName = 'text-xs' }) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  const items = options.map((opt) => (typeof opt === 'string' ? { id: opt, name: opt } : opt));
  const selected = items.find((item) => item.id === value);

  if (isWeb) {
    // appearance-none saca la flechita nativa del navegador (queda pegada
    // al borde, padding-right no la mueve) — se dibuja una propia
    // (mismo ícono que la rama nativa de acá abajo) con la posición que
    // se necesite, en vez de depender del rendering default del browser.
    return (
      <View className="relative" nativeID={`inline-picker-${scope}-wrapper`} testID={`inline-picker-${scope}-wrapper`}>
        <select
          className={`h-12 ${widthClass} appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 ${textClassName} text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white`}
          onChange={(e) => onChange(e.target.value)}
          value={value}
        >
          {showPlaceholderOption && <option value="">{placeholder}</option>}
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <View className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" nativeID={`inline-picker-${scope}-chevron`} testID={`inline-picker-${scope}-chevron`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={16} />
        </View>
      </View>
    );
  }

  return (
    <>
      <Pressable
        className={`h-12 ${widthClass} flex-row items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800`}
        nativeID={`inline-picker-${scope}-trigger`}
        onPress={() => setVisible(true)}
        testID={`inline-picker-${scope}-trigger`}
      >
        <Text
          className={`flex-1 ${textClassName} ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
          nativeID={`inline-picker-${scope}-trigger-label`}
          numberOfLines={1}
          testID={`inline-picker-${scope}-trigger-label`}
        >
          {selected ? selected.name : placeholder}
        </Text>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={16} />
      </Pressable>

      <Modal
        animationType="fade"
        nativeID={`inline-picker-${scope}-modal`}
        onRequestClose={() => setVisible(false)}
        testID={`inline-picker-${scope}-modal`}
        transparent
        visible={visible}
      >
        <Pressable
          className="flex-1 justify-center bg-black/50 px-6"
          nativeID={`inline-picker-${scope}-modal-backdrop`}
          onPress={() => setVisible(false)}
          testID={`inline-picker-${scope}-modal-backdrop`}
        >
          <Pressable
            className="max-h-80 rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-surface-2"
            nativeID={`inline-picker-${scope}-modal-content`}
            onPress={() => {}}
            testID={`inline-picker-${scope}-modal-content`}
          >
            <ScrollView
              nativeID={`inline-picker-${scope}-modal-list`}
              showsVerticalScrollIndicator={false}
              testID={`inline-picker-${scope}-modal-list`}
            >
              {items.length === 0 ? (
                <View className="items-center py-8" nativeID={`inline-picker-${scope}-modal-empty`} testID={`inline-picker-${scope}-modal-empty`}>
                  <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`inline-picker-${scope}-modal-empty-label`} testID={`inline-picker-${scope}-modal-empty-label`}>Sin opciones disponibles</Text>
                </View>
              ) : (
                items.map((item) => {
                  const isSelected = item.id === value;
                  const itemSlug = slugify(item.id || 'ninguno');
                  return (
                    <Pressable
                      key={item.id || 'none'}
                      className={`flex-row items-center gap-3 border-b border-slate-100 px-5 py-3.5 active:opacity-70 dark:border-slate-800 ${
                        isSelected ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      nativeID={`inline-picker-${scope}-modal-option-${itemSlug}`}
                      onPress={() => { onChange(item.id); setVisible(false); }}
                      testID={`inline-picker-${scope}-modal-option-${itemSlug}`}
                    >
                      <Text
                        className={`flex-1 text-sm ${
                          isSelected ? 'font-semibold text-on-primary-tint dark:text-primary' : 'text-slate-700 dark:text-slate-200'
                        }`}
                        nativeID={`inline-picker-${scope}-modal-option-${itemSlug}-label`}
                        testID={`inline-picker-${scope}-modal-option-${itemSlug}-label`}
                      >
                        {item.name}
                      </Text>
                      {isSelected && <MaterialCommunityIcons color={colors.primary} name="check" size={18} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// Contenido del panel de sugerencias de EmailInviteForm — la pantalla
// dueña lo renderiza dentro de un AnimatedDropdown propio (ver
// hooks/use-email-suggestions.js), no EmailInviteForm mismo.
export function UserSuggestionsList({ suggestions, onSelect, scope }) {
  const colors = useThemeColors();

  return (
    <View
      className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-surface-2"
      nativeID={`${scope}-suggestions`}
      testID={`${scope}-suggestions`}
    >
      {suggestions.map((suggestion) => {
        const itemSlug = `${scope}-suggestion-${suggestion.user_id}`;
        const fullName = `${suggestion.name ?? ''} ${suggestion.surname ?? ''}`.trim();
        return (
          <Pressable
            className="flex-row items-center gap-2 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            key={suggestion.user_id}
            nativeID={itemSlug}
            onPress={() => onSelect(suggestion)}
            testID={itemSlug}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-circle-outline" size={18} />
            <View className="flex-1" nativeID={`${itemSlug}-info`} testID={`${itemSlug}-info`}>
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID={`${itemSlug}-name`} numberOfLines={1} testID={`${itemSlug}-name`}>
                {fullName || suggestion.email}
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${itemSlug}-email`} numberOfLines={1} testID={`${itemSlug}-email`}>
                {suggestion.email}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Lista de invitados ya agregados (borrador, todavía sin mandar) — chips
// con nombre de grupo (si `groups` viene con datos) y botón de quitar.
// Vive en su propia sección visual, separada de EmailInviteForm.
export function InvitedEmailsList({ value = [], onChange, groups = [] }) {
  const colors = useThemeColors();

  const handleRemove = (email) => {
    onChange(value.filter((e) => e.email !== email));
  };

  if (value.length === 0) {
    return (
      <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="invited-emails-list-empty" testID="invited-emails-list-empty">
        Todavía no agregaste a nadie.
      </Text>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-2" nativeID="invited-emails-list-chips" testID="invited-emails-list-chips">
      {value.map((invite) => {
        const chipSlug = slugify(invite.email);
        const groupName = groups.find((g) => g.id === invite.groupId)?.name ?? 'Grupo principal';
        return (
          <View
            key={invite.email}
            className="flex-row items-center gap-1.5 rounded-full bg-primary-tint-subtle px-3 py-1.5 dark:bg-primary/10"
            nativeID={`invited-emails-list-chip-${chipSlug}`}
            testID={`invited-emails-list-chip-${chipSlug}`}
          >
            <Text
              className="text-xs font-medium text-on-primary-tint dark:text-primary"
              nativeID={`invited-emails-list-chip-${chipSlug}-label`}
              testID={`invited-emails-list-chip-${chipSlug}-label`}
            >
              {groups.length > 0 ? `${invite.email} · ${groupName}` : invite.email}
            </Text>
            <IconTooltip idPrefix={`invited-emails-list-chip-${chipSlug}-remove-button-tooltip`} label={`Quitar ${invite.email}`}>
              <Pressable
                accessibilityLabel={`Quitar ${invite.email}`}
                onPress={() => handleRemove(invite.email)}
                nativeID={`invited-emails-list-chip-${chipSlug}-remove-button`}
                testID={`invited-emails-list-chip-${chipSlug}-remove-button`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={14} />
              </Pressable>
            </IconTooltip>
          </View>
        );
      })}
    </View>
  );
}
