import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
// Ver EMPTY_GEOJSON en route-draw-picker.jsx para el detalle completo del
// issue que esto evita (maplibre/maplibre-react-native#594).
const EMPTY_GEOJSON = { type: 'GeometryCollection', geometries: [] };

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
  // Un tick DESPUÉS de `mapReady` (ver EMPTY_GEOJSON en route-draw-picker.jsx
  // para el issue completo -- maplibre/maplibre-react-native#594: fuente+capa
  // agregados juntos la PRIMERA VEZ con geometría real crashea en Android).
  // A diferencia del picker (los puntos se agregan de a uno con un tap, así
  // que para cuando hay datos reales el source YA existe, montado antes con
  // un shape vacío), acá `points` viene completo desde las props desde el
  // primer render -- si se gatea todo por el mismo `mapReady`, el source
  // nacería YA con datos reales en el mismo tick que el mapa termina de
  // cargar, exactamente el patrón que crashea. Este segundo flag, recién
  // encendido en un useEffect (un render después de que mapReady pasa a
  // true), separa "el source ya existe (vacío)" de "ahora sí tiene datos
  // reales" en dos renders distintos, igual que pasa naturalmente en el
  // picker.
  const [shapeReady, setShapeReady] = useState(false);
  // Aislamiento adicional (2026-10-17, segunda vuelta): con fitBounds ya
  // sacado, el crash siguió pasando exactamente después del render
  // {mapReady:true, shapeReady:true} -- ese commit hace DOS cosas juntas
  // (actualiza el `shape` del source ya existente a datos reales, Y monta
  // los 2 `Marker` por primera vez). Este tercer flag separa esas dos
  // cosas en renders distintos para la próxima prueba: si el crash pasa
  // apenas aparece el render con shapeReady:true pero markersReady:false
  // todavía, es la actualización del `shape`; si llega a verse un render
  // con markersReady:true antes de crashear, es el montaje de los Marker.
  const [markersReady, setMarkersReady] = useState(false);
  const points = coordinates ?? [];
  const lineGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} };
  const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  // Logs de diagnóstico temporales (2026-10-17) -- pedido real: "sumemos
  // todos los logs posibles... para detectar cada accion o escenario".
  // Mismo prefijo `[MAP-DEBUG]` que route-draw-picker.jsx para poder
  // correlacionar ambos componentes en el mismo log de Metro.
  if (__DEV__) {
    console.log('[MAP-DEBUG route-map-preview] render', { mapReady, markersReady, nativeID, pointsLen: points.length, shapeReady });
  }

  useEffect(() => {
    if (mapReady) setShapeReady(true);
  }, [mapReady]);

  useEffect(() => {
    if (shapeReady) setMarkersReady(true);
  }, [shapeReady]);

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
          if (__DEV__) console.log('[MAP-DEBUG route-map-preview] onDidFinishLoadingMap', { t: Date.now() });
          setMapReady(true);
        }}
        onRegionDidChange={(e) => { if (__DEV__) console.log('[MAP-DEBUG route-map-preview] onRegionDidChange (gestos deberían estar deshabilitados acá)', e.nativeEvent); }}
        onRegionWillChange={(e) => { if (__DEV__) console.log('[MAP-DEBUG route-map-preview] onRegionWillChange (gestos deberían estar deshabilitados acá)', e.nativeEvent); }}
        style={{ flex: 1 }}
        testID={`${testID}-map`}
        touchPitch={false}
        touchRotate={false}
        touchZoom={false}
      >
        {/* Fijo, sin fitBounds -- sacado 2026-10-17 para aislar una variable:
            el crash reportado al ver una competencia route (mapReady=true,
            shapeReady=true, justo cuando el source ya existente recibe la
            geometría real y los 2 Marker montan por primera vez) pasó
            siempre inmediatamente después de los eventos onRegionWillChange/
            onRegionDidChange del fitBounds imperativo que se había agregado
            la vuelta anterior (para arreglar el bug real de `padding`
            numérico vs. objeto -- ESO sigue siendo válido si se reintroduce
            fitBounds más adelante). Hipótesis a confirmar: el fitBounds
            corriendo en paralelo con el commit que agrega geometría real +
            nuevos Marker es lo que crashea, no el commit en sí. Sin
            fitBounds, zoom fijo aproximado al que fitBounds elegía
            (~16 para esta ruta de ejemplo) en vez de calculado. */}
        <Camera initialViewState={{ center: initialCenter, zoom: 16 }} />
        {mapReady && (
          <GeoJSONSource id={`${nativeID}-line-source`} shape={shapeReady && points.length > 1 ? lineGeojson : EMPTY_GEOJSON}>
            <Layer id={`${nativeID}-line-layer`} style={{ lineCap: 'round', lineColor: '#8cc63e', lineJoin: 'round', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
        {markersReady && points.length >= 1 && (
          <RouteMarker
            active={activeMarker === 'start'}
            color="#ef4444"
            idPrefix={`${nativeID}-start-marker`}
            label="Punto de inicio"
            onToggle={() => setActiveMarker((v) => (v === 'start' ? null : 'start'))}
            point={points[0]}
          />
        )}
        {markersReady && points.length >= 2 && (
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
