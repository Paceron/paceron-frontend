import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Parte visual del botón de conectar Mercado Pago, compartida por las dos
// variantes de plataforma (mp-connect-button.jsx / .web.jsx) — el flujo de
// autorización es distinto en cada una, el aspecto no.
export function MpConnectButtonView({ connected, loading, disabled, onPress }) {
  const colors = useThemeColors();

  if (connected) {
    return (
      <View
        className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/30"
        nativeID="mp-connect-button-connected"
        testID="mp-connect-button-connected"
      >
        <MaterialCommunityIcons color="#10b981" name="check-circle" size={18} />
        <Text
          className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"
          nativeID="mp-connect-button-connected-label"
          testID="mp-connect-button-connected-label"
        >
          Cuenta conectada
        </Text>
      </View>
    );
  }

  const inactive = disabled || loading;

  return (
    <Pressable
      className={`h-12 flex-row items-center justify-center gap-2 rounded-full ${
        inactive ? 'bg-slate-100 dark:bg-slate-800' : 'bg-[#009ee3] hover:opacity-90'
      } active:opacity-80`}
      disabled={inactive}
      nativeID="mp-connect-button"
      onPress={onPress}
      testID="mp-connect-button"
    >
      {loading ? (
        <ActivityIndicator color={colors.onSurfaceVariant} size="small" />
      ) : (
        <>
          <MaterialCommunityIcons
            color={inactive ? colors.onSurfaceVariant : '#ffffff'}
            name="link-variant"
            size={18}
          />
          <Text
            className={`text-sm font-semibold uppercase tracking-wide ${
              inactive ? 'text-slate-400 dark:text-slate-500' : 'text-white'
            }`}
            nativeID="mp-connect-button-label"
            testID="mp-connect-button-label"
          >
            Conectar Mercado Pago
          </Text>
        </>
      )}
    </Pressable>
  );
}
