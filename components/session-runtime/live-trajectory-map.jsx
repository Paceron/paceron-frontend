import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds, expandBounds } from '../../utils/map-bounds.js';
import { ROUTE_MARKER_META } from '../../utils/route-marker-meta.js';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
// Mismo ancho de banda que RouteMarker en route-map-preview.jsx -- sin esto
// la etiqueta (absolute, no cuenta para el ancho intrínseco del Marker) se
// aplasta contra el ancho del dot (~18px), texto invisible aunque el fondo
// de color sí se vea (bug ya documentado ahí).
const LABEL_BAND_WIDTH = 200;

// Marcador con tooltip por tap -- mismo patrón que RouteMarker en
// route-map-preview.jsx, simplificado (label fijo, sin resolución de
// dirección -- acá no hace falta abrir Google Maps desde el tooltip).
// El dot pasa a tener un ícono adentro (pedido real 2026-10-24) --
// agrandado de 14 a 22px para que el ícono entre legible, mismo color
// de fondo que antes.
function TrajectoryMarker({ point, meta, idPrefix, active, onToggle, labelBelow }) {
  return (
    <Marker anchor="bottom" id={idPrefix} lngLat={point} onPress={onToggle}>
      <View className="items-center" nativeID={idPrefix} style={{ width: LABEL_BAND_WIDTH }} testID={idPrefix}>
        <View
          className="items-center justify-center"
          nativeID={`${idPrefix}-dot`}
          style={{ backgroundColor: meta.color, borderColor: '#ffffff', borderRadius: 11, borderWidth: 2, height: 22, width: 22 }}
          testID={`${idPrefix}-dot`}
        >
          <MaterialCommunityIcons color="#ffffff" name={meta.icon} size={12} />
        </View>
        {active && (
          <View className="absolute left-0 right-0 items-center" nativeID={`${idPrefix}-label-wrap`} style={labelBelow ? { top: 26 } : { bottom: 26 }} testID={`${idPrefix}-label-wrap`}>
            <View className="rounded-md px-2 py-1" nativeID={`${idPrefix}-label`} style={{ backgroundColor: meta.color }} testID={`${idPrefix}-label`}>
              <Text className="text-xs font-semibold text-white" nativeID={`${idPrefix}-label-text`} numberOfLines={1} testID={`${idPrefix}-label-text`}>{meta.label}</Text>
            </View>
          </View>
        )}
      </View>
    </Marker>
  );
}

// Marcador de "acá estoy" -- avatar de solo lectura (sin onPick/onRemove),
// mismo componente que el resto de la app usa para fotos ajenas. Borde
// blanco para distinguirse del fondo del mapa, mismo criterio que los
// dots de inicio/fin.
function CurrentPositionMarker({ point, photoUrl, initials }) {
  return (
    <Marker anchor="center" id="live-trajectory-map-current-position" lngLat={point}>
      <View className="overflow-hidden rounded-full border-2 border-white" nativeID="live-trajectory-map-current-position-ring" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3 }} testID="live-trajectory-map-current-position-ring">
        <AvatarPicker accessibilityLabel="Tu posición actual" fallbackIcon="account" idPrefix="live-trajectory-map-current-position-avatar" initials={initials} size={32} uri={photoUrl} />
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
//
// `currentPosition`/`currentUserPhotoUrl`/`currentUserInitials` (pedido
// real 2026-10-24) -- ícono de "acá estoy" con la foto de perfil del
// usuario, fallback a iniciales. `currentPosition` ya viene SUAVIZADO
// (ver utils/distance.js#smoothGpsPoint) por el caller -- este
// componente no sabe ni le importa de dónde salió el punto, solo lo
// dibuja.
export function LiveTrajectoryMap({ traveledPoints, referenceRoute, currentPosition, currentUserPhotoUrl, currentUserInitials }) {
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
  const currentPositionLngLat = currentPosition ? [currentPosition.longitude, currentPosition.latitude] : null;

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
        {/* minZoom explícito de nuevo -- pedido real 2026-10-21 (3ra vuelta):
            con el pan ya acotado por maxBounds, el zoom-out seguía sin
            límite ("hasta ver el mapa del mundo completo"). A diferencia de
            maplibre-gl en web, que deriva un minZoom efectivo del tamaño de
            maxBounds, el SDK nativo de maplibre-react-native SOLO usa
            maxBounds para limitar el centro de la cámara -- no toca el
            zoom. Sin minZoom propio, no hay ningún límite de zoom-out en
            absoluto. 12, no 10 -- valor cercano al que el maxBounds (mismo
            margen que el de arriba) ya termina clampeando de forma natural
            en la versión web, para que las dos plataformas se sientan
            parecidas. */}
        <Camera initialViewState={{ center: initialCenter, zoom: 14 }} maxBounds={maxBounds} maxZoom={18} minZoom={12} ref={cameraRef} />
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
            idPrefix="live-trajectory-map-start-marker"
            labelBelow={startLabelBelow}
            meta={ROUTE_MARKER_META.start}
            onToggle={() => handleMarkerToggle('start')}
            point={referenceCoords[0]}
          />
        )}
        {referenceCoords.length >= 2 && (
          <TrajectoryMarker
            active={activeMarker === 'end'}
            idPrefix="live-trajectory-map-end-marker"
            labelBelow={endLabelBelow}
            meta={ROUTE_MARKER_META.end}
            onToggle={() => handleMarkerToggle('end')}
            point={referenceCoords[referenceCoords.length - 1]}
          />
        )}
        {currentPositionLngLat && (
          <CurrentPositionMarker initials={currentUserInitials} photoUrl={currentUserPhotoUrl} point={currentPositionLngLat} />
        )}
      </Map>
    </View>
  );
}
