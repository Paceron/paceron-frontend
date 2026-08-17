import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Checkbox con label presionable y error opcional debajo.
// El label se pasa como children para permitir texto enriquecido (ej. un
// link inline que abre un modal); un <Text onPress> anidado maneja su
// propio toque sin togglear el checkbox.
export function CheckboxField({ checked, onChange, error, idPrefix, children }) {
  return (
    <View className="mb-2" nativeID={idPrefix} testID={idPrefix}>
      <Pressable
        className="flex-row items-center gap-3 py-1"
        nativeID={`${idPrefix}-pressable`}
        testID={`${idPrefix}-pressable`}
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          className={`h-5 w-5 items-center justify-center rounded border-2 ${
            checked
              ? 'border-primary bg-primary'
              : error
                ? 'border-red-400 dark:border-red-800'
                : 'border-slate-300 dark:border-slate-600'
          }`}
          nativeID={`${idPrefix}-box`}
          testID={`${idPrefix}-box`}
        >
          {checked ? (
            <MaterialCommunityIcons color="#111518" name="check-bold" size={14} />
          ) : null}
        </View>

        <View className="flex-1" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {children}
        </View>
      </Pressable>

      {error ? (
        <Text
          className="mt-1.5 text-xs text-red-500 dark:text-red-400"
          nativeID={`${idPrefix}-error`}
          testID={`${idPrefix}-error`}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
