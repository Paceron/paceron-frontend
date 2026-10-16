import { useMemo, useState } from 'react';
import { routeLimitStatus } from '../utils/route-geometry.js';

function geojsonToPoints(geojson) {
  if (!geojson?.coordinates) return [];
  return geojson.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function pointsToGeojson(points) {
  return { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) };
}

// Estado del picker de dibujo de ruta (Spec 4c) -- agnóstico de plataforma,
// usado por los dos pickers (nativo/web, mismo split que LocationPicker).
// `value`/`onChange` siguen el contrato de GeoJSON LineString que espera
// `POST /teams/{id}/competitions` (route).
export function useRouteDrawPicker({ value, onChange }) {
  const [points, setPoints] = useState(() => geojsonToPoints(value));

  const addPoint = (lat, lng) => setPoints((prev) => [...prev, { lat, lng }]);
  const undoLast = () => setPoints((prev) => prev.slice(0, -1));
  const clear = () => setPoints([]);

  const limitStatus = useMemo(() => routeLimitStatus(points), [points]);
  const canConfirm = points.length >= 2 && !limitStatus.exceedsVertices && !limitStatus.exceedsLength;

  const confirm = () => {
    if (!canConfirm) return;
    onChange(pointsToGeojson(points));
  };

  return { points, addPoint, undoLast, clear, confirm, limitStatus, canConfirm };
}
