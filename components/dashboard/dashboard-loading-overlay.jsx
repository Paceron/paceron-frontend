import { ActivityIndicator, Text, View } from 'react-native';

// Capa absoluta, no `Modal`: se monta dentro del dashboard para bloquear solo su
// contenido y no abrir una superficie nativa aparte. `pointerEvents` en el
// `style` es lo que impide tocar los filtros mientras la request está en vuelo.
export function DashboardLoadingOverlay({ visible, id = 'dashboard-loading', label }) {
  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal
      className="absolute inset-0 items-center justify-center rounded-2xl px-6"
      nativeID={`${id}-overlay`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)', pointerEvents: 'auto', zIndex: 50 }}
      testID={`${id}-overlay`}
    >
      <ActivityIndicator color="#8cc63e" size="large" />
      {label ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-4 text-center text-base font-semibold text-white"
          nativeID={`${id}-label`}
          testID={`${id}-label`}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
