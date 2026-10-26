import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';
import { ROUTE_MARKER_META } from '../../utils/route-marker-meta.js';

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
function buildMarker(meta) {
  // `hitArea` es el elemento que se le pasa a `maplibregl.Marker` --
  // agranda la zona de toque (pedido real 2026-10-25) sin mover el dot
  // visualmente: `anchor: 'bottom'` ancla contra el borde inferior de ESTE
  // elemento, así que el padding solo va arriba/a los costados, nunca
  // abajo (agregar padding abajo correría el dot respecto de la
  // coordenada real).
  const hitArea = document.createElement('div');
  hitArea.style.display = 'flex';
  hitArea.style.alignItems = 'flex-end';
  hitArea.style.justifyContent = 'center';
  hitArea.style.paddingTop = '14px';
  hitArea.style.paddingLeft = '10px';
  hitArea.style.paddingRight = '10px';
  hitArea.style.cursor = 'pointer';

  const dot = document.createElement('div');
  dot.style.width = '22px';
  dot.style.height = '22px';
  dot.style.borderRadius = '11px';
  dot.style.backgroundColor = meta.color;
  dot.style.border = '2px solid #ffffff';
  dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
  dot.style.display = 'flex';
  dot.style.alignItems = 'center';
  dot.style.justifyContent = 'center';

  const icon = document.createElement('span');
  icon.style.fontFamily = 'material-community';
  icon.style.fontSize = '12px';
  icon.style.color = '#ffffff';
  icon.style.lineHeight = '1';
  icon.textContent = String.fromCodePoint(meta.iconCodepoint);
  dot.appendChild(icon);
  hitArea.appendChild(dot);

  const tooltip = document.createElement('div');
  tooltip.textContent = meta.label;
  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = '70'; // Z_INDEX.tooltip, tailwind.config.js
  tooltip.style.backgroundColor = meta.color;
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
  hitArea.addEventListener('mouseenter', () => { positionTooltip(); tooltip.style.opacity = '1'; });
  hitArea.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  return { element: hitArea, destroy: () => tooltip.remove() };
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
        const start = buildMarker(ROUTE_MARKER_META.start);
        new maplibregl.Marker({ element: start.element, anchor: 'bottom' }).setLngLat(points[0]).addTo(map);
        markerCleanups.push(start.destroy);
      }
      if (points.length > 1) {
        const end = buildMarker(ROUTE_MARKER_META.end);
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
