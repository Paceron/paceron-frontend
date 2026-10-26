import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds, expandBounds } from '../../utils/map-bounds.js';
import { ROUTE_MARKER_META } from '../../utils/route-marker-meta.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

// Marcador con tooltip al hover -- mismo patrón que buildMarker en
// route-map-preview.web.jsx (tooltip colgado de document.body, no hijo del
// wrapper del mapa, para que no quede cortado por su overflow-hidden).
// El dot suma un ícono adentro (pedido real 2026-10-24) -- mismo font
// 'material-community' que usa <MaterialCommunityIcons/> en nativo,
// verificado en vivo que el codepoint renderiza contenido real (no un
// glyph faltante) antes de escribir esto.
function buildMarker(meta) {
  // `hitArea` -- mismo criterio que route-map-preview.web.jsx: agranda la
  // zona de toque (pedido real 2026-10-25) sin mover el dot visualmente,
  // padding solo arriba/costados (nunca abajo, `anchor: 'bottom'` ancla
  // contra el borde inferior de este elemento).
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

// Marcador de "acá estoy" -- círculo con foto de perfil (fallback a
// iniciales), rehecho a mano en DOM crudo porque AvatarPicker es un
// componente RN y un maplibregl.Marker necesita un HTMLElement real (no
// se puede montar un componente RN ahí, ver spec de esta rama). Mismos
// colores que AvatarPicker (tailwind.config.js: primary-tint #dcec9e,
// on-primary-tint #3c6b12) para que se vea igual que en nativo.
function buildCurrentPositionMarker(photoUrl, initials) {
  // 24, bajado de 32 -- pedido real 2026-10-25: matchear con el tamaño de
  // los dots de inicio/fin (22px + 2px de borde).
  const SIZE = 24;
  const circle = document.createElement('div');
  circle.style.width = `${SIZE}px`;
  circle.style.height = `${SIZE}px`;
  circle.style.borderRadius = '50%';
  circle.style.border = '2px solid #ffffff';
  circle.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
  circle.style.overflow = 'hidden';
  circle.style.display = 'flex';
  circle.style.alignItems = 'center';
  circle.style.justifyContent = 'center';
  circle.style.backgroundColor = '#dcec9e';

  const showInitials = () => {
    circle.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = initials ?? '';
    span.style.color = '#3c6b12';
    span.style.fontWeight = '700';
    span.style.fontSize = `${SIZE * 0.35}px`;
    circle.appendChild(span);
  };

  if (photoUrl) {
    const img = document.createElement('img');
    img.src = photoUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.onerror = showInitials;
    circle.appendChild(img);
  } else {
    showInitials();
  }

  return circle;
}

export function LiveTrajectoryMap({ traveledPoints, referenceRoute, currentPosition, currentUserPhotoUrl, currentUserInitials }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const currentPositionMarkerRef = useRef(null);

  useEffect(() => {
    const initialCenter = traveledPoints?.[0] ? [traveledPoints[0].longitude, traveledPoints[0].latitude] : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    // `interactive: false` sacado -- pedido real 2026-10-21: a diferencia de
    // RouteMapPreview (resumen de lectura, bloqueado a propósito), esta
    // pantalla SÍ necesita pan/zoom real para poder explorar la trayectoria
    // recorrida -- el maxBounds de abajo (mismo expandBounds que ya usa la
    // Camera nativa) acota el panning a una zona razonable en vez de dejarlo
    // infinito.
    const map = new maplibregl.Map({ attributionControl: false, container: containerRef.current, style: OPENFREEMAP_MINIMAL_STYLE_URL, center: initialCenter, zoom: 14 });
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
        const start = buildMarker(ROUTE_MARKER_META.start);
        new maplibregl.Marker({ element: start.element, anchor: 'bottom' }).setLngLat(refCoords[0]).addTo(map);
        markerCleanups.push(start.destroy);
      }
      if (refCoords.length >= 2) {
        const end = buildMarker(ROUTE_MARKER_META.end);
        new maplibregl.Marker({ element: end.element, anchor: 'bottom' }).setLngLat(refCoords[refCoords.length - 1]).addTo(map);
        markerCleanups.push(end.destroy);
      }
    });
    requestAnimationFrame(() => map.resize());
    mapRef.current = map;
    return () => {
      markerCleanups.forEach((destroy) => destroy());
      currentPositionMarkerRef.current?.remove();
      currentPositionMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Bug real 2026-10-21: con `map.loaded()` todavía en false en este punto
    // (el 'load' del primer efecto es async, puede no haber terminado
    // cuando el detalle de intento llega con traveledPoints/referenceRoute
    // YA poblados desde el primer render), `getSource` devolvía undefined y
    // este efecto se salía sin hacer nada -- el mapa quedaba pegado al zoom
    // fijo inicial (14, sin fit real) para siempre, sin reintentar. `once`
    // al evento 'load' en vez de salir en silencio cubre los dos casos
    // (mapa ya cargado o todavía cargando) sin duplicar el fit.
    const applyFit = () => {
      if (!map.getSource('live-trajectory-map-traveled')) return;
      const line = { type: 'Feature', geometry: { type: 'LineString', coordinates: (traveledPoints ?? []).map((p) => [p.longitude, p.latitude]) }, properties: {} };
      map.getSource('live-trajectory-map-traveled').setData(line);
      const boundsSource = [...(traveledPoints ?? []), ...(referenceRoute?.coordinates ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng }))];
      const bounds = computeBounds(boundsSource);
      if (!bounds) return;
      map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 40, duration: 300 });
      // Causa real de "se permite muy poco zoom out" (reportado otra vez
      // 2026-10-21 pese al minZoom bajado a 10 en la vuelta anterior):
      // `setMaxBounds` en maplibre-gl no es solo un límite de panning --
      // internamente calcula un minZoom EFECTIVO para que el viewport
      // nunca llegue a mostrar algo fuera de esa caja, y ese cálculo gana
      // sobre cualquier minZoom explícito más bajo si la caja es chica
      // (una ruta de a pie entra en una caja de pocos cientos de metros,
      // mucho más chica que lo que se ve a zoom 10). El minZoom de 10
      // nunca era alcanzable -- el límite real era el que imponía esta
      // caja. Fix: agrandar la caja en sí (margen mucho mayor que el de
      // route-map-preview.jsx, que es una preview de lectura bloqueada a
      // propósito a una zona chica) en vez de pelear con un minZoom
      // numérico que nunca le iba a ganar a una caja chica.
      const expanded = expandBounds(bounds, { marginRatio: 3, minMarginMeters: 3000 });
      if (expanded) map.setMaxBounds([[expanded[0], expanded[1]], [expanded[2], expanded[3]]]);
      map.setMaxZoom(18);
    };
    if (map.loaded()) applyFit();
    else map.once('load', applyFit);
  }, [traveledPoints, referenceRoute]);

  // Marcador de posición actual -- se crea una sola vez (al llegar el
  // primer currentPosition) y después solo se reposiciona
  // (`setLngLat`), no se recrea en cada punto -- recrear un Marker en
  // cada punto GPS (varias veces por segundo con el intervalo bajado en
  // esta misma rama) sería carísimo y parpadearía.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPosition) return;
    const lngLat = [currentPosition.longitude, currentPosition.latitude];
    if (currentPositionMarkerRef.current) {
      currentPositionMarkerRef.current.setLngLat(lngLat);
      return;
    }
    const element = buildCurrentPositionMarker(currentUserPhotoUrl, currentUserInitials);
    const marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(lngLat);
    if (map.loaded()) marker.addTo(map);
    else map.once('load', () => marker.addTo(map));
    currentPositionMarkerRef.current = marker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition]);

  return (
    <View className="h-full w-full overflow-hidden rounded-2xl border-2 border-gray-200" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
