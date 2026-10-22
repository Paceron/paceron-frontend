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
//
// El tooltip NO es hijo del wrapper del punto -- bug real, 2026-10-17: un
// punto cerca del borde de la preview quedaba cortado por el
// `overflow-hidden` del contenedor (mismo mecanismo que ya se resolvió
// para IconTooltip, ver components/shared/icon-tooltip.jsx). Mismo fix
// acá: el tooltip se cuelga de `document.body` como `position: fixed`,
// reposicionado en cada hover contra el rect real del punto -- así nunca
// queda encerrado por el contenedor de la preview, sea cual sea su
// tamaño o dónde esté el punto.
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

export function RouteMapPreview({ coordinates, nativeID, testID }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const points = coordinates ?? [];

  useEffect(() => {
    const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    // `interactive: false` -- bloqueado, es una previsualización de
    // lectura, no un mapa para explorar. No afecta el hover de los
    // marcadores de abajo (viven en un overlay DOM aparte del canvas).
    // `attributionControl: false` -- pedido real 2026-10-20, reemplaza el
    // compromiso anterior de "compact: true" (icono colapsado, 2026-10-17):
    // "no quiero la marca de agua de maplibre en ningun mapa en ningun
    // lado". La atribución de OSM/ODbL sigue cumplida fuera del mapa, ver
    // data/legal/terms-and-conditions.md.
    const map = new maplibregl.Map({ attributionControl: false, container: containerRef.current, style: OPENFREEMAP_MINIMAL_STYLE_URL, center: initialCenter, zoom: 13, interactive: false });
    // Tooltips colgados de document.body (ver buildMarker) -- hay que
    // sacarlos a mano al desmontar, nadie más los limpia.
    const markerCleanups = [];
    map.on('load', () => {
      map.addSource('route-map-preview-line', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} } });
      map.addLayer({ id: 'route-map-preview-line-layer', type: 'line', source: 'route-map-preview-line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8cc63e', 'line-width': 4 } });
      const bounds = computeBounds(points.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
      if (bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 24, duration: 0 });

      if (points[0]) {
        const start = buildMarker('#ef4444', 'Punto de inicio');
        new maplibregl.Marker({ element: start.element, anchor: 'bottom' }).setLngLat(points[0]).addTo(map);
        markerCleanups.push(start.destroy);
      }
      if (points.length > 1) {
        const end = buildMarker('#2563eb', 'Punto de llegada');
        new maplibregl.Marker({ element: end.element, anchor: 'bottom' }).setLngLat(points[points.length - 1]).addTo(map);
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

  return (
    <View className="h-full w-full overflow-hidden rounded-xl" nativeID={nativeID} testID={testID}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
