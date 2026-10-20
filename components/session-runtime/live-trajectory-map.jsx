import { useRef } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Mapa real con la trayectoria recorrida (y opcionalmente una ruta de
// referencia marcada) -- diseñado genérico a propósito (Spec 4c): esta
// spec solo lo usa para intentos de competencia de ruta, pero no le
// hardcodea nada de ese dominio (el caller decide si pasa `referenceRoute`
// o no). Pensado para reusarse en la mejora futura de "trayectoria de toda
// la sesión" (sin ruta de referencia, solo lo recorrido).
//
// `data` (no `shape`) en GeoJSONSource y `padding` como objeto (no número)
// en Camera -- ver CLAUDE.md, sección maplibre-react-native, para el crash
// nativo real que motivó encontrar estos dos bugs en route-map-preview.jsx
// (mismo componente de librería).
//
// Llena su contenedor (`h-full w-full`, el `Map` con `flex: 1`) en vez de
// forzar una altura fija -- bug real 2026-10-19: el caller decide cuánto
// espacio darle (antes 256px fijos, pensados para convivir con un
// cronómetro gigante que ya no existe en los callers reales de hoy).
// Estilo "limpio" (OPENFREEMAP_MINIMAL_STYLE_URL, no el estándar) para que
// coincida con route-map-preview.jsx/route-draw-picker.jsx -- antes usaba
// el estilo con más detalle visual, pedido real: "el estilo del mapa debe
// ser limpio como los demás casos". Markers de inicio/fin de
// `referenceRoute` (dot simple, sin tooltip -- esto es una vista en vivo o
// un resumen estático, no necesita tap-to-toggle) -- antes no tenía
// ninguno, bug real reportado.
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
  const referenceCoords = referenceRoute?.coordinates ?? [];

  return (
    <View className="h-full w-full overflow-hidden rounded-2xl" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <Map mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL} nativeID="live-trajectory-map" style={{ flex: 1 }} testID="live-trajectory-map">
        <Camera bounds={bounds ?? undefined} initialViewState={{ center: initialCenter, zoom: 14 }} padding={{ bottom: 40, left: 40, right: 40, top: 40 }} ref={cameraRef} />
        {referenceCoords.length > 1 && (
          <GeoJSONSource data={{ type: 'Feature', geometry: referenceRoute, properties: {} }} id="live-trajectory-map-reference-source">
            <Layer id="live-trajectory-map-reference-layer" style={{ lineColor: '#94a3b8', lineWidth: 3, lineDasharray: [2, 2] }} type="line" />
          </GeoJSONSource>
        )}
        {traveledPoints?.length > 1 && (
          <GeoJSONSource data={traveledGeojson} id="live-trajectory-map-traveled-source">
            <Layer id="live-trajectory-map-traveled-layer" style={{ lineColor: '#8cc63e', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
        {referenceCoords.length >= 1 && (
          <Marker anchor="bottom" id="live-trajectory-map-start-marker" lngLat={referenceCoords[0]}>
            <View nativeID="live-trajectory-map-start-dot" style={{ backgroundColor: '#ef4444', borderColor: '#ffffff', borderRadius: 7, borderWidth: 2, height: 14, width: 14 }} testID="live-trajectory-map-start-dot" />
          </Marker>
        )}
        {referenceCoords.length >= 2 && (
          <Marker anchor="bottom" id="live-trajectory-map-end-marker" lngLat={referenceCoords[referenceCoords.length - 1]}>
            <View nativeID="live-trajectory-map-end-dot" style={{ backgroundColor: '#2563eb', borderColor: '#ffffff', borderRadius: 7, borderWidth: 2, height: 14, width: 14 }} testID="live-trajectory-map-end-dot" />
          </Marker>
        )}
      </Map>
    </View>
  );
}
