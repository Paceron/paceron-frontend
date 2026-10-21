import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

// Marcador con tooltip al hover -- mismo patrón que buildMarker en
// route-map-preview.web.jsx (tooltip colgado de document.body, no hijo del
// wrapper del mapa, para que no quede cortado por su overflow-hidden).
function buildMarker(color, label) {
  const dot = document.createElement('div');
  dot.style.width = '14px';
  dot.style.height = '14px';
  dot.style.borderRadius = '7px';
  dot.style.backgroundColor = color;
  dot.style.border = '2px solid #ffffff';
  dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';

  const tooltip = document.createElement('div');
  tooltip.textContent = label;
  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = '70'; // Z_INDEX.tooltip, tailwind.config.js
  tooltip.style.backgroundColor = color;
  tooltip.style.color = '#ffffff';
  tooltip.style.fontSize = '12px';
  tooltip.style.fontWeight = '600';
  tooltip.style.padding = '2px 8px';
  tooltip.style.borderRadius = '6px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 120ms ease';
  tooltip.style.pointerEvents = 'none';
  document.body.appendChild(tooltip);

  const positionTooltip = () => {
    const rect = dot.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
  };
  dot.addEventListener('mouseenter', () => { positionTooltip(); tooltip.style.opacity = '1'; });
  dot.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  return { element: dot, destroy: () => tooltip.remove() };
}

export function LiveTrajectoryMap({ traveledPoints, referenceRoute }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const initialCenter = traveledPoints?.[0] ? [traveledPoints[0].longitude, traveledPoints[0].latitude] : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    const map = new maplibregl.Map({ attributionControl: false, container: containerRef.current, style: OPENFREEMAP_MINIMAL_STYLE_URL, center: initialCenter, zoom: 14, interactive: false });
    const markerCleanups = [];
    map.on('load', () => {
      map.addSource('live-trajectory-map-traveled', { type: 'geojson', data: EMPTY_LINE });
      map.addLayer({ id: 'live-trajectory-map-traveled-layer', type: 'line', source: 'live-trajectory-map-traveled', paint: { 'line-color': '#8cc63e', 'line-width': 4 } });
      const refCoords = referenceRoute?.coordinates ?? [];
      if (refCoords.length > 1) {
        map.addSource('live-trajectory-map-reference', { type: 'geojson', data: { type: 'Feature', geometry: referenceRoute, properties: {} } });
        map.addLayer({ id: 'live-trajectory-map-reference-layer', type: 'line', source: 'live-trajectory-map-reference', paint: { 'line-color': '#94a3b8', 'line-width': 3, 'line-dasharray': [2, 2] } });
      }
      if (refCoords.length >= 1) {
        const start = buildMarker('#ef4444', 'Punto de inicio');
        new maplibregl.Marker({ element: start.element, anchor: 'bottom' }).setLngLat(refCoords[0]).addTo(map);
        markerCleanups.push(start.destroy);
      }
      if (refCoords.length >= 2) {
        const end = buildMarker('#2563eb', 'Punto de llegada');
        new maplibregl.Marker({ element: end.element, anchor: 'bottom' }).setLngLat(refCoords[refCoords.length - 1]).addTo(map);
        markerCleanups.push(end.destroy);
      }
    });
    requestAnimationFrame(() => map.resize());
    mapRef.current = map;
    return () => {
      markerCleanups.forEach((destroy) => destroy());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource('live-trajectory-map-traveled')) return;
    const line = { type: 'Feature', geometry: { type: 'LineString', coordinates: (traveledPoints ?? []).map((p) => [p.longitude, p.latitude]) }, properties: {} };
    map.getSource('live-trajectory-map-traveled').setData(line);
    const boundsSource = [...(traveledPoints ?? []), ...(referenceRoute?.coordinates ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng }))];
    const bounds = computeBounds(boundsSource);
    if (bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 40, duration: 300 });
  }, [traveledPoints, referenceRoute]);

  return (
    <View className="h-full w-full overflow-hidden rounded-2xl" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
