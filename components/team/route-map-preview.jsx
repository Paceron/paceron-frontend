import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
// Placeholder para cuando el GeoJSONSource de la línea (siempre montado,
// nunca condicionado por points.length -- ver el comentario largo en
// route-draw-picker.jsx sobre el crash real de "`id` cannot be changed")
// todavía no tiene dato real que mostrar. Los puntos de inicio/llegada van
// por `Marker` (no GeoJSONSource), que sí se monta/desmonta condicional
// sin el mismo riesgo -- es el único de los dos sources en este árbol, no
// tiene un sibling con el que desalinearse.
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

// Marcador de inicio/llegada -- `anchor="bottom"` (mismo patrón que el pin
// de location-picker.jsx) deja el puntito SIEMPRE pegado a la coordenada
// real sin importar si la etiqueta de arriba está mostrándose o no (la
// etiqueta crece hacia arriba, no desplaza el punto). En mobile la
// etiqueta aparece/desaparece con un tap sobre el marcador -- pedido real,
// 2026-10-17 -- a diferencia de la versión web (hover, ver .web.jsx).
//
// Se había reemplazado por círculos vía GeoJSONSource+Layer durante la
// investigación del crash (ver CLAUDE.md), sospechando de `Marker`
// específicamente -- pero esa sospecha quedó CONFUNDIDA: el bug real
// (`GeoJSONSource` necesita `data`, no `shape`) seguía activo en el
// source de la línea durante esa misma prueba, así que cualquier cosa
// que tocara el mapa iba a crashear igual, con o sin `Marker` -- nunca
// hubo evidencia real contra `Marker` en sí. Restaurado.
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
// false), no `pointerEvents="none"` -- eso bloquearía también los
// Marker de arriba, que necesitan su propio onPress para el tap-to-toggle.
//
// CAUSA REAL del crash nativo (Android, NullPointerException en
// MLRNGeoJSONSource.makeSource -> uri!!) que motivó una investigación larga
// (ver CLAUDE.md, sección maplibre-react-native): el prop para pasarle la
// geometría a `GeoJSONSource` en esta versión de la librería es `data`, NO
// `shape`.
export function RouteMapPreview({ coordinates, nativeID, testID }) {
  const [activeMarker, setActiveMarker] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const cameraRef = useRef(null);
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
        logo={false}
        mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL}
        nativeID={`${nativeID}-map`}
        onDidFinishLoadingMap={() => {
          setMapReady(true);
          // Imperativo (fitBounds vía ref), no declarativo -- la Camera
          // acepta `bounds`+`padding` como prop, pero `padding` tiene que
          // ser un objeto {top,right,bottom,left}, no un número (otro bug
          // real, mismo diagnóstico que el de `shape`/`data`, ver
          // CLAUDE.md). Mismo patrón que trainer-session-live-screen.jsx.
          if (bounds) cameraRef.current?.fitBounds(bounds, { duration: 0, padding: { bottom: 24, left: 24, right: 24, top: 24 } });
        }}
        style={{ flex: 1 }}
        testID={`${testID}-map`}
        touchPitch={false}
        touchRotate={false}
        touchZoom={false}
      >
        <Camera initialViewState={{ center: initialCenter, zoom: 16 }} ref={cameraRef} />
        {mapReady && (
          <GeoJSONSource data={points.length > 1 ? lineGeojson : EMPTY_LINE} id={`${nativeID}-line-source`}>
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
