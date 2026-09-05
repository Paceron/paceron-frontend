import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FIELD_LABEL } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Select requerido + botón compacto "crear nuevo" al lado, alineados por
// altura (mismo h-12) en vez de por Row/Col — Row/Col depende del ancho de
// ventana y además el selector trae su propio label, que empuja su control
// hacia abajo mientras el botón (sin label) queda flush arriba: eso
// desalineaba el botón contra el select. Acá el label vive una sola vez,
// afuera, y ambos controles arrancan a la misma altura. `scope` prefija los
// nativeID/testID de esta instancia (mismo criterio que InlinePicker).
export function SelectWithCreateField({
  scope,
  label,
  options,
  value,
  onChange,
  placeholder,
  onRequestCreate,
  createAccessibilityLabel,
  disabled,
  error,
  className,
}) {
  return (
    <View className={className ?? 'mb-3'} nativeID={scope} testID={scope}>
      <Text className={FIELD_LABEL} nativeID={`${scope}-label`} testID={`${scope}-label`}>{label}</Text>
      <View className="flex-row items-center gap-2" nativeID={`${scope}-row`} testID={`${scope}-row`}>
        <View className="flex-1" nativeID={`${scope}-field-wrapper`} testID={`${scope}-field-wrapper`}>
          <ResponsiveSelectField
            className="mb-0"
            dense
            disabled={disabled}
            error={error}
            hideErrorRow
            hideLabel
            label={label}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            required
            value={value}
          />
        </View>
        <Pressable
          accessibilityLabel={createAccessibilityLabel}
          className="h-12 w-12 items-center justify-center rounded-xl border border-dashed border-primary hover:bg-primary-tint-subtle active:opacity-70 dark:hover:bg-primary/10"
          nativeID={`${scope}-create-button`}
          onPress={onRequestCreate}
          testID={`${scope}-create-button`}
        >
          <MaterialCommunityIcons color="#8cc63e" name="plus" size={20} />
        </Pressable>
      </View>
    </View>
  );
}
