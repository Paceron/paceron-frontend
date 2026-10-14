import { Pressable, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useRouteDrawPicker } from '../../hooks/use-route-draw-picker.js';
import { formatMeters } from '../../utils/distance.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Dibujo de ruta por tap (Spec 4c, type='route') -- cada tap sobre el mapa
// agrega un vértice; la polilínea se redibuja en vivo vía GeoJSONSource. Sin
// drag-to-pan deshabilitado (a diferencia de LocationPicker, acá SÍ hace
// falta poder desplazar el mapa para dibujar una ruta larga).
export function RouteDrawPicker({ value, onChange }) {
  const colors = useThemeColors();
  const picker = useRouteDrawPicker({ value, onChange });

  const handleMapPress = (event) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    picker.addPoint(lat, lng);
  };

  const lineGeojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: picker.points.map((p) => [p.lng, p.lat]) },
    properties: {},
  };

  const initialCenter = picker.points[0]
    ? [picker.points[0].lng, picker.points[0].lat]
    : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  return (
    <View className="gap-2" nativeID="route-draw-picker-root" testID="route-draw-picker-root">
      <View className="h-72 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" nativeID="route-draw-picker-map-wrapper" testID="route-draw-picker-map-wrapper">
        <Map mapStyle={OPENFREEMAP_STYLE_URL} nativeID="route-draw-picker-map" onPress={handleMapPress} style={{ flex: 1 }} testID="route-draw-picker-map">
          <Camera initialViewState={{ center: initialCenter, zoom: 13 }} />
          {picker.points.length > 1 && (
            <GeoJSONSource id="route-draw-picker-line-source" shape={lineGeojson}>
              <Layer id="route-draw-picker-line-layer" style={{ lineColor: '#8cc63e', lineWidth: 4 }} type="line" />
            </GeoJSONSource>
          )}
        </Map>
      </View>

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
  );
}
