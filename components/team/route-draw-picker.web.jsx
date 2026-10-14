import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useRouteDrawPicker } from '../../hooks/use-route-draw-picker.js';
import { formatMeters } from '../../utils/distance.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

export function RouteDrawPicker({ value, onChange }) {
  const colors = useThemeColors();
  const picker = useRouteDrawPicker({ value, onChange });
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  // Mapa se crea una sola vez (igual que location-picker.web.jsx) -- el
  // handler de click llama a `picker.addPoint` directo, sin necesitar
  // recrear el mapa cuando cambia la lista de puntos.
  useEffect(() => {
    const initialCenter = picker.points[0] ? [picker.points[0].lng, picker.points[0].lat] : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    const map = new maplibregl.Map({ container: containerRef.current, style: OPENFREEMAP_STYLE_URL, center: initialCenter, zoom: 13 });
    map.on('load', () => {
      map.addSource('route-draw-picker-line', { type: 'geojson', data: EMPTY_LINE });
      map.addLayer({ id: 'route-draw-picker-line-layer', type: 'line', source: 'route-draw-picker-line', paint: { 'line-color': '#8cc63e', 'line-width': 4 } });
    });
    map.on('click', (e) => picker.addPoint(e.lngLat.lat, e.lngLat.lng));
    requestAnimationFrame(() => map.resize());
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource('route-draw-picker-line')) return;
    const line = { type: 'Feature', geometry: { type: 'LineString', coordinates: picker.points.map((p) => [p.lng, p.lat]) }, properties: {} };
    map.getSource('route-draw-picker-line').setData(line);
  }, [picker.points]);

  return (
    <View className="gap-2" nativeID="route-draw-picker-root" testID="route-draw-picker-root">
      <View className="h-72 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" nativeID="route-draw-picker-map-wrapper" testID="route-draw-picker-map-wrapper">
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
        <Pressable className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800" disabled={picker.points.length === 0} nativeID="route-draw-picker-undo-button" onPress={picker.undoLast} testID="route-draw-picker-undo-button">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="undo" size={16} />
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="route-draw-picker-undo-label" testID="route-draw-picker-undo-label">Deshacer</Text>
        </Pressable>
        <Pressable className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800" disabled={picker.points.length === 0} nativeID="route-draw-picker-clear-button" onPress={picker.clear} testID="route-draw-picker-clear-button">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trash-can-outline" size={16} />
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="route-draw-picker-clear-label" testID="route-draw-picker-clear-label">Limpiar</Text>
        </Pressable>
        <Pressable className={`h-10 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 ${!picker.canConfirm ? 'opacity-40' : ''}`} disabled={!picker.canConfirm} nativeID="route-draw-picker-confirm-button" onPress={picker.confirm} testID="route-draw-picker-confirm-button">
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-draw-picker-confirm-label" testID="route-draw-picker-confirm-label">Confirmar ruta</Text>
        </Pressable>
      </View>
    </View>
  );
}
