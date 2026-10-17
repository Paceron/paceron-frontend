import { Pressable, Text, View } from 'react-native';

const MODES = [
  { id: 'gross', label: 'Bruto' },
  { id: 'net', label: 'Neto' },
];

// Elige si el dashboard muestra montos brutos o netos. El neto es solo el que
// informó Mercado Pago: nunca se estima (ver utils/payments-summary.js#amountFor).
//
// Las clases de cada botón cambian solo de color entre seleccionado y no: nada de
// `shadow-*` ni pseudo-estados (`hover:`/`active:`) condicionales. En nativo,
// NativeWind convierte un componente que recibe esas clases DESPUÉS del primer
// render (las sombras usan variables CSS) y lo remonta: al tocar "Neto" el botón
// se remontaba en pleno toque y rompía la pantalla. En web no pasa (es CSS).
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
              className={`rounded-full px-3 py-1 ${active ? 'bg-white dark:bg-surface' : 'bg-transparent'}`}
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
