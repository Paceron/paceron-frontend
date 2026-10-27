import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FIELD_LABEL } from './fields.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';

// Campo numérico ESCRIBIBLE A MANO con una lista de valores frecuentes, para
// filtros donde el `select` no alcanza: `ResponsiveSelectField` es cerrado, y
// acá hace falta poder escribir 3,5 aunque no esté en la lista.
//
// `value` y `onChange` son TEXTO, no número, y a propósito: es un campo libre y
// mientras se tipea el texto válido (o inválido) se necesita poder verlo. Quien
// lo usa decide qué es un valor bueno (utils/dashboard-range.js para los rangos
// del dashboard).
//
// La lista se despliega EN FLUJO adentro del propio campo, no flotando con
// `AnimatedDropdown`: un panel absoluto anidado adentro de un form queda debajo
// de los campos de abajo en nativo, porque React Native pinta en orden de árbol
// y el zIndex de un nieto no compite con los tíos (en web el `z-index: 50` sí
// resuelve, que es lo que hace que el problema no se viera en el preview).
// Además ocupa cero espacio en el árbol: no hay `measureInWindow` ni offsets que
// puedan quedar desfasados con el scroll.
export function NumberFieldWithSuggestions({
  idPrefix,
  label,
  accessibilityLabel,
  labelClassName = FIELD_LABEL,
  value,
  onChange,
  unit,
  suggestions = [],
  disabled = false,
  error,
  placeholder,
  dense = false,
  className,
  hideLabel = false,
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  // El rótulo visible puede quedar corto ("Desde") cuando un título de grupo ya
  // dice de qué es el rango; el nombre accesible tiene que seguir siendo el
  // completo ("Distancia desde") o hay dos campos iguales para el lector de
  // pantalla.
  const a11yLabel = accessibilityLabel ?? label;

  const parsed = parseNumber(value);
  const inList = parsed !== null && suggestions.some((item) => Number(item) === parsed);

  // Un valor escrito a mano que no está en la lista se muestra igual, marcado
  // como el que está filtrando: si no, el campo parecería vacío y la pantalla
  // no dejaría ver qué se está acotando.
  const chips = useMemo(() => {
    const typed = parsed !== null && !inList ? [{ id: `${parsed}`, value: parsed, typed: true }] : [];
    return [...typed, ...suggestions.map((item) => ({ id: `${item}`, value: Number(item), typed: false }))];
  }, [parsed, inList, suggestions]);

  const borderColor = disabled
    ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
    : error
      ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900';
  // En web, la variante `dense` se usa dentro de grupos de dos campos (los
  // rangos del dashboard) y el toggle de 44 px + el padding de 16 px dejaban al
  // input sin ancho visible. En táctil se mantienen los 44 px de touch target;
  // en web el toggle baja a 36 px, el alto a 32 px (el mismo de `DateField`
  // dense, para que la fila quede alineada) y el input a `px-2`. Eso es lo que
  // permite poner tres grupos de dos extremos en una sola fila sin recortar el
  // valor.
  const compactWeb = dense && isWeb;
  const inputPadding = compactWeb ? 'px-2' : 'px-4';
  const boxHeight = compactWeb ? 'min-h-8' : 'min-h-12';
  const toggleClass = compactWeb ? 'h-8 w-9' : 'h-11 w-11';

  const choose = (number) => {
    onChange(formatDecimal(number));
    setOpen(false);
  };

  return (
    <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={idPrefix} testID={idPrefix}>
      {!hideLabel && (
        <Text className={labelClassName} nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {label}
        </Text>
      )}
      <View
        className={`${boxHeight} flex-row items-center rounded-xl border ${borderColor}`}
        nativeID={`${idPrefix}-box`}
        testID={`${idPrefix}-box`}
      >
        <TextInput
          accessibilityLabel={a11yLabel}
          // `min-w-0` con `flex-1` (y no el `INPUT_CLASS` de los campos sueltos):
          // un flex item tiene `min-width: auto`, así que nunca baja del ancho
          // intrínseco del <input> — y en web ese ancho es de ~20 caracteres,
          // suficiente para empujar el botón de sugerencias fuera de la caja. Es
          // el mismo motivo por el que InputField lo hace con su stepper.
          className={`min-w-0 flex-1 ${inputPadding} text-sm text-slate-900 outline-none dark:text-white`}
          editable={!disabled}
          keyboardType="decimal-pad"
          nativeID={`${idPrefix}-input`}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant}
          testID={`${idPrefix}-input`}
          value={value ?? ''}
        />
        {unit ? (
          <Text className="pr-1 text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-unit`} testID={`${idPrefix}-unit`}>
            {unit}
          </Text>
        ) : null}
        {/* Botón aparte, del ancho de un touch target completo: el desplegable
            es un control propio, no un detalle del input. */}
        <Pressable
          accessibilityLabel={`Valores sugeridos para ${a11yLabel}`}
          accessibilityRole="button"
          accessibilityState={{ disabled, expanded: open }}
          aria-expanded={open}
          className={`${toggleClass} items-center justify-center rounded-r-xl active:opacity-70`}
          disabled={disabled}
          nativeID={`${idPrefix}-suggestions-toggle`}
          onPress={() => setOpen((current) => !current)}
          testID={`${idPrefix}-suggestions-toggle`}
        >
          <MaterialCommunityIcons
            color={disabled ? colors.onSurfaceVariant : colors.primary}
            name={open ? 'chevron-up' : 'chevron-down'}
            size={20}
          />
        </Pressable>
      </View>

      {open ? (
        <View
          className="mt-1.5 flex-row flex-wrap gap-1.5"
          nativeID={`${idPrefix}-suggestions`}
          role="listbox"
          testID={`${idPrefix}-suggestions`}
        >
          {chips.map((chip) => {
            const chipIds = `${idPrefix}-suggestion-${chip.id}`;
            const isSelected = chip.value === parsed;
            return (
              <Pressable
                accessibilityLabel={`${formatDecimal(chip.value)}${unit ? ` ${unit}` : ''}`}
                accessibilityRole="button"
                // Los dos, por el motivo de siempre: react-native-web@0.21 no
                // implementa `accessibilityState`, y en Android `role` crudo con
                // `option` no está en el switch de TalkBack (ver
                // searchable-picker-field.jsx para el detalle completo).
                accessibilityState={{ selected: isSelected }}
                aria-selected={isSelected}
                className={`flex-row items-center gap-1 rounded-lg border px-2.5 py-1.5 active:opacity-70 ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                }`}
                key={chipIds}
                nativeID={chipIds}
                onPress={() => choose(chip.value)}
                role="option"
                testID={chipIds}
              >
                {isSelected ? <MaterialCommunityIcons color={colors.primary} name="check" size={14} /> : null}
                <Text
                  className={`text-xs font-semibold ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}
                  nativeID={`${chipIds}-label`}
                  testID={`${chipIds}-label`}
                >
                  {formatDecimal(chip.value)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View className="h-5" nativeID={`${idPrefix}-error-row`} testID={`${idPrefix}-error-row`}>
        {error ? (
          <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`${idPrefix}-error`} testID={`${idPrefix}-error`}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Un chip con `3,5` y no con `3.5000000001`: el suggestor manda enteros y el
// value typed viene de lo que escribió la persona, así que el formato se
// decide acá y no en cada chip.
function formatDecimal(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(value);
}