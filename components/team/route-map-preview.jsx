import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Mapa real (no SVG) con el trazado de una competencia type='route' --
// pedido real, 2026-10-17: "la silueta debe dibujarse sobre un mapa real...
// como el que se usa en la vista del entrenador en las sesiones
// presenciales en vivo" (trainer-session-live-screen.jsx -- de ahí
// OPENFREEMAP_MINIMAL_STYLE_URL, "sin contenido distractivo"). Reemplaza
// a RouteThumbnail (SVG a mano, eliminado) ahora que esto se muestra
// siempre, no en una lista masiva de filas. Bloqueado (sin pan/zoom/
// rotate, `pointerEvents="none"`) -- es una previsualización de lectura,
// no un mapa para explorar; el dibujo real sigue pasando por
// RouteDrawPicker en el modal de creación.
export function RouteMapPreview({ coordinates, nativeID, testID }) {
  const points = coordinates ?? [];
  const lineGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} };
  const bounds = computeBounds(points.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
  const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  return (
    <View className="h-full w-full overflow-hidden rounded-xl" nativeID={nativeID} pointerEvents="none" testID={testID}>
      <Map mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL} nativeID={`${nativeID}-map`} style={{ flex: 1 }} testID={`${testID}-map`}>
        <Camera bounds={bounds ?? undefined} initialViewState={{ center: initialCenter, zoom: 13 }} padding={24} />
        {points.length > 1 && (
          <GeoJSONSource id={`${nativeID}-line-source`} shape={lineGeojson}>
            <Layer id={`${nativeID}-line-layer`} style={{ lineCap: 'round', lineColor: '#8cc63e', lineJoin: 'round', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}
