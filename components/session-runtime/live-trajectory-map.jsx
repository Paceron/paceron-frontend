import { useRef } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Mapa real con la trayectoria recorrida (y opcionalmente una ruta de
// referencia marcada) -- diseñado genérico a propósito (Spec 4c): esta
// spec solo lo usa para intentos de competencia de ruta, pero no le
// hardcodea nada de ese dominio (el caller decide si pasa `referenceRoute`
// o no). Pensado para reusarse en la mejora futura de "trayectoria de toda
// la sesión" (sin ruta de referencia, solo lo recorrido).
export function LiveTrajectoryMap({ traveledPoints, referenceRoute }) {
  const cameraRef = useRef(null);

  const traveledGeojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: (traveledPoints ?? []).map((p) => [p.longitude, p.latitude]) },
    properties: {},
  };

  const boundsSource = [
    ...(traveledPoints ?? []),
    ...(referenceRoute?.coordinates ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
  ];
  const bounds = computeBounds(boundsSource);
  const initialCenter = traveledPoints?.[0]
    ? [traveledPoints[0].longitude, traveledPoints[0].latitude]
    : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  return (
    <View className="h-64 overflow-hidden rounded-2xl" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <Map mapStyle={OPENFREEMAP_STYLE_URL} nativeID="live-trajectory-map" style={{ flex: 1 }} testID="live-trajectory-map">
        <Camera bounds={bounds ?? undefined} initialViewState={{ center: initialCenter, zoom: 14 }} padding={40} ref={cameraRef} />
        {referenceRoute?.coordinates?.length > 1 && (
          <GeoJSONSource id="live-trajectory-map-reference-source" shape={{ type: 'Feature', geometry: referenceRoute, properties: {} }}>
            <Layer id="live-trajectory-map-reference-layer" style={{ lineColor: '#94a3b8', lineWidth: 3, lineDasharray: [2, 2] }} type="line" />
          </GeoJSONSource>
        )}
        {traveledPoints?.length > 1 && (
          <GeoJSONSource id="live-trajectory-map-traveled-source" shape={traveledGeojson}>
            <Layer id="live-trajectory-map-traveled-layer" style={{ lineColor: '#8cc63e', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}
