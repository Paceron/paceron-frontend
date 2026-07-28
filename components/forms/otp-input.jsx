import { Text, View } from 'react-native';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

const CELL_COUNT = 6;

// Input de código OTP de 6 dígitos, un casillero por dígito — usa
// react-native-confirmation-code-field (RN + RN Web, cero deps) con
// renderCell para dibujar cada casillero nosotros mismos, así el theming
// (claro/oscuro) sale de las mismas clases NativeWind que el resto de los
// campos del formulario, no de props de estilo de la librería.
export function OtpInput({ value, onChange, error, label }) {
  const ref = useBlurOnFulfill({ value, cellCount: CELL_COUNT });
  const [fieldProps, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue: onChange,
  });

  return (
    <View className="mb-5" nativeID="otp-input" testID="otp-input">
      {label && (
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="otp-input-label" testID="otp-input-label">
          {label}
        </Text>
      )}
      <View className="max-w-[380px]" nativeID="otp-input-cells-wrapper" testID="otp-input-cells-wrapper">
        <CodeField
          ref={ref}
          {...fieldProps}
          cellCount={CELL_COUNT}
          keyboardType="number-pad"
          nativeID="otp-input-field"
          onChangeText={onChange}
          renderCell={({ index, symbol, isFocused }) => (
            <View
              key={index}
              className={`h-14 flex-1 items-center justify-center rounded-xl border ${
                error
                  ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
                  : isFocused
                  ? 'border-primary bg-white dark:bg-slate-900'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
              }`}
              nativeID={`otp-input-cell-${index}`}
              onLayout={getCellOnLayoutHandler(index)}
              testID={`otp-input-cell-${index}`}
            >
              <Text className="text-xl font-semibold text-slate-900 dark:text-white" nativeID={`otp-input-cell-${index}-text`} testID={`otp-input-cell-${index}-text`}>
                {symbol || (isFocused ? <Cursor /> : null)}
              </Text>
            </View>
          )}
          rootStyle={{ flexDirection: 'row', gap: 8 }}
          testID="otp-input-field"
          textContentType="oneTimeCode"
          value={value}
        />
      </View>
      <View className="h-5" nativeID="otp-input-error-row" testID="otp-input-error-row">
        {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID="otp-input-error" testID="otp-input-error">{error}</Text>}
      </View>
    </View>
  );
}
