import { Pressable, Text, View } from 'react-native';

const MODES = [
  { id: 'gross', label: 'Bruto' },
  { id: 'net', label: 'Neto' },
];

// Elige si el dashboard muestra montos brutos o netos. El neto es solo el que
// informó Mercado Pago: nunca se estima (ver utils/payments-summary.js#amountFor).
export function PaymentsAmountMode({ mode, onChange }) {
  return (
    <View className="flex-row items-center gap-2" nativeID="payments-amount-mode" testID="payments-amount-mode">
      <Text className="text-xs font-medium text-slate-500 dark:text-slate-400" nativeID="payments-amount-mode-label" testID="payments-amount-mode-label">
        Montos
      </Text>
      <View className="flex-row rounded-full bg-slate-100 p-1 dark:bg-slate-800" nativeID="payments-amount-mode-segments" testID="payments-amount-mode-segments">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full px-3 py-1 ${active ? 'bg-white shadow-sm dark:bg-surface' : 'hover:opacity-80'}`}
              nativeID={`payments-amount-mode-${m.id}`}
              onPress={() => onChange(m.id)}
              testID={`payments-amount-mode-${m.id}`}
            >
              <Text
                className={`text-xs ${active ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-500 dark:text-slate-400'}`}
                nativeID={`payments-amount-mode-${m.id}-label`}
                testID={`payments-amount-mode-${m.id}-label`}
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
