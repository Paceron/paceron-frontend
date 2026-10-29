import { View } from 'react-native';

// Contenedor estable de la pestaña de métricas; filtros y acciones quedan fuera.
export function DashboardBody({ id, captureRef, children }) {
  return (
    <View className="mt-2" nativeID={id} testID={id}>
      <View collapsable={false} nativeID={`${id}-capture`} ref={captureRef} testID={`${id}-capture`}>
        {children}
      </View>
    </View>
  );
}
