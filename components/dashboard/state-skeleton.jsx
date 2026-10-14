import { View } from 'react-native';
import { SkeletonBlock } from '../shared/skeleton.jsx';

// Estado de carga. Esqueleto con la MISMA disposición que el contenido final —
// KPIs arriba, gráfico en el medio, tabla al pie— para que al resolver no haya
// salto de layout, y nunca un spinner centrado (spec, "carga inicial").
//
// Reusa `components/shared/skeleton.jsx`, que ya usan 5 pantallas y tiene el
// guard de movimiento reducido que se le agregó para esto: el sondeo de esta
// pantalla es de 60-120 s y un shimmer infinito durante un polling largo es
// exactamente el caso donde `prefers-reduced-motion` molesta.
export function StateSkeleton({ id = 'dashboard-skeleton' }) {
  return (
    <View nativeID={id} testID={id}>
      <View className="mb-4 flex-row gap-2" nativeID={`${id}-kpis`} testID={`${id}-kpis`}>
        {[0, 1, 2, 3].map((index) => (
          <SkeletonBlock className="flex-1" height={74} key={index} nativeID={`${id}-kpi-${index}`} testID={`${id}-kpi-${index}`} />
        ))}
      </View>
      <SkeletonBlock className="mb-4" height={200} nativeID={`${id}-chart`} testID={`${id}-chart`} />
      <SkeletonBlock className="mb-4" height={180} nativeID={`${id}-chart-2`} testID={`${id}-chart-2`} />
      <SkeletonBlock height={140} nativeID={`${id}-table`} testID={`${id}-table`} />
    </View>
  );
}
