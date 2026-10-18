import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useRouteDrawPicker } from '../../hooks/use-route-draw-picker.js';
import { useUser } from '../../hooks/use-user.js';
import { useAuthStore } from '../../store/auth-store.js';
import { formatMeters } from '../../utils/distance.js';
import { buildRadiusHaloWidthExpression } from '../../utils/map-radius-expression.js';
import { FIELD_LABEL } from '../forms/fields.jsx';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
// Mismos nombres/criterio que route-draw-picker.web.jsx -- placeholder para
// cuando un GeoJSONSource (siempre montado, ver más abajo) todavía no tiene
// dato real que mostrar.
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };
const EMPTY_POINT = { type: 'Feature', geometry: { type: 'Point', coordinates: [] }, properties: {} };

// Dibujo de ruta por tap (Spec 4c, type='route') -- cada tap sobre el mapa
// agrega un vértice; la polilínea se redibuja en vivo vía GeoJSONSource. Sin
// drag-to-pan deshabilitado (a diferencia de LocationPicker, acá SÍ hace
// falta poder desplazar el mapa para dibujar una ruta larga).
//
// `acceptanceRadiusMeters` (pedido real, 2026-10-16) solo se usa acá para
// dibujar el halo -- el campo real sigue viviendo en create-competition-
// modal.jsx, este componente no lo posee.
//
// CAUSA REAL de un crash nativo largo de investigar (ver CLAUDE.md, sección
// maplibre-react-native): `GeoJSONSource` necesita el prop `data`, no
// `shape` -- `shape` no existe en esta versión de la librería, se ignoraba
// en silencio y el campo nativo quedaba siempre null, cayendo a un
// fallback (`uri!!`) que explotaba con NullPointerException. `mapReady`
// (abajo) sigue siendo necesario -- evita llamar a getStyle() antes de que
// el mapa exista.
export function RouteDrawPicker({ value, onChange, acceptanceRadiusMeters }) {
  const colors = useThemeColors();
  const picker = useRouteDrawPicker({ value, onChange });
  const cameraRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const currentUserId = useAuthStore((s) => s.userId);
  const { user } = useUser(currentUserId);

  // Centro por defecto: GPS real -> dirección del perfil -> Buenos Aires
  // (pedido real, 2026-10-17: "en todas las plataformas"). Silencioso
  // (`silent: true`) -- un intento automático al abrir el picker no debe
  // mostrar el spinner del botón ni un mensaje de error si el permiso
  // está denegado; el botón "mi ubicación" sigue sirviendo para pedirlo
  // explícito. Solo corre si todavía no hay una ruta cargada (editar una
  // ya confirmada no debería mover la cámara del usuario).
  useEffect(() => {
    if (picker.points.length > 0) return;
    let cancelled = false;
    (async () => {
      const gps = await picker.locateMe({ silent: true });
      if (cancelled) return;
      if (gps) {
        cameraRef.current?.flyTo({ center: [gps.lng, gps.lat], zoom: 15, duration: 600 });
        return;
      }
      if (user?.lat != null && user?.lng != null) {
        cameraRef.current?.flyTo({ center: [user.lng, user.lat], zoom: 13, duration: 600 });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapPress = (event) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    picker.addPoint(lat, lng);
  };

  const handleLocateMe = async () => {
    const coords = await picker.locateMe();
    if (coords) cameraRef.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 600 });
  };

  const lineGeojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: picker.points.map((p) => [p.lng, p.lat]) },
    properties: {},
  };

  const initialCenter = picker.points[0]
    ? [picker.points[0].lng, picker.points[0].lat]
    : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  // Halo visual del radio de aceptación -- pedido real: "sombreado o halo
  // alrededor de la trayectoria... mismo tono... traslúcido". Línea ancha
  // detrás de la línea principal (declarada antes en el JSX = se pinta
  // debajo), con el ancho en px calculado para aproximar el radio real en
  // metros (ver utils/map-radius-expression.js).
  const radiusMeters = Number(acceptanceRadiusMeters);
  const showHalo = picker.points.length > 1 && Number.isFinite(radiusMeters) && radiusMeters > 0;
  const centerLat = showHalo ? picker.points.reduce((sum, p) => sum + p.lat, 0) / picker.points.length : 0;

  return (
    <View className="gap-1.5" nativeID="route-draw-picker-root" testID="route-draw-picker-root">
      <Text className={FIELD_LABEL} nativeID="route-draw-picker-label" testID="route-draw-picker-label">Trazado de la ruta</Text>

      {/* Envoltura mínima (pedido real: "no es necesario padding, margin...
          solo una minima separacion para encapsular todo visualmente") --
          agrupa mapa+meta+acciones bajo el label de arriba, sin robar
          espacio. */}
      <View className="gap-2 rounded-xl border border-slate-100 p-1.5 dark:border-slate-800" nativeID="route-draw-picker-section" testID="route-draw-picker-section">
        <View
          className={`h-72 overflow-hidden rounded-xl border dark:border-slate-700 ${picker.confirmed ? 'border-2 border-primary' : 'border-slate-200'}`}
          nativeID="route-draw-picker-map-wrapper"
          testID="route-draw-picker-map-wrapper"
        >
          <Map
            mapStyle={OPENFREEMAP_STYLE_URL}
            nativeID="route-draw-picker-map"
            onDidFinishLoadingMap={() => setMapReady(true)}
            onPress={handleMapPress}
            // Logs de diagnóstico temporales (2026-10-18) -- pedido real:
            // tap para plantar puntos anda bien, pero pan/pinch-zoom no
            // responden dentro del modal. Si `onRegionIsChanging` NUNCA
            // aparece al deslizar/pellizcar, el gesto no está llegando a
            // MapLibre -- compararlo contra `onPress`, que si llega.
            onRegionDidChange={(e) => { if (__DEV__) console.log('[MAP-DEBUG draw-picker] onRegionDidChange (fin de pan/pinch)', e.nativeEvent); }}
            onRegionIsChanging={(e) => { if (__DEV__) console.log('[MAP-DEBUG draw-picker] onRegionIsChanging (pan/pinch en curso)', e.nativeEvent); }}
            onRegionWillChange={(e) => { if (__DEV__) console.log('[MAP-DEBUG draw-picker] onRegionWillChange (arranca pan/pinch)', e.nativeEvent); }}
            style={{ flex: 1 }}
            testID="route-draw-picker-map"
          >
            <Camera initialViewState={{ center: initialCenter, zoom: 13 }} ref={cameraRef} />
            {/* Los 3 GeoJSONSource (y el halo-Layer de adentro del primero)
                se montan UNA SOLA VEZ, gateados solo por `mapReady` -- NUNCA
                condicionados por points.length/confirmed/showHalo, eso
                causaba un crash real distinto del de `shape` vs `data` (ver
                CLAUDE.md): sacar un sibling del MEDIO (ej. el halo, o el
                line-source al deshacer de 2 puntos a 1) desplaza el índice
                nativo del resto, y la librería reclama "`id` cannot be
                changed" al intentar reasignarle el id equivocado al vecino
                que quedó corrido. Reproducido real: crasheaba al vaciar el
                campo de radio de aceptación (showHalo pasa a false, el halo
                Layer se desmontaba). Mientras tanto el `data`/`lineOpacity`
                sí cambian en vivo sin problema -- eso es una actualización
                de props sobre un source/layer que ya existe, no un
                mount/unmount. */}
            {mapReady && (
              <GeoJSONSource data={picker.points.length > 1 ? lineGeojson : EMPTY_LINE} id="route-draw-picker-line-source">
                <Layer
                  id="route-draw-picker-halo-layer"
                  // `lineCap`/`lineJoin: 'round'` -- pedido real: "controlemos
                  // que no se intensifique por superposicion". El join
                  // redondeado reduce el solape EN LOS VÉRTICES (giros
                  // filosos), pero no es la causa completa -- confirmado
                  // 2026-10-17 que con mucho zigzag siguen apareciendo zonas
                  // más intensas donde dos TRAMOS no adyacentes del trazado
                  // quedan geométricamente cerca (no solo en un vértice
                  // compartido). Eliminar eso del todo necesitaría un
                  // polígono de buffer real (offset de cada lado de la
                  // línea + unión de los segmentos en una sola forma
                  // rellena, sin stacking de opacidad) -- MapLibre no lo
                  // da gratis vía style spec, haría falta calcular la
                  // geometría a mano. Fuera de alcance por ahora (el
                  // usuario lo marcó como "no grave"); esto es una mitigación
                  // parcial, no la solución estructural.
                  style={{ lineCap: 'round', lineColor: '#8cc63e', lineJoin: 'round', lineOpacity: showHalo ? 0.35 : 0, lineWidth: buildRadiusHaloWidthExpression(radiusMeters, centerLat) }}
                  type="line"
                />
                <Layer
                  id="route-draw-picker-line-layer"
                  // Verde oscuro cuando está confirmada (pedido real,
                  // 2026-10-17) -- antes el único indicador era el borde del
                  // contenedor, pedido explícito de sumar color a la propia
                  // línea.
                  style={{ lineCap: 'round', lineColor: picker.confirmed ? '#166534' : '#8cc63e', lineJoin: 'round', lineWidth: 4 }}
                  type="line"
                />
              </GeoJSONSource>
            )}
            {/* Punto de inicio (rojo) -- pedido real, 2026-10-17: visible
                apenas hay un punto marcado, mientras se dibuja. Punto de
                llegada (azul) SOLO tras confirmar -- mientras se dibuja
                "el último punto" todavía no es definitivo, puede seguir
                agregando. */}
            {mapReady && (
              <GeoJSONSource data={picker.points.length >= 1 ? { type: 'Feature', geometry: { type: 'Point', coordinates: [picker.points[0].lng, picker.points[0].lat] }, properties: {} } : EMPTY_POINT} id="route-draw-picker-start-source">
                <Layer id="route-draw-picker-start-layer" style={{ circleColor: '#ef4444', circleRadius: 6, circleStrokeColor: '#ffffff', circleStrokeWidth: 2 }} type="circle" />
              </GeoJSONSource>
            )}
            {mapReady && (
              <GeoJSONSource data={picker.confirmed && picker.points.length >= 2 ? { type: 'Feature', geometry: { type: 'Point', coordinates: [picker.points[picker.points.length - 1].lng, picker.points[picker.points.length - 1].lat] }, properties: {} } : EMPTY_POINT} id="route-draw-picker-end-source">
                <Layer id="route-draw-picker-end-layer" style={{ circleColor: '#2563eb', circleRadius: 6, circleStrokeColor: '#ffffff', circleStrokeWidth: 2 }} type="circle" />
              </GeoJSONSource>
            )}
          </Map>

          <Pressable
            className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
            disabled={picker.locating}
            nativeID="route-draw-picker-locate-button"
            onPress={handleLocateMe}
            testID="route-draw-picker-locate-button"
          >
            {picker.locating
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />}
          </Pressable>

          {picker.confirmed && (
            <View className="absolute left-3 top-3 flex-row items-center gap-1 rounded-full bg-primary px-2.5 py-1" nativeID="route-draw-picker-confirmed-badge" testID="route-draw-picker-confirmed-badge">
              <MaterialCommunityIcons color="#111518" name="check" size={14} />
              <Text className="text-xs font-semibold text-[#111518]" nativeID="route-draw-picker-confirmed-badge-label" testID="route-draw-picker-confirmed-badge-label">Ruta confirmada</Text>
            </View>
          )}
        </View>

        {picker.locateError && (
          <Text className="text-xs text-red-500 dark:text-red-400" nativeID="route-draw-picker-locate-error" testID="route-draw-picker-locate-error">
            {picker.locateError}
          </Text>
        )}

        <View className="flex-row items-center justify-between" nativeID="route-draw-picker-meta" testID="route-draw-picker-meta">
          <Text
            className={`text-xs font-semibold ${picker.limitStatus.exceedsLength || picker.limitStatus.exceedsVertices ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
            nativeID="route-draw-picker-meta-label"
            testID="route-draw-picker-meta-label"
          >
            {formatMeters(picker.limitStatus.totalMeters)} · {picker.limitStatus.vertexCount} punto(s)
            {picker.limitStatus.exceedsLength ? ' — supera 100km' : ''}
            {picker.limitStatus.exceedsVertices ? ' — supera 500 puntos' : ''}
          </Text>
        </View>

        <View className="flex-row gap-2" nativeID="route-draw-picker-actions" testID="route-draw-picker-actions">
          <Pressable className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={picker.points.length === 0} nativeID="route-draw-picker-undo-button" onPress={picker.undoLast} testID="route-draw-picker-undo-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="undo" size={16} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="route-draw-picker-undo-label" testID="route-draw-picker-undo-label">Deshacer</Text>
          </Pressable>
          <Pressable className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={picker.points.length === 0} nativeID="route-draw-picker-clear-button" onPress={picker.clear} testID="route-draw-picker-clear-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trash-can-outline" size={16} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="route-draw-picker-clear-label" testID="route-draw-picker-clear-label">Limpiar</Text>
          </Pressable>
          <Pressable className={`h-10 flex-1 items-center justify-center rounded-full bg-primary active:opacity-80 ${!picker.canConfirm ? 'opacity-40' : ''}`} disabled={!picker.canConfirm} nativeID="route-draw-picker-confirm-button" onPress={picker.confirm} testID="route-draw-picker-confirm-button">
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-draw-picker-confirm-label" testID="route-draw-picker-confirm-label">Confirmar ruta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
