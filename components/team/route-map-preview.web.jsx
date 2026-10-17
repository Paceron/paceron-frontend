import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

export function RouteMapPreview({ coordinates, nativeID, testID }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const points = coordinates ?? [];

  useEffect(() => {
    const initialCenter = points[0] ?? [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    // `interactive: false` -- bloqueado, mismo criterio que la versión
    // nativa (`pointerEvents="none"`): previsualización de lectura, no un
    // mapa para explorar.
    const map = new maplibregl.Map({ container: containerRef.current, style: OPENFREEMAP_MINIMAL_STYLE_URL, center: initialCenter, zoom: 13, interactive: false });
    map.on('load', () => {
      map.addSource('route-map-preview-line', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} } });
      map.addLayer({ id: 'route-map-preview-line-layer', type: 'line', source: 'route-map-preview-line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8cc63e', 'line-width': 4 } });
      const bounds = computeBounds(points.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
      if (bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 24, duration: 0 });
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
