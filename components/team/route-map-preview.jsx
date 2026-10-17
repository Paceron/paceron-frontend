import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
// Ver EMPTY_GEOJSON en route-draw-picker.jsx para el detalle completo del
// issue que esto evita (maplibre/maplibre-react-native#594).
const EMPTY_GEOJSON = { type: 'GeometryCollection', geometries: [] };

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
// false), no `pointerEvents="none"`.
//
// Inicio/llegada: círculos vía GeoJSONSource+Layer (circleColor), NO el
// componente `Marker` -- BUG REAL encontrado 2026-10-17 (tercera vuelta de
// aislamiento, confirmado DOS VECES incluyendo tras un rebuild nativo
// completo): montar `Marker` por primera vez crashea en Android
// (NullPointerException, mismo síntoma externo que el bug de
// GeoJSONSource de más abajo, pero DISTINTA causa -- aislado con un flag
// extra que separaba la actualización de `shape` del source de línea
// -ESA pasó bien, logueada sin crash- del montaje de los Marker -ahí
// crasheaba siempre-). Sin fix encontrado para `Marker` en sí; se
// reemplaza por el mismo patrón círculo-por-Layer que ya usa
// route-draw-picker.jsx para sus propios punto de inicio/llegada (ese
// SÍ anduvo bien). Se pierde a propósito, por ahora, el tap-para-ver-
// etiqueta que tenía el `Marker` -- pendiente para una rama futura
// (reintentar `Marker` en otra versión de la librería, o armar la
// etiqueta como overlay posicionado a mano).
export function RouteMapPreview({ coordinates, nativeID, testID }) {
  // Mismo fix que route-draw-picker.jsx -- crash real confirmado
  // (NullPointerException en MLRNSource.addToMap -> getStyle() null) al
  // agregar un GeoJSONSource antes de que el estilo nativo del mapa
  // termine de cargar.
  const [mapReady, setMapReady] = useState(false);
  // Un tick DESPUÉS de `mapReady` (maplibre/maplibre-react-native#594:
  // fuente+capa agregados juntos la PRIMERA VEZ con geometría real
  // crashea en Android). A diferencia del picker (los puntos se agregan
  // de a uno con un tap, así que para cuando hay datos reales el source
  // YA existe, montado antes con un shape vacío), acá `points` viene
  // completo desde las props desde el primer render -- este flag, recién
  // encendido en un useEffect (un render después de que mapReady pasa a
  // true), separa "el source ya existe (vacío)" de "ahora sí tiene datos
  // reales" en dos renders distintos, igual que pasa naturalmente en el
  // picker. Confirmado con logs: este paso NO crashea.
  const [shapeReady, setShapeReady] = useState(false);
  const points = coordinates ?? [];
  const lineGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} };
  const startGeojson = points.length >= 1 ? { type: 'Feature', geometry: { type: 'Point', coordinates: points[0] }, properties: {} } : EMPTY_GEOJSON;
  const endGeojson = points.length >= 2 ? { type: 'Feature', geometry: { type: 'Point', coordinates: points[points.length - 1] }, properties: {} } : EMPTY_GEOJSON;
  const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  // Logs de diagnóstico temporales (2026-10-17) -- pedido real: "sumemos
  // todos los logs posibles... para detectar cada accion o escenario".
  // Mismo prefijo `[MAP-DEBUG]` que route-draw-picker.jsx para poder
  // correlacionar ambos componentes en el mismo log de Metro.
  if (__DEV__) {
    console.log('[MAP-DEBUG route-map-preview] render', { mapReady, nativeID, pointsLen: points.length, shapeReady });
  }

  useEffect(() => {
    if (mapReady) setShapeReady(true);
  }, [mapReady]);

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
        {/* Zoom fijo, sin fitBounds -- sacado 2026-10-17 al aislar el crash
            de los Marker (no era el fitBounds, pero ya no hace falta
            reintroducirlo para esta previsualización chica). */}
        <Camera initialViewState={{ center: initialCenter, zoom: 16 }} />
        {mapReady && (
          <GeoJSONSource id={`${nativeID}-line-source`} shape={shapeReady && points.length > 1 ? lineGeojson : EMPTY_GEOJSON}>
            <Layer id={`${nativeID}-line-layer`} style={{ lineCap: 'round', lineColor: '#8cc63e', lineJoin: 'round', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
        {mapReady && (
          <GeoJSONSource id={`${nativeID}-start-source`} shape={shapeReady ? startGeojson : EMPTY_GEOJSON}>
            <Layer id={`${nativeID}-start-layer`} style={{ circleColor: '#ef4444', circleRadius: 6, circleStrokeColor: '#ffffff', circleStrokeWidth: 2 }} type="circle" />
          </GeoJSONSource>
        )}
        {mapReady && (
          <GeoJSONSource id={`${nativeID}-end-source`} shape={shapeReady ? endGeojson : EMPTY_GEOJSON}>
            <Layer id={`${nativeID}-end-layer`} style={{ circleColor: '#2563eb', circleRadius: 6, circleStrokeColor: '#ffffff', circleStrokeWidth: 2 }} type="circle" />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}
