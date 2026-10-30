import { Image, Text, View } from 'react-native';

// Mismo asset y mismo criterio que `CheckinWaitingOverlay`: el GIF es
// bicromático sobre un gris `#979597` exacto, y la tarjeta usa ese mismo gris
// como fondo para que el rectángulo del asset empalme sin costura. No
// transparentarlo ni cambiarle el fondo.
const CARD_BG = '#979597';

// Capa absoluta, no `Modal`: se monta dentro del dashboard para bloquear solo su
// contenido y no abrir una superficie nativa aparte. `pointerEvents` en el
// `style` es lo que impide tocar los filtros mientras la request está en vuelo.
export function DashboardLoadingOverlay({ visible }) {
  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal
      className="absolute inset-0 items-center justify-center rounded-2xl px-6"
      nativeID="dashboard-loading-overlay"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)', pointerEvents: 'auto', zIndex: 50 }}
      testID="dashboard-loading-overlay"
    >
      <View
        className="items-center rounded-2xl px-8 py-6"
        nativeID="dashboard-loading-card"
        style={{ backgroundColor: CARD_BG }}
        testID="dashboard-loading-card"
      >
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Animación de un corredor corriendo"
          contentFit="contain"
          nativeID="dashboard-loading-animation"
          resizeMode="contain"
          source={require('../../assets/paceron-runner-waiting.gif')}
          style={{ width: 200, height: 112 }}
          testID="dashboard-loading-animation"
        />

        <Text
          accessibilityLiveRegion="polite"
          className="mt-4 text-center text-base font-semibold text-white"
          nativeID="dashboard-loading-label"
          testID="dashboard-loading-label"
        >
          Cargando métricas…
        </Text>
      </View>
    </View>
  );
}
