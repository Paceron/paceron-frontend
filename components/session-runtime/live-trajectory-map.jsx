import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds, expandBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
// Mismo ancho de banda que RouteMarker en route-map-preview.jsx -- sin esto
// la etiqueta (absolute, no cuenta para el ancho intrínseco del Marker) se
// aplasta contra el ancho del dot (~18px), texto invisible aunque el fondo
// de color sí se vea (bug ya documentado ahí).
const LABEL_BAND_WIDTH = 200;

// Marcador con tooltip por tap -- mismo patrón que RouteMarker en
// route-map-preview.jsx, simplificado (label fijo, sin resolución de
// dirección -- acá no hace falta abrir Google Maps desde el tooltip).
function TrajectoryMarker({ point, color, label, idPrefix, active, onToggle, labelBelow }) {
  return (
    <Marker anchor="bottom" id={idPrefix} lngLat={point} onPress={onToggle}>
      <View className="items-center" nativeID={idPrefix} style={{ width: LABEL_BAND_WIDTH }} testID={idPrefix}>
        <View nativeID={`${idPrefix}-dot`} style={{ backgroundColor: color, borderColor: '#ffffff', borderRadius: 7, borderWidth: 2, height: 14, width: 14 }} testID={`${idPrefix}-dot`} />
        {active && (
          <View className="absolute left-0 right-0 items-center" nativeID={`${idPrefix}-label-wrap`} style={labelBelow ? { top: 18 } : { bottom: 18 }} testID={`${idPrefix}-label-wrap`}>
            <View className="rounded-md px-2 py-1" nativeID={`${idPrefix}-label`} style={{ backgroundColor: color }} testID={`${idPrefix}-label`}>
              <Text className="text-xs font-semibold text-white" nativeID={`${idPrefix}-label-text`} numberOfLines={1} testID={`${idPrefix}-label-text`}>{label}</Text>
            </View>
          </View>
        )}
      </View>
    </Marker>
  );
}

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
  const [activeMarker, setActiveMarker] = useState(null);
  // Mismo guard que RouteMapPreview -- Marker.onPress no consume el tap
  // para el Map.onPress de abajo (los dos disparan para el mismo toque),
  // así que sin esto el tap-afuera-cierra se come su propio toggle.
  const suppressMapCloseRef = useRef(false);
  const handleMarkerToggle = (id) => {
    suppressMapCloseRef.current = true;
    setActiveMarker((v) => (v === id ? null : id));
  };

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
  // Acota pan/zoom-out a una zona razonable alrededor de la trayectoria --
  // margen mucho más generoso que el de RouteMapPreview (esa es una
  // preview de lectura, bloqueada a propósito a una zona chica). Sin
  // minZoom numérico aparte (ver Camera más abajo) -- el propio tamaño de
  // este rectángulo YA es el único límite de zoom-out, así que tiene que
  // ser él el que se agrande, no un número que compita con él.
  const maxBounds = bounds ? expandBounds(bounds, { marginRatio: 3, minMarginMeters: 3000 }) : undefined;
  const initialCenter = traveledPoints?.[0]
    ? [traveledPoints[0].longitude, traveledPoints[0].latitude]
    : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
  const referenceCoords = referenceRoute?.coordinates ?? [];
  // Mitad norte de los bounds -- mismo criterio que RouteMarker en
  // route-map-preview.jsx para decidir si la etiqueta crece hacia arriba o
  // abajo sin cortarse contra el borde de la preview. bounds es
  // [west, south, east, north].
  const midLat = bounds ? (bounds[1] + bounds[3]) / 2 : null;
  const startLabelBelow = midLat != null && referenceCoords[0] ? referenceCoords[0][1] > midLat : false;
  const endLabelBelow = midLat != null && referenceCoords[referenceCoords.length - 1] ? referenceCoords[referenceCoords.length - 1][1] > midLat : false;

  return (
    <View className="h-full w-full overflow-hidden rounded-2xl border-2 border-gray-200" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <Map
        attribution={false}
        logo={false}
        mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL}
        nativeID="live-trajectory-map"
        onDidFinishLoadingMap={() => {
          // Fit imperativo UNA sola vez al terminar de cargar -- mismo
          // patrón ya probado en RouteMapPreview. Antes `bounds` iba como
          // prop DECLARATIVO de `<Camera>` -- Camera.tsx lo mergea dentro
          // de `...stop`, un objeto nuevo en cada render que se manda tal
          // cual a la capa nativa como comando de cámara; en cualquier
          // re-render (no solo el primero) eso vuelve a disparar un
          // "stop" hacia bounds, y es lo que dejaba el zoom-out efectivo
          // sin límite real en mobile (bug real reportado 2026-10-21) --
          // minZoom/maxBounds quedaban peleando contra un comando de
          // cámara que se repetía solo.
          if (bounds) cameraRef.current?.fitBounds(bounds, { duration: 0, padding: { bottom: 40, left: 40, right: 40, top: 40 } });
        }}
        onPress={() => {
          if (suppressMapCloseRef.current) { suppressMapCloseRef.current = false; return; }
          setActiveMarker(null);
        }}
        style={{ flex: 1 }}
        testID="live-trajectory-map"
      >
        <Camera initialViewState={{ center: initialCenter, zoom: 14 }} maxBounds={maxBounds} maxZoom={18} ref={cameraRef} />
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
          <TrajectoryMarker
            active={activeMarker === 'start'}
            color="#ef4444"
            idPrefix="live-trajectory-map-start-marker"
            label="Punto de inicio"
            labelBelow={startLabelBelow}
            onToggle={() => handleMarkerToggle('start')}
            point={referenceCoords[0]}
          />
        )}
        {referenceCoords.length >= 2 && (
          <TrajectoryMarker
            active={activeMarker === 'end'}
            color="#2563eb"
            idPrefix="live-trajectory-map-end-marker"
            label="Punto de llegada"
            labelBelow={endLabelBelow}
            onToggle={() => handleMarkerToggle('end')}
            point={referenceCoords[referenceCoords.length - 1]}
          />
        )}
      </Map>
    </View>
  );
}
