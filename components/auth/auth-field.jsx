import { Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useThemeColors } from '../../theme/colors.js';

// Campo de login/registro: label + input en una sola tarjeta, sin placeholder
// (sería redundante con el label de arriba) y con el error adentro de la
// misma tarjeta en vez de en una fila reservada aparte — a diferencia de
// InputField (forms/fields.jsx), que SIEMPRE reserva un renglón de error para
// no mover nada debajo. Acá el error expande la tarjeta y empuja lo de abajo,
// animado con el `layout` de reanimated — decisión explícita para las
// pantallas de auth, no un cambio a la convención general.
export function AuthField({
  idPrefix,
  label,
  value,
  onChangeText,
  onBlur,
  error,
  success,
  trailing,
  className,
  ...textInputProps
}) {
  const colors = useThemeColors();

  const borderColor = error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : success
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900';

  return (
    // El margen va en el View interno, no en el Animated.View de afuera:
    // Animated.View (reanimated) no aplica NINGÚN className de NativeWind en
    // este proyecto (mismo bug ya documentado en theme-toggle.jsx y
    // session-drag-and-drop.jsx — confirmado con getComputedStyle, el
    // className genera un valor en el DOM sin efecto visual real). El
    // Animated.View de acá solo existe para el `layout` de la animación.
    <Animated.View layout={LinearTransition.duration(200)} nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
      <View className={`${className ?? 'mb-4'} rounded-xl bg-slate-200/50 px-4 pb-2.5 pt-2.5 dark:bg-slate-800/50`} nativeID={`${idPrefix}-box`} testID={`${idPrefix}-box`}>
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {label}
        </Text>
        <View className={`h-12 flex-row items-center rounded-xl border ${borderColor}`} nativeID={`${idPrefix}-field-wrapper`} testID={`${idPrefix}-field-wrapper`}>
          <TextInput
            className="flex-1 px-4 text-sm text-slate-900 dark:text-white outline-none"
            onBlur={onBlur}
            onChangeText={onChangeText}
            placeholderTextColor={colors.onSurfaceVariant}
            value={value}
            nativeID={`${idPrefix}-input`}
            testID={`${idPrefix}-input`}
            {...textInputProps}
          />
          {trailing}
        </View>
        {error && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} nativeID={`${idPrefix}-error-row`} testID={`${idPrefix}-error-row`}>
            <Text className="pt-1.5 text-xs text-red-500 dark:text-red-400" nativeID={`${idPrefix}-error`} testID={`${idPrefix}-error`}>
              {error}
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}
