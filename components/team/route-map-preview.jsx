import { useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Marcador de inicio/llegada -- `anchor="bottom"` (mismo patrón que el pin
// de location-picker.jsx) deja el puntito SIEMPRE pegado a la coordenada
// real sin importar si la etiqueta de arriba está mostrándose o no (la
// etiqueta crece hacia arriba, no desplaza el punto). En mobile la
// etiqueta aparece/desaparece con un tap sobre el marcador -- pedido real,
// 2026-10-17 -- a diferencia de la versión web (hover, ver .web.jsx).
function RouteMarker({ point, color, label, idPrefix, active, onToggle }) {
  return (
    <Marker anchor="bottom" id={idPrefix} lngLat={point} onPress={onToggle}>
      <View className="items-center" nativeID={idPrefix} testID={idPrefix}>
        {active && (
          <View className="mb-1 rounded-md px-2 py-1" nativeID={`${idPrefix}-label`} style={{ backgroundColor: color }} testID={`${idPrefix}-label`}>
            <Text className="text-xs font-semibold text-white" nativeID={`${idPrefix}-label-text`} numberOfLines={1} testID={`${idPrefix}-label-text`}>
              {label}
            </Text>
          </View>
        )}
        <View nativeID={`${idPrefix}-dot`} style={{ backgroundColor: color, borderColor: '#ffffff', borderRadius: 7, borderWidth: 2, height: 14, width: 14 }} testID={`${idPrefix}-dot`} />
      </View>
    </Marker>
  );
}

// Mapa real (no SVG) con el trazado de una competencia type='route' --
// pedido real, 2026-10-17: "la silueta debe dibujarse sobre un mapa real...
// como el que se usa en la vista del entrenador en las sesiones
// presenciales en vivo" (trainer-session-live-screen.jsx -- de ahí
// OPENFREEMAP_MINIMAL_STYLE_URL, "sin contenido distractivo"). Reemplaza
// a RouteThumbnail (SVG a mano, eliminado) ahora que esto se muestra
// siempre, no en una lista masiva de filas.
//
// Bloqueado -- es una previsualización de lectura, no un mapa para
// explorar (el dibujo real sigue pasando por RouteDrawPicker). El bloqueo
// es por los props de gestos del propio `Map` (dragPan/touchZoom/etc en
// false), NO `pointerEvents="none"` -- eso bloquearía también los
// Marker de abajo, que necesitan su propio onPress para el tap-to-toggle.
export function RouteMapPreview({ coordinates, nativeID, testID }) {
  const [activeMarker, setActiveMarker] = useState(null);
  // Mismo fix que route-draw-picker.jsx -- crash real confirmado
  // (NullPointerException en MLRNSource.addToMap -> getStyle() null) al
  // agregar un GeoJSONSource antes de que el estilo nativo del mapa
  // termine de cargar.
  const [mapReady, setMapReady] = useState(false);
  const points = coordinates ?? [];
  const lineGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} };
  const bounds = computeBounds(points.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
  const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  return (
    <View className="h-full w-full overflow-hidden rounded-xl" nativeID={nativeID} testID={testID}>
      <Map
        doubleTapHoldZoom={false}
        doubleTapZoom={false}
        dragPan={false}
        mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL}
        nativeID={`${nativeID}-map`}
        onDidFinishLoadingMap={() => setMapReady(true)}
        style={{ flex: 1 }}
        testID={`${testID}-map`}
        touchPitch={false}
        touchRotate={false}
        touchZoom={false}
      >
        <Camera bounds={bounds ?? undefined} initialViewState={{ center: initialCenter, zoom: 13 }} padding={24} />
        {mapReady && points.length > 1 && (
          <GeoJSONSource id={`${nativeID}-line-source`} shape={lineGeojson}>
            <Layer id={`${nativeID}-line-layer`} style={{ lineCap: 'round', lineColor: '#8cc63e', lineJoin: 'round', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
        {points.length >= 1 && (
          <RouteMarker
            active={activeMarker === 'start'}
            color="#ef4444"
            idPrefix={`${nativeID}-start-marker`}
            label="Punto de inicio"
            onToggle={() => setActiveMarker((v) => (v === 'start' ? null : 'start'))}
            point={points[0]}
          />
        )}
        {points.length >= 2 && (
          <RouteMarker
            active={activeMarker === 'end'}
            color="#2563eb"
            idPrefix={`${nativeID}-end-marker`}
            label="Punto de llegada"
            onToggle={() => setActiveMarker((v) => (v === 'end' ? null : 'end'))}
            point={points[points.length - 1]}
          />
        )}
      </Map>
    </View>
  );
}
