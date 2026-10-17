import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Marcador de inicio/llegada con hover -- elemento DOM plano (no un
// componente React: maplibregl.Marker vive fuera del árbol de React,
// mismo criterio que el resto de este archivo) con su propio listener de
// mouseenter/mouseleave, independiente de `interactive: false` del mapa
// (un Marker es un overlay DOM aparte del canvas WebGL interactivo).
// Pedido real, 2026-10-17: "en desktop... hover... etiqueta... del color
// del punto".
function buildMarkerElement(color, label) {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';

  const tooltip = document.createElement('div');
  tooltip.textContent = label;
  tooltip.style.backgroundColor = color;
  tooltip.style.color = '#ffffff';
  tooltip.style.fontSize = '12px';
  tooltip.style.fontWeight = '600';
  tooltip.style.padding = '2px 8px';
  tooltip.style.borderRadius = '6px';
  tooltip.style.marginBottom = '4px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 120ms ease';
  tooltip.style.pointerEvents = 'none';

  const dot = document.createElement('div');
  dot.style.width = '14px';
  dot.style.height = '14px';
  dot.style.borderRadius = '7px';
  dot.style.backgroundColor = color;
  dot.style.border = '2px solid #ffffff';
  dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';

  wrapper.appendChild(tooltip);
  wrapper.appendChild(dot);
  wrapper.addEventListener('mouseenter', () => { tooltip.style.opacity = '1'; });
  wrapper.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
  return wrapper;
}

export function RouteMapPreview({ coordinates, nativeID, testID }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const points = coordinates ?? [];

  useEffect(() => {
    const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    // `interactive: false` -- bloqueado, es una previsualización de
    // lectura, no un mapa para explorar. No afecta el hover de los
    // marcadores de abajo (viven en un overlay DOM aparte del canvas).
    const map = new maplibregl.Map({ container: containerRef.current, style: OPENFREEMAP_MINIMAL_STYLE_URL, center: initialCenter, zoom: 13, interactive: false });
    map.on('load', () => {
      map.addSource('route-map-preview-line', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} } });
      map.addLayer({ id: 'route-map-preview-line-layer', type: 'line', source: 'route-map-preview-line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8cc63e', 'line-width': 4 } });
      const bounds = computeBounds(points.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
      if (bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 24, duration: 0 });

      if (points[0]) {
        new maplibregl.Marker({ element: buildMarkerElement('#ef4444', 'Punto de inicio'), anchor: 'bottom' }).setLngLat(points[0]).addTo(map);
      }
      if (points.length > 1) {
        new maplibregl.Marker({ element: buildMarkerElement('#2563eb', 'Punto de llegada'), anchor: 'bottom' }).setLngLat(points[points.length - 1]).addTo(map);
      }
    });
    requestAnimationFrame(() => map.resize());
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="h-full w-full overflow-hidden rounded-xl" nativeID={nativeID} testID={testID}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
