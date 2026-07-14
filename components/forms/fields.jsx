import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { isWeb } from '../../utils/platform.js';

// Primitivos de formulario compartidos por register y edit de perfil.

export const INPUT_CLASS = 'flex-1 px-4 text-sm text-slate-900 dark:text-white outline-none';
export const FIELD_LABEL = 'mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200';
export const SELECT_CLASS = 'h-12 flex-1 px-4 py-2 text-sm text-slate-900 dark:text-white rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 outline-none appearance-none';
const DATE_BASE = 'h-12 flex-1 px-4 py-2 text-sm text-slate-900 dark:text-white rounded-xl border outline-none appearance-none';

// Fila responsive: en web reparte los hijos en columnas; en mobile apila.
export function Row({ children }) {
  return <View className={isWeb ? 'flex-row gap-4' : ''}>{children}</View>;
}

// Columna con peso de ancho (solo web); en mobile ocupa el ancho completo.
export function Col({ children, flex = 1 }) {
  return <View style={isWeb ? { flex } : undefined}>{children}</View>;
}

export function SelectField({ label, options, value, onChange, placeholder, disabled, error }) {
  const colors = useThemeColors();

  // Normaliza opciones: acepta strings (ej. localidades) u objetos { id, name }.
  const items = options.map((opt) => (typeof opt === 'string' ? { id: opt, name: opt } : opt));

  return (
    <View className="mb-5">
      <Text className={FIELD_LABEL}>{label}</Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 relative">
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
          {!disabled && value && (
            <Pressable
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onPress={() => onChange('')}
              accessibilityLabel="Limpiar selección"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle" size={20} />
            </Pressable>
          )}
        </View>
      </View>
      <View className="h-5">{error && <Text className="text-xs text-red-500 dark:text-red-400">{error}</Text>}</View>
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

  const borderClass = error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  if (isWeb) {
    return (
      <View className="mb-5">
        <Text className={FIELD_LABEL}>{label}</Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-1 relative">
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
        <View className="h-5">{error && <Text className="text-xs text-red-500 dark:text-red-400">{error}</Text>}</View>
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
    <View className="mb-5">
      <Text className={FIELD_LABEL}>{label}</Text>
      <Pressable
        className={`h-12 flex-row items-center rounded-xl border px-4 ${borderClass}`}
        disabled={disabled}
        onPress={() => setPickerVisible(true)}
      >
        <Text className={`flex-1 text-sm ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
          {value || 'DD/MM/AAAA'}
        </Text>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar" size={20} />
      </Pressable>
      <View className="h-5">{error && <Text className="text-xs text-red-500 dark:text-red-400">{error}</Text>}</View>

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
        <Modal animationType="fade" onRequestClose={handleClose} transparent visible={pickerVisible}>
          <Pressable className="flex-1 justify-end bg-black/50" onPress={handleClose}>
            <Pressable className="rounded-t-2xl bg-white p-4 dark:bg-surface-2" onPress={() => {}}>
              <DateTimePicker
                display="inline"
                maximumDate={new Date()}
                mode="date"
                onChange={handleChange}
                themeVariant={themeMode}
                value={parseDDMMYYYY(value)}
              />
              <Pressable className="mt-2 h-11 items-center justify-center rounded-full bg-primary active:opacity-80" onPress={handleClose}>
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">Listo</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

export function InputField({ label, value, onChange, onBlur, error, touched, placeholder, secureTextEntry, keyboardType, autoComplete, textContentType, autoCapitalize, onSubmitEditing, returnKeyType, onToggleSecure, showSecure, disabled }) {
  const colors = useThemeColors();

  const borderColor = disabled
    ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
    : error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched && !error
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900';

  return (
    <View className="mb-5">
      <Text className={FIELD_LABEL}>{label}</Text>
      <View className={`h-12 flex-row items-center rounded-xl border ${borderColor}`}>
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          className={INPUT_CLASS}
          editable={!disabled}
          keyboardType={keyboardType}
          onBlur={onBlur}
          onChangeText={onChange}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          textContentType={textContentType}
          value={value}
        />
        {onToggleSecure && (
          <Pressable className="px-3" onPress={onToggleSecure}>
            <MaterialCommunityIcons
              color={colors.onSurfaceVariant}
              name={showSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
            />
          </Pressable>
        )}
      </View>
      <View className="h-5">
        {error && <Text className="text-xs text-red-500 dark:text-red-400">{error}</Text>}
      </View>
    </View>
  );
}

export function PickerField({ label, options, value, onChange, placeholder, disabled, error }) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

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
    <View className="mb-5">
      <Text className={FIELD_LABEL}>{label}</Text>
      <Pressable
        className={`h-12 flex-row items-center rounded-xl border px-4 ${borderClass}`}
        onPress={disabled ? undefined : () => setVisible(true)}
      >
        <Text className={`flex-1 text-sm ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
          {selected ? selected.name : placeholder}
        </Text>
        {!disabled && value && (
          <Pressable
            onPress={() => { onChange(''); setVisible(false); }}
            accessibilityLabel="Limpiar selección"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle" size={20} />
          </Pressable>
        )}
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={20} />
      </Pressable>
      <View className="h-5">{error && <Text className="text-xs text-red-500 dark:text-red-400">{error}</Text>}</View>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <Pressable className="flex-1 justify-center bg-black/50 px-6" onPress={() => setVisible(false)}>
          <Pressable
            className="max-h-80 rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-surface-2"
            onPress={() => {}}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {items.length === 0 ? (
                <View className="items-center py-8">
                  <Text className="text-sm text-slate-400 dark:text-slate-500">Sin opciones disponibles</Text>
                </View>
              ) : (
                items.map((item) => {
                  const isSelected = item.id === value;
                  return (
                    <Pressable
                      key={item.id}
                      className={`flex-row items-center gap-3 border-b border-slate-100 px-5 py-3.5 active:opacity-70 dark:border-slate-800 ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                      onPress={() => { onChange(item.id); setVisible(false); }}
                    >
                      <Text className={`flex-1 text-sm ${
                        isSelected ? 'font-semibold text-primary' : 'text-slate-700 dark:text-slate-200'
                      }`}>
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
