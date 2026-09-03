import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { isWeb } from '../../utils/platform.js';
import { validateEmailFormat } from '../../utils/email-validators.js';
import { BREAKPOINTS } from '../../theme/tokens.js';

// Primitivos de formulario compartidos por register y edit de perfil.

export const INPUT_CLASS = 'flex-1 px-4 text-sm text-slate-900 dark:text-white outline-none';
export const FIELD_LABEL = 'mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200';
export const SELECT_CLASS = 'h-12 flex-1 px-4 py-2 text-sm text-slate-900 dark:text-white rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 outline-none appearance-none';
const DATE_BASE = 'h-12 flex-1 px-4 py-2 text-sm text-slate-900 dark:text-white rounded-xl border outline-none appearance-none';

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

export function SelectField({ label, options, value, onChange, placeholder, disabled, error, dense, className, hideErrorRow, required }) {
  const colors = useThemeColors();
  const slug = slugify(label);

  // Normaliza opciones: acepta strings (ej. localidades) u objetos { id, name }.
  const items = options.map((opt) => (typeof opt === 'string' ? { id: opt, name: opt } : opt));

  return (
    <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={`select-field-${slug}`} testID={`select-field-${slug}`}>
      <Text className={FIELD_LABEL} nativeID={`select-field-${slug}-label`} testID={`select-field-${slug}-label`}>{label}</Text>
      <View
        className="flex-row items-center gap-2"
        nativeID={`select-field-${slug}-row`}
        testID={`select-field-${slug}-row`}
      >
        <View className="flex-1 relative" nativeID={`select-field-${slug}-input-wrapper`} testID={`select-field-${slug}-input-wrapper`}>
          <select
            className={SELECT_CLASS}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">{placeholder}</option>
            {items.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          {!disabled && !required && value && (
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

export function DateField({ label, value, onChange, onBlur, error, touched, disabled }) {
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
      <View className="mb-5" nativeID={`date-field-${slug}`} testID={`date-field-${slug}`}>
        <Text className={FIELD_LABEL} nativeID={`date-field-${slug}-label`} testID={`date-field-${slug}-label`}>{label}</Text>
        <View
          className="flex-row items-center gap-2"
          nativeID={`date-field-${slug}-row`}
          testID={`date-field-${slug}-row`}
        >
          <View className="flex-1 relative" nativeID={`date-field-${slug}-input-wrapper`} testID={`date-field-${slug}-input-wrapper`}>
            <input
              type="date"
              className={`${DATE_BASE} ${borderClass}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              disabled={disabled}
            />
          </View>
        </View>
        <View className="h-5" nativeID={`date-field-${slug}-error-row`} testID={`date-field-${slug}-error-row`}>
          {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`date-field-${slug}-error`} testID={`date-field-${slug}-error`}>{error}</Text>}
        </View>
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
    <View className="mb-5" nativeID={`date-field-${slug}`} testID={`date-field-${slug}`}>
      <Text className={FIELD_LABEL} nativeID={`date-field-${slug}-label`} testID={`date-field-${slug}-label`}>{label}</Text>
      <Pressable
        className={`h-12 flex-row items-center rounded-xl border px-4 hover:bg-slate-100 dark:hover:bg-slate-800 ${borderClass}`}
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
      <View className="h-5" nativeID={`date-field-${slug}-error-row`} testID={`date-field-${slug}-error-row`}>
        {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`date-field-${slug}-error`} testID={`date-field-${slug}-error`}>{error}</Text>}
      </View>

      {pickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          accentColor="#8cc63e"
          display="default"
          maximumDate={new Date()}
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
                maximumDate={new Date()}
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

export function InputField({ label, value, onChange, onBlur, error, hint, touched, placeholder, secureTextEntry, keyboardType, autoComplete, textContentType, autoCapitalize, onSubmitEditing, returnKeyType, onToggleSecure, showSecure, disabled, multiline, numberOfLines, dense, className, hideErrorRow }) {
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
      <Text className={FIELD_LABEL} nativeID={`input-field-${slug}-label`} testID={`input-field-${slug}-label`}>{label}</Text>
      <View
        className={`${rowSizeClass} flex-row rounded-xl border ${borderColor}`}
        nativeID={`input-field-${slug}-row`}
        testID={`input-field-${slug}-row`}
      >
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          className={INPUT_CLASS}
          editable={!disabled}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onBlur={onBlur}
          onChangeText={onChange}
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

export function PickerField({ label, options, value, onChange, placeholder, disabled, error, dense, className, hideErrorRow, required }) {
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

  return (
    <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={`picker-field-${slug}`} testID={`picker-field-${slug}`}>
      <Text className={FIELD_LABEL} nativeID={`picker-field-${slug}-label`} testID={`picker-field-${slug}-label`}>{label}</Text>
      <Pressable
        className={`h-12 flex-row items-center rounded-xl border px-4 hover:bg-slate-100 dark:hover:bg-slate-800 ${borderClass}`}
        onPress={disabled ? undefined : () => setVisible(true)}
        nativeID={`picker-field-${slug}-trigger`}
        testID={`picker-field-${slug}-trigger`}
      >
        <Text
          className={`flex-1 text-sm ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
          nativeID={`picker-field-${slug}-value`}
          testID={`picker-field-${slug}-value`}
        >
          {selected ? selected.name : placeholder}
        </Text>
        {!disabled && !required && value && (
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
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={20} />
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
export function InlinePicker({ scope, value, onChange, options, placeholder = 'Elegir', widthClass = 'max-w-[128px]', showPlaceholderOption = true }) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  const items = options.map((opt) => (typeof opt === 'string' ? { id: opt, name: opt } : opt));
  const selected = items.find((item) => item.id === value);

  if (isWeb) {
    return (
      <select
        className={`h-12 ${widthClass} rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white`}
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        {showPlaceholderOption && <option value="">{placeholder}</option>}
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
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
          className={`flex-1 text-xs ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
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

// Formulario para agregar un email a la vez a una lista de invitados (ej.
// invitar gente a un equipo antes de que exista, o desde la pantalla de
// invitar de un equipo ya existente), con grupo opcional por invitación.
// Solo agrega — no muestra la lista de ya agregados, eso es
// InvitedEmailsList (abajo), pensado para vivir en su propia sección
// visual separada ("Invitar" vs. "Invitados"). `groups` es opcional: sin
// ese prop (o vacío) no se muestra el picker de grupo. Sin grupo elegido,
// `onAdd` manda `groupId: ''` — el backend asigna el grupo principal del
// equipo por default (ver docs/BACKEND_API_GAPS.md gap 9, resuelto
// 2026-07-31). Las opciones del picker son directamente `groups` (ya
// incluye el grupo principal real) — no hay un "Sin grupo" inventado
// aparte.
//
// Autocompletar (GET /users/search?q=, mínimo 3 caracteres): el estado
// vive en `hooks/use-email-suggestions.js`, llamado por la pantalla
// dueña (no acá) — el panel de sugerencias es un AnimatedDropdown
// montado en la raíz de esa pantalla, no puede ser hijo de este
// componente (ver el comentario del hook para el porqué). `emailSearch`
// es el valor devuelto por ese hook; `draft`/`onDraftChange`/`onFocus`
// hacen que el input de email quede controlado desde ahí.
export function EmailInviteForm({ onAdd, groups = [], existingEmails = [], placeholder = 'nombre@email.com', emailSearch }) {
  const colors = useThemeColors();
  const slug = 'email-invite-form';
  const defaultGroupId = groups.find((g) => g.isDefault)?.id ?? '';
  const [draftGroupId, setDraftGroupId] = useState(defaultGroupId);
  const [draftError, setDraftError] = useState(null);
  const { draft, inputWrapperRef, handleChange, handleFocus, resetDraft } = emailSearch;

  // Los grupos pueden llegar async (todavía no estaban cuando se montó
  // el form) — mantiene seleccionado el principal mientras el usuario no
  // haya elegido otro a mano.
  useEffect(() => {
    if (!draftGroupId && defaultGroupId) setDraftGroupId(defaultGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultGroupId]);

  const handleAdd = () => {
    const email = draft.trim();
    if (!email) return;
    if (!validateEmailFormat(email)) {
      setDraftError('Email inválido');
      return;
    }
    if (existingEmails.includes(email)) {
      setDraftError('Ya agregaste ese email');
      return;
    }
    onAdd({ email, groupId: draftGroupId });
    resetDraft();
    setDraftGroupId(defaultGroupId);
    setDraftError(null);
  };

  return (
    <View nativeID={slug} testID={slug}>
      <View className="flex-row items-center gap-2" nativeID={`${slug}-row`} testID={`${slug}-row`}>
        <View
          className={`h-12 flex-1 flex-row items-center rounded-xl border ${
            draftError ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
          }`}
          nativeID={`${slug}-input-wrapper`}
          ref={inputWrapperRef}
          testID={`${slug}-input-wrapper`}
        >
          <TextInput
            autoCapitalize="none"
            className={INPUT_CLASS}
            keyboardType="email-address"
            onChangeText={(text) => { handleChange(text); if (draftError) setDraftError(null); }}
            onFocus={handleFocus}
            onSubmitEditing={handleAdd}
            placeholder={placeholder}
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="done"
            value={draft}
            nativeID={`${slug}-input`}
            testID={`${slug}-input`}
          />
        </View>

        {groups.length > 1 ? (
          <InlinePicker
            onChange={setDraftGroupId}
            options={groups}
            placeholder="Grupo"
            scope={`${slug}-group`}
            showPlaceholderOption={false}
            value={draftGroupId}
            widthClass="max-w-[160px]"
          />
        ) : groups.length === 1 && (
          // Un solo grupo (el principal) — nada para elegir, se muestra
          // fijo en vez de un select interactivo sin sentido.
          <View
            className="h-12 max-w-[160px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 dark:border-slate-700 dark:bg-slate-800"
            nativeID={`${slug}-single-group`}
            testID={`${slug}-single-group`}
          >
            <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${slug}-single-group-label`} numberOfLines={1} testID={`${slug}-single-group-label`}>
              {groups[0].name}
            </Text>
          </View>
        )}

        <Pressable
          className="h-12 w-12 items-center justify-center rounded-xl bg-primary hover:opacity-90 active:opacity-80"
          accessibilityLabel="Agregar email"
          nativeID={`${slug}-add-button`}
          onPress={handleAdd}
          testID={`${slug}-add-button`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={20} />
        </Pressable>
      </View>

      <View className="h-5" nativeID={`${slug}-error-row`} testID={`${slug}-error-row`}>
        {draftError && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`${slug}-error`} testID={`${slug}-error`}>{draftError}</Text>}
      </View>
    </View>
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
            <Pressable
              accessibilityLabel={`Quitar ${invite.email}`}
              onPress={() => handleRemove(invite.email)}
              nativeID={`invited-emails-list-chip-${chipSlug}-remove-button`}
              testID={`invited-emails-list-chip-${chipSlug}-remove-button`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={14} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
