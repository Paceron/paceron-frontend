import { useState } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

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
// Inicio/llegada: círculos vía GeoJSONSource+Layer (circleColor), no el
// componente `Marker` -- se probó Marker y crasheaba igual que el bug de
// abajo (causa distinta, nunca resuelta; ver CLAUDE.md), así que se
// descartó. Se pierde el tap-para-ver-etiqueta que tenía -- pendiente.
//
// CAUSA REAL del crash nativo (Android, NullPointerException en
// MLRNGeoJSONSource.makeSource -> uri!!) que motivó una investigación larga
// (ver CLAUDE.md, sección maplibre-react-native): el prop para pasarle la
// geometría a `GeoJSONSource` en esta versión de la librería es `data`, NO
// `shape` -- confirmado leyendo node_modules/@maplibre/maplibre-react-native
// (GeoJSONSourceProps.data, sin ningún `shape`) y el stack trace real de
// logcat. `shape` se ignoraba en silencio (prop desconocido), el campo
// nativo `geoJson` quedaba siempre null, y al montar el source caía al
// fallback `uri!!` (tampoco seteado) -- de ahí el NPE, SIEMPRE, sin
// importar timing de carga del mapa, cantidad de sources simultáneos, ni
// si el shape era vacío o real (todo eso resultó irrelevante: ninguna
// versión del dato llegaba nunca al nativo). Con `data` corregido no hace
// falta ningún placeholder vacío ni escalonar el montaje -- el gate
// `mapReady` alcanza (evita llamar a getStyle() antes de que el mapa
// exista).
export function RouteMapPreview({ coordinates, nativeID, testID }) {
  const [mapReady, setMapReady] = useState(false);
  const points = coordinates ?? [];
  const lineGeojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} };
  const startGeojson = { type: 'Feature', geometry: { type: 'Point', coordinates: points[0] }, properties: {} };
  const endGeojson = { type: 'Feature', geometry: { type: 'Point', coordinates: points[points.length - 1] }, properties: {} };
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
        {/* Zoom fijo -- previsualización chica, no hace falta fitBounds. */}
        <Camera initialViewState={{ center: initialCenter, zoom: 16 }} />
        {mapReady && points.length > 1 && (
          <GeoJSONSource data={lineGeojson} id={`${nativeID}-line-source`}>
            <Layer id={`${nativeID}-line-layer`} style={{ lineCap: 'round', lineColor: '#8cc63e', lineJoin: 'round', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
        {mapReady && points.length >= 1 && (
          <GeoJSONSource data={startGeojson} id={`${nativeID}-start-source`}>
            <Layer id={`${nativeID}-start-layer`} style={{ circleColor: '#ef4444', circleRadius: 6, circleStrokeColor: '#ffffff', circleStrokeWidth: 2 }} type="circle" />
          </GeoJSONSource>
        )}
        {mapReady && points.length >= 2 && (
          <GeoJSONSource data={endGeojson} id={`${nativeID}-end-source`}>
            <Layer id={`${nativeID}-end-layer`} style={{ circleColor: '#2563eb', circleRadius: 6, circleStrokeColor: '#ffffff', circleStrokeWidth: 2 }} type="circle" />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}
