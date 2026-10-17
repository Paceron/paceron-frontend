import { useEffect, useRef, useState } from 'react';
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
  const cameraRef = useRef(null);
  // Mismo fix que route-draw-picker.jsx -- crash real confirmado
  // (NullPointerException en MLRNSource.addToMap -> getStyle() null) al
  // agregar un GeoJSONSource antes de que el estilo nativo del mapa
  // termine de cargar. BUG REAL encontrado 2026-10-17 (segunda vuelta):
  // el gate `mapReady` solo envolvía el GeoJSONSource de la línea -- los
  // DOS `Marker` de abajo (inicio/llegada) quedaron sin gatear, y en esta
  // pantalla (a diferencia de route-draw-picker, donde los puntos se
  // agregan de a uno con un tap) `points` ya tiene todos sus elementos
  // desde el primer render -- los Marker intentaban montarse ANTES de
  // que el mapa termine de cargar, siempre, en cualquier competencia por
  // trayectoria ya registrada. Esto explica el crash reportado al entrar
  // a la pestaña de Competencias como corredor viendo una de route.
  const [mapReady, setMapReady] = useState(false);
  const points = coordinates ?? [];
  const lineGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} };
  const bounds = computeBounds(points.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
  const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  // Logs de diagnóstico temporales (2026-10-17) -- pedido real: "sumemos
  // todos los logs posibles... para detectar cada accion o escenario".
  // Mismo prefijo `[MAP-DEBUG]` que route-draw-picker.jsx para poder
  // correlacionar ambos componentes en el mismo log de Metro.
  if (__DEV__) {
    console.log('[MAP-DEBUG route-map-preview] render', { nativeID, pointsLen: points.length, mapReady });
  }

  useEffect(() => {
    if (__DEV__) console.log('[MAP-DEBUG route-map-preview] line-source should render?', mapReady && points.length > 1);
  }, [mapReady, points.length]);
  useEffect(() => {
    if (__DEV__) console.log('[MAP-DEBUG route-map-preview] start-marker should render?', mapReady && points.length >= 1);
  }, [mapReady, points.length]);
  useEffect(() => {
    if (__DEV__) console.log('[MAP-DEBUG route-map-preview] end-marker should render?', mapReady && points.length >= 2);
  }, [mapReady, points.length]);

  return (
    <View className="h-full w-full overflow-hidden rounded-xl" nativeID={nativeID} testID={testID}>
      <Map
        doubleTapHoldZoom={false}
        doubleTapZoom={false}
        dragPan={false}
        mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL}
        nativeID={`${nativeID}-map`}
        onDidFailLoadingMap={() => { if (__DEV__) console.log('[MAP-DEBUG route-map-preview] onDidFailLoadingMap'); }}
        onDidFinishLoadingMap={() => {
          if (__DEV__) console.log('[MAP-DEBUG route-map-preview] onDidFinishLoadingMap', { bounds, t: Date.now() });
          setMapReady(true);
          // Imperativo (fitBounds vía ref), no declarativo (prop `bounds`
          // en Camera) -- BUG REAL encontrado 2026-10-17: `padding` se
          // pasaba como número crudo (24) pero el tipo real de la lib
          // (`ViewPadding`) es un objeto `{top,right,bottom,left}` --
          // mismatch de tipo contra el codegen nativo de Fabric, candidato
          // fuerte para el crash silencioso (sin ningún log de JS, ~2s
          // después de montar) reportado al ver una competencia de route
          // ya registrada. Mismo patrón ya probado y funcionando en
          // trainer-session-live-screen.jsx -- ESE componente evita el
          // prop `bounds` declarativo por completo (ver su comentario
          // sobre la firma real de `fitBounds`) y usa el ref imperativo,
          // llamado recién cuando hay mapa.
          if (bounds) cameraRef.current?.fitBounds(bounds, { duration: 0, padding: { bottom: 24, left: 24, right: 24, top: 24 } });
        }}
        onRegionDidChange={(e) => { if (__DEV__) console.log('[MAP-DEBUG route-map-preview] onRegionDidChange (gestos deberían estar deshabilitados acá)', e); }}
        onRegionWillChange={(e) => { if (__DEV__) console.log('[MAP-DEBUG route-map-preview] onRegionWillChange (gestos deberían estar deshabilitados acá)', e); }}
        style={{ flex: 1 }}
        testID={`${testID}-map`}
        touchPitch={false}
        touchRotate={false}
        touchZoom={false}
      >
        <Camera initialViewState={{ center: initialCenter, zoom: 13 }} ref={cameraRef} />
        {mapReady && points.length > 1 && (
          <GeoJSONSource id={`${nativeID}-line-source`} shape={lineGeojson}>
            <Layer id={`${nativeID}-line-layer`} style={{ lineCap: 'round', lineColor: '#8cc63e', lineJoin: 'round', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
        {mapReady && points.length >= 1 && (
          <RouteMarker
            active={activeMarker === 'start'}
            color="#ef4444"
            idPrefix={`${nativeID}-start-marker`}
            label="Punto de inicio"
            onToggle={() => setActiveMarker((v) => (v === 'start' ? null : 'start'))}
            point={points[0]}
          />
        )}
        {mapReady && points.length >= 2 && (
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
