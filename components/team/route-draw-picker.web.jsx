import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useRouteDrawPicker } from '../../hooks/use-route-draw-picker.js';
import { formatMeters } from '../../utils/distance.js';
import { buildRadiusHaloWidthExpression } from '../../utils/map-radius-expression.js';
import { FIELD_LABEL } from '../forms/fields.jsx';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

// `acceptanceRadiusMeters` -- ver nota en route-draw-picker.jsx (nativo),
// mismo motivo acá.
export function RouteDrawPicker({ value, onChange, acceptanceRadiusMeters }) {
  const colors = useThemeColors();
  const picker = useRouteDrawPicker({ value, onChange });
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  // Puntos/radio en un ref -- los handlers de maplibre-gl (click/mousemove)
  // se registran UNA vez al montar el mapa y closurean sobre lo que sea
  // que `picker.points`/`acceptanceRadiusMeters` valían en ESE momento; sin
  // esto, la línea fantasma y el halo quedarían congelados con el primer
  // valor (mismo motivo por el que el resto del estado se actualiza vía
  // `map.getSource(...).setData(...)` imperativo en vez de recrear el mapa).
  const pointsRef = useRef(picker.points);
  pointsRef.current = picker.points;
  const radiusRef = useRef(acceptanceRadiusMeters);
  radiusRef.current = acceptanceRadiusMeters;

  // Mapa se crea una sola vez (igual que location-picker.web.jsx) -- el
  // handler de click llama a `picker.addPoint` directo, sin necesitar
  // recrear el mapa cuando cambia la lista de puntos.
  useEffect(() => {
    const initialCenter = picker.points[0] ? [picker.points[0].lng, picker.points[0].lat] : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    const map = new maplibregl.Map({ container: containerRef.current, style: OPENFREEMAP_STYLE_URL, center: initialCenter, zoom: 13 });
    map.on('load', () => {
      map.addSource('route-draw-picker-halo', { type: 'geojson', data: EMPTY_LINE });
      // `line-cap`/`line-join: 'round'` -- pedido real: "controlemos que no
      // se intensifique por superposicion". El join por default ('miter')
      // duplica cobertura en cada giro filoso del trazado a mano, y una
      // línea translúcida ahí se ve más intensa que en el resto del halo.
      map.addLayer({ id: 'route-draw-picker-halo-layer', type: 'line', source: 'route-draw-picker-halo', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8cc63e', 'line-opacity': 0.28, 'line-width': 0 } });
      map.addSource('route-draw-picker-line', { type: 'geojson', data: EMPTY_LINE });
      // Verde oscuro cuando está confirmada (pedido real, 2026-10-17) --
      // arranca con el color sin confirmar, el useEffect de abajo lo
      // actualiza cuando cambia picker.confirmed.
      map.addLayer({ id: 'route-draw-picker-line-layer', type: 'line', source: 'route-draw-picker-line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8cc63e', 'line-width': 4 } });
      // Línea fantasma (pedido real, 2026-10-16: "trayectoria fantasma que
      // una el ultimo punto marcado con el posible siguiente punto segun la
      // posicion del mouse... en web es facil de ver y seria util") --
      // explícitamente SOLO web (en mobile no hay cursor estable, el propio
      // usuario lo aclaró). Punteada para distinguirla de la ruta real.
      map.addSource('route-draw-picker-ghost', { type: 'geojson', data: EMPTY_LINE });
      map.addLayer({ id: 'route-draw-picker-ghost-layer', type: 'line', source: 'route-draw-picker-ghost', paint: { 'line-color': '#8cc63e', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.6 } });
    });
    map.on('click', (e) => picker.addPoint(e.lngLat.lat, e.lngLat.lng));
    map.on('mousemove', (e) => {
      const last = pointsRef.current[pointsRef.current.length - 1];
      const ghostSource = map.getSource('route-draw-picker-ghost');
      if (!last || !ghostSource) return;
      ghostSource.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[last.lng, last.lat], [e.lngLat.lng, e.lngLat.lat]] }, properties: {} });
    });
    map.on('mouseout', () => map.getSource('route-draw-picker-ghost')?.setData(EMPTY_LINE));
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
    // Oculta la fantasma apenas se agrega el punto que estaba previendo --
    // si no, queda una línea punteada residual pegada al punto nuevo hasta
    // el próximo mousemove.
    map.getSource('route-draw-picker-ghost')?.setData(EMPTY_LINE);

    const radiusMeters = Number(radiusRef.current);
    const haloSource = map.getSource('route-draw-picker-halo');
    if (!haloSource) return;
    if (picker.points.length > 1 && Number.isFinite(radiusMeters) && radiusMeters > 0) {
      const centerLat = picker.points.reduce((sum, p) => sum + p.lat, 0) / picker.points.length;
      map.setPaintProperty('route-draw-picker-halo-layer', 'line-width', buildRadiusHaloWidthExpression(radiusMeters, centerLat));
      haloSource.setData(line);
    } else {
      haloSource.setData(EMPTY_LINE);
    }
  }, [picker.points]);

  // El radio puede cambiar sin tocar los puntos (el campo vive aparte, en
  // create-competition-modal.jsx) -- recalcular el ancho del halo también
  // acá, no solo cuando cambian los puntos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('route-draw-picker-halo-layer')) return;
    const radiusMeters = Number(acceptanceRadiusMeters);
    if (picker.points.length > 1 && Number.isFinite(radiusMeters) && radiusMeters > 0) {
      const centerLat = picker.points.reduce((sum, p) => sum + p.lat, 0) / picker.points.length;
      map.setPaintProperty('route-draw-picker-halo-layer', 'line-width', buildRadiusHaloWidthExpression(radiusMeters, centerLat));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptanceRadiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('route-draw-picker-line-layer')) return;
    map.setPaintProperty('route-draw-picker-line-layer', 'line-color', picker.confirmed ? '#166534' : '#8cc63e');
  }, [picker.confirmed]);

  const handleLocateMe = async () => {
    const coords = await picker.locateMe();
    if (coords) mapRef.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 600 });
  };

  return (
    <View className="gap-1.5" nativeID="route-draw-picker-root" testID="route-draw-picker-root">
      <Text className={FIELD_LABEL} nativeID="route-draw-picker-label" testID="route-draw-picker-label">Trazado de la ruta</Text>

      <View className="gap-2 rounded-xl border border-slate-100 p-1.5 dark:border-slate-800" nativeID="route-draw-picker-section" testID="route-draw-picker-section">
        <View
          className={`h-72 overflow-hidden rounded-xl border dark:border-slate-700 ${picker.confirmed ? 'border-2 border-primary' : 'border-slate-200'}`}
          nativeID="route-draw-picker-map-wrapper"
          testID="route-draw-picker-map-wrapper"
        >
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          <Pressable
            className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-white shadow-md hover:opacity-90 dark:bg-surface"
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
    </View>
  );
}
