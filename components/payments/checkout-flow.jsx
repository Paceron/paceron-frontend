import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Rama nativa de CheckoutFlow — Payment Brick es un componente web
// (HTML/JS), sin equivalente nativo. Decisión WebView vs Checkout Pro
// sigue pendiente (ver docs/superpowers/specs/2026-08-12-subscription-tier-checkout-design.md)
// — mismo pill "Próximamente" que el resto del repo usa para
// funcionalidad no lista todavía, no un throw ni pantalla en blanco.
export function CheckoutFlow() {
  const colors = useThemeColors();
  return (
    <View className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800" nativeID="checkout-flow-native-coming-soon" testID="checkout-flow-native-coming-soon">
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={18} />
      <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="checkout-flow-native-coming-soon-label" testID="checkout-flow-native-coming-soon-label">
        Próximamente en la app
      </Text>
    </View>
  );
}
