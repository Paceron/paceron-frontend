import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useThemeColors } from '../../theme/colors.js';
import { buildRoutePreviewPoints } from '../../utils/route-geometry.js';

const THUMBNAIL_HEIGHT = 72;

// Frame con el trazado de una competencia type='route' (Spec 4c) -- pedido
// real, 2026-10-16: la fila no mostraba ningún trazado visual, solo el
// título. SVG a mano (mismo patrón que payments-monthly-chart.jsx) en vez
// de un mapa real (MapLibre) a propósito: esto es una miniatura de lista,
// no necesita tiles/geolocalización real -- cargar un mapa completo por
// fila sería carísimo y MapLibre ni siquiera corre en Expo Go. El ancho se
// mide con onLayout porque SVG necesita números.
export function RouteThumbnail({ coordinates, nativeID, testID }) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const points = buildRoutePreviewPoints(coordinates, { width, height: THUMBNAIL_HEIGHT, padding: 10 });
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View
      className="overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
      nativeID={nativeID}
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      style={{ height: THUMBNAIL_HEIGHT }}
      testID={testID}
    >
      {width > 0 && points.length > 1 && (
        <Svg height={THUMBNAIL_HEIGHT} width={width}>
          <Polyline
            fill="none"
            points={polylinePoints}
            stroke={colors.primary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
          />
          <Circle cx={points[0].x} cy={points[0].y} fill={colors.primary} r={3.5} />
          <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} fill="#ef4444" r={3.5} />
        </Svg>
      )}
    </View>
  );
}
