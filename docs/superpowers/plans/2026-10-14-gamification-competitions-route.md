# Gamificación — Spec 4c: Competencias por trayectoria (`type='route'`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `type='route'` completo: dibujar una ruta en el mapa al crear (web + mobile), correr
un intento con GPS real (mobile-only, extendiendo el pipeline existente de
`training-session-active-screen.jsx`), y ver el resultado con % de coincidencia.

**Architecture:** La instancia sintética del backend trae 1 solo ejercicio ("Corrida"), que ya es
el caso de 1 ejercicio/1 serie que el pipeline SQLite+sync+GPS existente soporta hoy — se extiende
ese pipeline con un flag `routeAttempt`, no se duplica. El picker de dibujo de ruta y el mapa en
vivo son componentes nuevos con split nativo/web (mismo patrón que `LocationPicker`), sin módulo
nativo nuevo (`@maplibre/maplibre-react-native` ya instalado).

**Tech Stack:** React Native + Expo, `@maplibre/maplibre-react-native` (nativo), `maplibre-gl`
(web), NativeWind, TanStack Query, `expo-sqlite` (ya en uso en el pipeline existente).

**Spec:** `docs/superpowers/specs/2026-10-14-gamification-competitions-route-design.md`

## Global Constraints

- Backend (Gap 33, puntos 26-32, `docs/BACKEND_API_GAPS.md`): `route` GeoJSON LineString máx 500
  vértices / 100km de largo total, `acceptance_radius_meters` rango `[5,500]` default 50 (decisión
  de frontend), ruta inmutable post-creación, sin `metric`/`end_at` para `type='route'`.
- `POST /competitions/{id}/attempts` (nuevo) — intake del intento, crea/reusa el
  `runner_session` de la instancia sintética internamente, devuelve el `session_instance_id`
  sintético. `400` si ya hay intento previo, la competencia no está `active`, o el caller no es
  participante.
- `PATCH /competitions/{id}/close` para ruta: solo entrenador/owner, solo `active`, SIN chequeo de
  `end_at` (no existe para este tipo).
- Sin WS en vivo durante el intento (v1) — `update:competition_progress` llega recién al terminar.
- IDs en bodies de request: `Number(id)`. Toda competencia nueva sigue sin campo `name` (D8) — usa
  `buildCompetitionTitle` (`utils/competition-title.js`, ya existe).
- **División de plataforma, no excepción al resto del repo:** crear (dibujar ruta) anda en web +
  mobile. Correr un intento es **mobile-only** (GPS real) — mismo patrón que
  `StartSessionButton`: en web se muestra un aviso, nunca se oculta el botón sin explicación.
- Cada visual nuevo lleva `nativeID`/`testID` kebab-case.
- No tests de render de componentes ni de picker de mapa — solo utils/hooks/mocks puros.
- Ejecución: inline en esta sesión, sin subagentes ni preview — última tarea entrega script de
  prueba manual.

---

### Task 1: `utils/route-geometry.js` — límites de ruta (pure, testeado)

**Files:**
- Create: `utils/route-geometry.js`
- Test: `__tests__/route-geometry.test.js`

**Interfaces:**
- Consumes: `haversineMeters` (`utils/distance.js`, ya existe).
- Produces: `totalRouteMeters(points)` → number (suma de tramos consecutivos,
  `points: [{lat, lng}]`). `MAX_ROUTE_VERTICES = 500`, `MAX_ROUTE_METERS = 100_000` (constantes
  exportadas). `routeLimitStatus(points)` → `{totalMeters, vertexCount, exceedsVertices:
  boolean, exceedsLength: boolean}`. Used by Task 2 (`use-route-draw-picker.js`).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/route-geometry.test.js
import { totalRouteMeters, routeLimitStatus, MAX_ROUTE_VERTICES, MAX_ROUTE_METERS } from '../utils/route-geometry.js';

describe('totalRouteMeters', () => {
  test('sin puntos o un solo punto -> 0', () => {
    expect(totalRouteMeters([])).toBe(0);
    expect(totalRouteMeters([{ lat: -34.6, lng: -58.4 }])).toBe(0);
  });

  test('suma los tramos consecutivos', () => {
    const points = [
      { lat: -34.6037, lng: -58.3816 },
      { lat: -34.6137, lng: -58.3816 }, // ~1113m al sur
    ];
    const total = totalRouteMeters(points);
    expect(total).toBeGreaterThan(1000);
    expect(total).toBeLessThan(1200);
  });
});

describe('routeLimitStatus', () => {
  test('ruta chica no excede nada', () => {
    const points = [{ lat: -34.6, lng: -58.4 }, { lat: -34.601, lng: -58.4 }];
    const status = routeLimitStatus(points);
    expect(status.exceedsVertices).toBe(false);
    expect(status.exceedsLength).toBe(false);
    expect(status.vertexCount).toBe(2);
  });

  test('más de 500 vértices excede', () => {
    const points = Array.from({ length: 501 }, (_, i) => ({ lat: -34.6 + i * 0.0001, lng: -58.4 }));
    expect(routeLimitStatus(points).exceedsVertices).toBe(true);
  });

  test('largo total mayor a 100km excede', () => {
    // ~1 grado de latitud ~= 111km, con 2 puntos alcanza para superar 100km
    const points = [{ lat: -34.0, lng: -58.4 }, { lat: -35.0, lng: -58.4 }];
    expect(routeLimitStatus(points).exceedsLength).toBe(true);
  });

  test('constantes exportadas con los valores confirmados por backend', () => {
    expect(MAX_ROUTE_VERTICES).toBe(500);
    expect(MAX_ROUTE_METERS).toBe(100_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest route-geometry --verbose`
Expected: FAIL with "Cannot find module '../utils/route-geometry.js'"

- [ ] **Step 3: Write the util**

```js
// utils/route-geometry.js
import { haversineMeters } from './distance.js';

// Límites confirmados por backend (Gap 33 punto 30, docs/BACKEND_API_GAPS.md)
// -- validados también client-side para dar feedback antes del 400 real.
export const MAX_ROUTE_VERTICES = 500;
export const MAX_ROUTE_METERS = 100_000;

// Largo total de una ruta dibujada a mano (puntos en orden), sumando cada
// tramo consecutivo con la misma fórmula haversine que ya usa el filtro de
// calidad GPS (utils/distance.js) -- no se duplica el cálculo, solo se
// aplica a una secuencia de puntos "limpios" (sin filtro de ruido, estos
// puntos los puso el usuario a mano, no un receptor GPS).
export function totalRouteMeters(points) {
  const valid = points ?? [];
  if (valid.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < valid.length; i++) {
    total += haversineMeters(valid[i - 1].lat, valid[i - 1].lng, valid[i].lat, valid[i].lng);
  }
  return total;
}

// Estado derivado para habilitar/deshabilitar "Confirmar" en el picker y
// mostrar el aviso ANTES de que el backend rechace con 400 (UX, no
// reemplaza la validación real del servidor).
export function routeLimitStatus(points) {
  const valid = points ?? [];
  const totalMeters = totalRouteMeters(valid);
  return {
    totalMeters,
    vertexCount: valid.length,
    exceedsVertices: valid.length > MAX_ROUTE_VERTICES,
    exceedsLength: totalMeters > MAX_ROUTE_METERS,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest route-geometry --verbose`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add utils/route-geometry.js __tests__/route-geometry.test.js
git commit -m "feat(competitions): route-geometry pure util — length/vertex limits (Gap 33)"
```

---

### Task 2: `hooks/use-route-draw-picker.js`

**Files:**
- Create: `hooks/use-route-draw-picker.js`
- Test: `__tests__/use-route-draw-picker.test.js`

**Interfaces:**
- Consumes: `routeLimitStatus` (Task 1).
- Produces: `useRouteDrawPicker({ value, onChange })` → `{ points, addPoint(lat,lng), undoLast(),
  clear(), confirm(), limitStatus, canConfirm }`. `value`/`onChange` siguen el mismo contrato de
  `LocationPicker` pero con una lista de puntos: `value` es un GeoJSON LineString o `null`,
  `onChange(geojson)` se llama desde `confirm()`. `canConfirm` = `points.length >= 2 &&
  !limitStatus.exceedsVertices && !limitStatus.exceedsLength`. Used by Task 3 (los dos pickers de
  plataforma).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/use-route-draw-picker.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useRouteDrawPicker } from '../hooks/use-route-draw-picker.js';

describe('useRouteDrawPicker', () => {
  test('arranca vacío, agregar puntos crece la lista', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    expect(result.current.points).toEqual([]);
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.4));
    expect(result.current.points).toHaveLength(2);
    expect(result.current.canConfirm).toBe(true);
  });

  test('con menos de 2 puntos no se puede confirmar', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    act(() => result.current.addPoint(-34.6, -58.4));
    expect(result.current.canConfirm).toBe(false);
  });

  test('undoLast sacar el último punto agregado', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.4));
    act(() => result.current.undoLast());
    expect(result.current.points).toHaveLength(1);
  });

  test('clear vacía todo', () => {
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange: () => {} }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.clear());
    expect(result.current.points).toEqual([]);
  });

  test('confirm llama onChange con un GeoJSON LineString, coords [lng,lat]', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.addPoint(-34.61, -58.41));
    act(() => result.current.confirm());
    expect(onChange).toHaveBeenCalledWith({
      type: 'LineString',
      coordinates: [[-58.4, -34.6], [-58.41, -34.61]],
    });
  });

  test('confirm con menos de 2 puntos no llama onChange', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useRouteDrawPicker({ value: null, onChange }));
    act(() => result.current.addPoint(-34.6, -58.4));
    act(() => result.current.confirm());
    expect(onChange).not.toHaveBeenCalled();
  });

  test('con un value GeoJSON previo, arranca con esos puntos cargados', () => {
    const value = { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] };
    const { result } = renderHook(() => useRouteDrawPicker({ value, onChange: () => {} }));
    expect(result.current.points).toEqual([{ lat: -34.6, lng: -58.4 }, { lat: -34.61, lng: -58.41 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest use-route-draw-picker --verbose`
Expected: FAIL with "Cannot find module '../hooks/use-route-draw-picker.js'"

- [ ] **Step 3: Write the hook**

```js
// hooks/use-route-draw-picker.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest use-route-draw-picker --verbose`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add hooks/use-route-draw-picker.js __tests__/use-route-draw-picker.test.js
git commit -m "feat(competitions): use-route-draw-picker hook — point state + limits"
```

---

### Task 3: `RouteDrawPicker` (nativo + web)

**Files:**
- Create: `components/team/route-draw-picker.jsx` (nativo, `@maplibre/maplibre-react-native`)
- Create: `components/team/route-draw-picker.web.jsx` (web, `maplibre-gl`)

**Interfaces:**
- Consumes: `useRouteDrawPicker` (Task 2).
- Produces: `<RouteDrawPicker value={geojson|null} onChange={fn} />` — import SIN extensión
  (`from './route-draw-picker'`) en el caller (Task 5), para que Metro resuelva por plataforma
  (mismo quirk documentado en `CLAUDE.md` para `checkout-flow.jsx`).

- [ ] **Step 1: Write the native picker**

```jsx
// components/team/route-draw-picker.jsx
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
```

- [ ] **Step 2: Write the web picker**

```jsx
// components/team/route-draw-picker.web.jsx
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
  const pointsRef = useRef(picker.points);
  pointsRef.current = picker.points;

  // Mapa se crea una sola vez (igual que location-picker.web.jsx) -- el
  // handler de click lee `pointsRef.current` en vez de cerrar sobre
  // `picker.addPoint` directo para no tener que recrear el mapa cada vez
  // que cambia la lista de puntos.
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
```

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green (no dedicated test for these two files — convención del repo, sin tests de
render ni de gesto de mapa).

- [ ] **Step 4: Commit**

```bash
git add components/team/route-draw-picker.jsx components/team/route-draw-picker.web.jsx
git commit -m "feat(competitions): RouteDrawPicker — native + web route drawing"
```

---

### Task 4: Data layer — crear `type='route'`, intake de intento, detalle

**Files:**
- Modify: `services/competitions.js` (append `createCompetitionAttempt`, `getCompetition`)
- Modify: `services/__mocks__/competitions-mock.js` (append route creation support + attempts mock)
- Modify: `services/normalizers.js` (`toCreateCompetitionPayload` suma rama `route`;
  `toCompetitionModel` ya tiene `route`/`acceptanceRadiusMeters` desde 4a, sin cambios ahí)
- Test: extend `__tests__/competitions-mock.test.js`

**Interfaces:**
- Produces: `createCompetitionAttempt(competitionId, athleteUserId)` → `{session_instance_id,
  session_instance: {id, name, exercises}}` (snake_case tal cual — es un shape ad-hoc de la
  instancia sintética, no pasa por `toCompetitionModel`). `getCompetition(id)` → `{data:
  {...toCompetitionModel fields..., progress}}`. `toCreateCompetitionPayload(form)` con
  `form.type === 'route'` omite `metric`/`endAt`, suma `route`/`acceptanceRadiusMeters`. Used by
  Task 5 (modal), Task 6 (entry point), Task 9 (resultado).

- [ ] **Step 1: Extend the mock — route creation + attempts**

```diff
--- a/services/__mocks__/competitions-mock.js
+++ b/services/__mocks__/competitions-mock.js
@@
 let mockCompetitions = [];
 let nextId = 4;
+let nextSyntheticInstanceId = 9000;
+// (competition_id, athlete_user_id) ya intentados -- Gap 33 punto 28, sin
+// reintentos en v1.
+const mockAttempts = new Set();
```

```diff
@@ function resetSeed() {
   mockCompetitions = SEED.map((c) => ({ ...c }));
   nextId = SEED.length + 1;
+  nextSyntheticInstanceId = 9000;
+  mockAttempts.clear();
 }
```

```diff
 export async function mockCreateCompetition(teamId, payload, { isTrainerCreator = true } = {}) {
   const competition = {
     id: nextId++,
     team_id: Number(teamId),
     group_id: payload.group_id ?? null,
     type: payload.type,
     metric: payload.metric ?? null,
     start_at: payload.start_at,
     end_at: payload.end_at ?? null,
-    route: null,
-    acceptance_radius_meters: null,
+    route: payload.route ?? null,
+    acceptance_radius_meters: payload.acceptance_radius_meters ?? null,
     participant_user_ids: payload.participant_user_ids ?? [],
     created_by_user_id: 1,
     created_by_role: isTrainerCreator ? 'trainer' : 'runner',
     status: isTrainerCreator ? 'active' : 'pending_approval',
     approved_by_user_id: null,
     rejection_reason: null,
     winner_user_ids: [],
     finished_at: null,
+    // Instancia sintética (Gap 33 punto 26) -- una sola por competencia,
+    // compartida por todos los participantes, generada al crear.
+    synthetic_session_instance_id: payload.type === 'route' ? nextSyntheticInstanceId++ : null,
   };
   mockCompetitions.push(competition);
   return competition;
 }
```

```diff
 export function __resetMockCompetitions() {
   resetSeed();
 }
+
+// POST /competitions/{id}/attempts (Gap 33 punto 26) -- valida active +
+// participante + sin intento previo, devuelve la instancia sintética.
+export async function mockCreateCompetitionAttempt(competitionId, athleteUserId) {
+  const competition = mockCompetitions.find((c) => c.id === Number(competitionId));
+  if (!competition) throw new Error('Competencia no encontrada');
+  if (competition.status !== 'active') throw new Error('La competencia no está activa');
+  if (!competition.participant_user_ids.includes(Number(athleteUserId))) throw new Error('No participás de esta competencia');
+  const key = `${competitionId}:${athleteUserId}`;
+  if (mockAttempts.has(key)) throw new Error('Ya tenés un intento registrado para esta competencia');
+  mockAttempts.add(key);
+  return {
+    session_instance_id: competition.synthetic_session_instance_id,
+    session_instance: {
+      id: competition.synthetic_session_instance_id,
+      name: 'Corrida',
+      exercises: [{ id: competition.synthetic_session_instance_id * 10, name: 'Corrida', role: 'main', repeat_count: 1, rest_minutes: 0 }],
+    },
+  };
+}
+
+// GET /competitions/{id} (detalle, Gap 33 punto 23) -- `progress` siempre
+// `[{user_id, value}]`, `value` null para type='route' en v1.
+export async function mockGetCompetition(id) {
+  const competition = mockCompetitions.find((c) => c.id === Number(id));
+  if (!competition) throw new Error('Competencia no encontrada');
+  const progress = competition.participant_user_ids.map((userId) => ({
+    user_id: userId,
+    value: competition.type === 'route' ? null : 0,
+  }));
+  return { data: { ...competition, progress } };
+}
```

- [ ] **Step 2: Write the failing tests**

```js
// __tests__/competitions-mock.test.js (append)
import {
  mockCreateCompetitionAttempt,
  mockGetCompetition,
} from '../services/__mocks__/competitions-mock.js';

describe('mockCreateCompetitionAttempt', () => {
  test('crear type=route y correr un intento devuelve la instancia sintética', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    const attempt = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(attempt.session_instance_id).toBe(competition.synthetic_session_instance_id);
    expect(attempt.session_instance.exercises).toHaveLength(1);
  });

  test('segundo intento del mismo atleta -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    await mockCreateCompetitionAttempt(competition.id, 2);
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('Ya tenés un intento');
  });

  test('atleta no participante -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    await expect(mockCreateCompetitionAttempt(competition.id, 9)).rejects.toThrow('No participás');
  });

  test('competencia pending_approval -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: false });
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('no está activa');
  });
});

describe('mockGetCompetition', () => {
  test('devuelve progress con un valor por participante', async () => {
    const { data } = await mockGetCompetition(1);
    expect(data.progress).toHaveLength(data.participant_user_ids.length);
    expect(data.progress[0]).toHaveProperty('user_id');
    expect(data.progress[0]).toHaveProperty('value');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest competitions-mock --verbose`
Expected: FAIL (new exports don't exist yet).

- [ ] **Step 4: Extend the service**

```diff
--- a/services/competitions.js
+++ b/services/competitions.js
@@
 import {
   mockListCompetitions,
   mockCreateCompetition,
   mockApproveCompetition,
   mockRejectCompetition,
   mockCancelCompetition,
   mockCloseCompetition,
+  mockCreateCompetitionAttempt,
+  mockGetCompetition,
 } from './__mocks__/competitions-mock.js';
```

```diff
 export async function closeCompetition(id) {
   if (USE_MOCKS) return await mockCloseCompetition(id);
   return await api.patch(`/competitions/${id}/close`, {});
 }
+
+// GET /api/v1/competitions/{id} -- detalle + progreso (Gap 33 punto 23).
+export async function getCompetition(id) {
+  if (USE_MOCKS) return await mockGetCompetition(id);
+  return await api.get(`/competitions/${id}`);
+}
+
+// POST /api/v1/competitions/{id}/attempts -- intake del intento (Gap 33
+// punto 26, pieza nueva). `athleteUserId` solo lo usa el mock (no hay token
+// real que simular en modo mock) -- la llamada real lo ignora.
+export async function createCompetitionAttempt(id, athleteUserId) {
+  if (USE_MOCKS) return await mockCreateCompetitionAttempt(id, athleteUserId);
+  return await api.post(`/competitions/${id}/attempts`, {});
+}
```

- [ ] **Step 5: Extend `toCreateCompetitionPayload`**

```diff
--- a/services/normalizers.js
+++ b/services/normalizers.js
@@ export function toCreateCompetitionPayload(form) {
-  const payload = {
-    type: form.type,
-    metric: form.metric,
-    start_at: form.startAt,
-    end_at: form.endAt,
-    participant_user_ids: (form.participantUserIds ?? []).map((id) => Number(id)),
-  };
+  const payload = {
+    type: form.type,
+    start_at: form.startAt,
+    participant_user_ids: (form.participantUserIds ?? []).map((id) => Number(id)),
+  };
+  if (form.type === 'route') {
+    payload.route = form.route;
+    payload.acceptance_radius_meters = Number(form.acceptanceRadiusMeters);
+  } else {
+    payload.metric = form.metric;
+    payload.end_at = form.endAt;
+  }
   if (form.groupId) payload.group_id = Number(form.groupId);
   return payload;
 }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest competitions-mock normalizers --verbose`
Expected: PASS.

- [ ] **Step 7: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add services/competitions.js services/__mocks__/competitions-mock.js services/normalizers.js __tests__/competitions-mock.test.js
git commit -m "feat(competitions): route creation + attempts intake + detail (Gap 33)"
```

---

### Task 5: `CreateCompetitionModal` — selector de tipo + rama ruta

**Files:**
- Modify: `components/team/create-competition-modal.jsx`

**Interfaces:**
- Consumes: `RouteDrawPicker` (Task 3), `routeLimitStatus`/constantes (Task 1, vía el picker).
- Produces: sin cambio de firma pública (`<CreateCompetitionModal visible onClose onSubmit
  members groups />`), el form interno ahora puede enviar `{type:'route', route,
  acceptanceRadiusMeters, ...}` además de `{type:'metric', ...}`.

- [ ] **Step 1: Add type state + conditional fields**

```diff
--- a/components/team/create-competition-modal.jsx
+++ b/components/team/create-competition-modal.jsx
@@
 import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
 import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';
+import { RouteDrawPicker } from './route-draw-picker';
 import { toISODate } from '../../utils/date-field-format.js';
```

```diff
+const TYPE_OPTIONS = [
+  { id: 'metric', name: 'Por métrica' },
+  { id: 'route', name: 'Por trayectoria' },
+];
+const DEFAULT_ACCEPTANCE_RADIUS = 50;
+
 export function CreateCompetitionModal({ visible, onClose, onSubmit, members, groups }) {
   const colors = useThemeColors();

+  const [type, setType] = useState('metric');
   const [metric, setMetric] = useState('distance');
   const [startDate, setStartDate] = useState('');
   const [endDate, setEndDate] = useState('');
+  const [route, setRoute] = useState(null);
+  const [acceptanceRadius, setAcceptanceRadius] = useState(String(DEFAULT_ACCEPTANCE_RADIUS));
   const [groupFilter, setGroupFilter] = useState('');
```

```diff
   if (isResetting) {
     prevResetKeyRef.current = resetKey;
+    setType('metric');
     setMetric('distance');
     setStartDate('');
     setEndDate('');
+    setRoute(null);
+    setAcceptanceRadius(String(DEFAULT_ACCEPTANCE_RADIUS));
     setGroupFilter('');
     setSelectedIds([]);
     setError(null);
   } else if (!visible) {
```

```diff
   const handleSubmit = async () => {
     if (submitting) return;
-    if (!startDate || !endDate) {
-      setError('Elegí la fecha de inicio y de fin.');
+    if (!startDate || (type === 'metric' && !endDate)) {
+      setError(type === 'metric' ? 'Elegí la fecha de inicio y de fin.' : 'Elegí la fecha de inicio.');
       return;
     }
     const startIso = toISODate(startDate);
-    const endIso = toISODate(endDate);
-    if (!(endIso > startIso)) {
-      setError('La fecha de fin tiene que ser posterior a la de inicio.');
-      return;
+    let endIso = null;
+    if (type === 'metric') {
+      endIso = toISODate(endDate);
+      if (!(endIso > startIso)) {
+        setError('La fecha de fin tiene que ser posterior a la de inicio.');
+        return;
+      }
+    } else {
+      if (!route || route.coordinates.length < 2) {
+        setError('Dibujá una ruta de al menos 2 puntos en el mapa.');
+        return;
+      }
+      const radius = Number(acceptanceRadius);
+      if (!Number.isFinite(radius) || radius < 5 || radius > 500) {
+        setError('El radio de aceptación tiene que estar entre 5 y 500 metros.');
+        return;
+      }
     }
     if (selectedIds.length < 2) {
       setError('Elegí al menos 2 participantes.');
       return;
     }

     setSubmitting(true);
-    const result = await onSubmit({
-      type: 'metric',
-      metric,
-      startAt: startIso,
-      endAt: endIso,
-      participantUserIds: selectedIds,
-      groupId: groupFilter || null,
-    });
+    const result = await onSubmit({
+      type,
+      startAt: startIso,
+      ...(type === 'metric'
+        ? { metric, endAt: endIso }
+        : { route, acceptanceRadiusMeters: Number(acceptanceRadius) }),
+      participantUserIds: selectedIds,
+      groupId: groupFilter || null,
+    });
     setSubmitting(false);
```

```diff
               <View className="gap-3" nativeID="create-competition-modal-fields" testID="create-competition-modal-fields">
-                <ResponsiveSelectField dense label="Métrica" onChange={setMetric} options={METRIC_OPTIONS} value={metric} />
-
-                <Row>
-                  <Col>
-                    <DateField label="Desde" onChange={setStartDate} value={startDate} />
-                  </Col>
-                  <Col>
-                    <DateField label="Hasta" onChange={setEndDate} value={endDate} />
-                  </Col>
-                </Row>
+                <ResponsiveSelectField dense label="Tipo de competencia" onChange={setType} options={TYPE_OPTIONS} value={type} />
+
+                {type === 'metric' ? (
+                  <>
+                    <ResponsiveSelectField dense label="Métrica" onChange={setMetric} options={METRIC_OPTIONS} value={metric} />
+                    <Row>
+                      <Col>
+                        <DateField label="Desde" onChange={setStartDate} value={startDate} />
+                      </Col>
+                      <Col>
+                        <DateField label="Hasta" onChange={setEndDate} value={endDate} />
+                      </Col>
+                    </Row>
+                  </>
+                ) : (
+                  <>
+                    <DateField label="Desde" onChange={setStartDate} value={startDate} />
+                    <RouteDrawPicker onChange={setRoute} value={route} />
+                    <InputField className="mb-0" dense keyboardType="numeric" label="Radio de aceptación (metros)" onChange={setAcceptanceRadius} value={acceptanceRadius} />
+                  </>
+                )}
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add components/team/create-competition-modal.jsx
git commit -m "feat(competitions): type=route branch in CreateCompetitionModal"
```

---

### Task 6: Entry point — "Correr esta trayectoria"

**Files:**
- Modify: `components/team/competitions-tab.jsx`

**Interfaces:**
- Consumes: `createCompetitionAttempt` (Task 4, via a new wrapper in `use-competitions.js`),
  `useSessionRuntimeStore` (existing, `store/session-runtime-store.js`), `isWeb`
  (`utils/platform.js`).
- Produces: botón nuevo en `CompetitionRow` para `type==='route'`, `status==='active'`,
  participante — navega a `/training-session` con un `pendingSession` sintético.

- [ ] **Step 1: Add the mutation to `use-competitions.js`, and make `wrap` propagate the resolved value**

`handleRun` (Step 2) necesita el `session_instance` que devuelve
`createCompetitionAttempt` — pero `wrap()` hoy descarta el valor resuelto de `mutateAsync`
(`await mutateAsync(...args); return {success:true}`, sin guardar nada). Se corrige para TODAS
las mutaciones (campo `data` nuevo, inocuo para los 5 callers existentes que solo miran
`.success`/`.error`).

```diff
--- a/hooks/use-competitions.js
+++ b/hooks/use-competitions.js
@@
 import {
   listCompetitions,
   createCompetition as createCompetitionService,
   approveCompetition as approveCompetitionService,
   rejectCompetition as rejectCompetitionService,
   cancelCompetition as cancelCompetitionService,
   closeCompetition as closeCompetitionService,
+  createCompetitionAttempt as createCompetitionAttemptService,
 } from '../services/competitions.js';
```

```diff
   const closeMutation = useMutation({ mutationFn: closeCompetitionService, onSuccess: invalidate });
+  // Sin invalidate -- correr un intento no cambia el status/listado de la
+  // competencia, solo crea el runner_session sintético del lado backend.
+  const attemptMutation = useMutation({ mutationFn: ({ id, athleteUserId }) => createCompetitionAttemptService(id, athleteUserId) });
```

```diff
   const wrap = (mutateAsync) => async (...args) => {
     try {
-      await mutateAsync(...args);
-      return { success: true };
+      const data = await mutateAsync(...args);
+      return { success: true, data };
     } catch (error) {
       return { success: false, error: error.message };
     }
   };
```

```diff
   return {
     createCompetition: wrap(createMutation.mutateAsync),
     approveCompetition: wrap(approveMutation.mutateAsync),
     rejectCompetition: (id, reason) => wrap(rejectMutation.mutateAsync)({ id, reason }),
     cancelCompetition: wrap(cancelMutation.mutateAsync),
     closeCompetition: wrap(closeMutation.mutateAsync),
+    createCompetitionAttempt: (id, athleteUserId) => wrap(attemptMutation.mutateAsync)({ id, athleteUserId }),
     isCreating: createMutation.isPending,
     isApproving: approveMutation.isPending,
     isRejecting: rejectMutation.isPending,
     isCancelling: cancelMutation.isPending,
     isClosing: closeMutation.isPending,
+    isStartingAttempt: attemptMutation.isPending,
   };
```

- [ ] **Step 2: Add the button in `CompetitionRow` + handler in `CompetitionsTab`**

```diff
--- a/components/team/competitions-tab.jsx
+++ b/components/team/competitions-tab.jsx
@@
+import { useState } from 'react';
+import { useRouter } from 'expo-router';
+import { isWeb } from '../../utils/platform.js';
+import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
```

(`useState`/`useEffect` ya están importados arriba — agregar solo lo que falte.)

```diff
-function CompetitionRow({ competition, members, isTrainerView, currentUserId, onApprove, onReject, onCancel, onClose, busy }) {
+function CompetitionRow({ competition, members, isTrainerView, currentUserId, onApprove, onReject, onCancel, onClose, onRun, attemptBlocked, busy }) {
   const colors = useThemeColors();
   const [expanded, setExpanded] = useState(false);
   const statusMeta = STATUS_META[competition.status] ?? STATUS_META.rejected;
   const idPrefix = `competitions-tab-row-${competition.id}`;

   const isOwnPendingProposal = competition.status === 'pending_approval' && competition.createdByRole === 'runner' && competition.createdByUserId === currentUserId;
   const canClose = isTrainerView && competition.status === 'active' && competition.endAt && competition.endAt < new Date().toISOString().slice(0, 10);
+  const canRun = !isTrainerView && competition.type === 'route' && competition.status === 'active' && competition.participantUserIds.includes(currentUserId);
```

```diff
         {canClose && (
           <Pressable className="h-9 flex-1 items-center justify-center rounded-full border border-amber-300 active:opacity-80 disabled:opacity-60 dark:border-amber-700" disabled={busy} nativeID={`${idPrefix}-close-button`} onPress={() => onClose(competition.id)} testID={`${idPrefix}-close-button`}>
           <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-close-label`} testID={`${idPrefix}-close-label`}>Cerrar</Text>
         </Pressable>
         )}
+        {canRun && isWeb && (
+          <Text className="flex-1 rounded-full bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" nativeID={`${idPrefix}-run-web-notice`} testID={`${idPrefix}-run-web-notice`}>
+            Correr una trayectoria solo está disponible en la app nativa
+          </Text>
+        )}
+        {canRun && !isWeb && (
+          <Pressable className="h-9 flex-1 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-60" disabled={busy || attemptBlocked} nativeID={`${idPrefix}-run-button`} onPress={() => onRun(competition)} testID={`${idPrefix}-run-button`}>
+            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-run-label`} testID={`${idPrefix}-run-label`}>
+              {attemptBlocked ? 'Ya corriste esta trayectoria' : 'Correr esta trayectoria'}
+            </Text>
+          </Pressable>
+        )}
```

```diff
 export function CompetitionsTab({ teamId, members, groups, isTrainerView, currentUserId }) {
   const colors = useThemeColors();
+  const router = useRouter();
+  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);
   const { competitions, loading, error } = useCompetitions(teamId);
   const mutations = useCompetitionMutations(teamId);
   const { ackSection } = useGamificationBadge();
   const [createVisible, setCreateVisible] = useState(false);
   const [rejectTargetId, setRejectTargetId] = useState(null);
+  // Sin intento previo barato de consultar en v1 (Gap 33 punto 26, spec
+  // "Entry point") -- el 400 del backend es la fuente de verdad, esto solo
+  // deshabilita el botón localmente DESPUÉS de un primer intento exitoso o
+  // fallido por "ya tenés intento", para esta sesión de la app.
+  const [blockedCompetitionIds, setBlockedCompetitionIds] = useState([]);
```

```diff
+  const handleRun = async (competition) => {
+    const result = await mutations.createCompetitionAttempt(competition.id, currentUserId);
+    if (!result.success) {
+      setBlockedCompetitionIds((prev) => [...prev, competition.id]);
+      notifyError();
+      Toast.show({ type: 'error', text1: 'No pudimos arrancar el intento', text2: result.error });
+      return;
+    }
+    setPendingSession({
+      teamId,
+      date: new Date().toISOString().slice(0, 10),
+      sessionInstance: result.data.session_instance,
+      routeAttempt: { route: competition.route, acceptanceRadiusMeters: competition.acceptanceRadiusMeters, competitionId: competition.id },
+    });
+    router.push('/training-session');
+  };
+
   const busy = mutations.isApproving || mutations.isRejecting || mutations.isCancelling || mutations.isClosing;
```

```diff
             <CompetitionRow
+              attemptBlocked={blockedCompetitionIds.includes(competition.id)}
               busy={busy}
               competition={competition}
               currentUserId={currentUserId}
               isTrainerView={isTrainerView}
               key={competition.id}
               members={members}
               onApprove={handleApprove}
               onCancel={handleCancel}
               onClose={handleClose}
+              onRun={handleRun}
               onReject={setRejectTargetId}
             />
```

`createCompetitionAttemptService` (`services/competitions.js`, Task 4) devuelve
`{session_instance_id, session_instance}` del mock — con el fix de `wrap()` del Step 1,
`result.data` ya trae ese objeto tal cual (snake_case, el mock no pasa por ningún normalizer
propio porque `session_instance` acá es un shape ad-hoc de la instancia sintética, no una
competencia) — de ahí `result.data.session_instance` en `handleRun` arriba.

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-competitions.js components/team/competitions-tab.jsx
git commit -m "feat(competitions): entry point — Correr esta trayectoria"
```

---

### Task 7: `LiveTrajectoryMap` (nativo + web, genérico)

**Files:**
- Create: `components/session-runtime/live-trajectory-map.jsx` (nativo)
- Create: `components/session-runtime/live-trajectory-map.web.jsx` (web)

**Interfaces:**
- Consumes: `computeBounds` (`utils/map-bounds.js`, ya existe).
- Produces: `<LiveTrajectoryMap traveledPoints={[{latitude,longitude}]} referenceRoute={geojson|
  null} />`. Sin prop de competencia/radio a propósito (nombre/props genéricos, ver spec — el
  encaje con `acceptanceRadiusMeters` queda para cuando se quiera dibujar el círculo de
  tolerancia, no en este primer corte). Used by Task 8 (`SeriesView`) y Task 9 (pantalla de
  resultado).

- [ ] **Step 1: Write the native version**

```jsx
// components/session-runtime/live-trajectory-map.jsx
import { useRef } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Mapa real con la trayectoria recorrida (y opcionalmente una ruta de
// referencia marcada) -- diseñado genérico a propósito (Spec 4c): esta
// spec solo lo usa para intentos de competencia de ruta, pero no le
// hardcodea nada de ese dominio (el caller decide si pasa `referenceRoute`
// o no). Pensado para reusarse en la mejora futura de "trayectoria de toda
// la sesión" (sin ruta de referencia, solo lo recorrido).
export function LiveTrajectoryMap({ traveledPoints, referenceRoute }) {
  const cameraRef = useRef(null);

  const traveledGeojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: (traveledPoints ?? []).map((p) => [p.longitude, p.latitude]) },
    properties: {},
  };

  const boundsSource = [
    ...(traveledPoints ?? []),
    ...(referenceRoute?.coordinates ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
  ];
  const bounds = computeBounds(boundsSource);
  const initialCenter = traveledPoints?.[0]
    ? [traveledPoints[0].longitude, traveledPoints[0].latitude]
    : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];

  return (
    <View className="h-64 overflow-hidden rounded-2xl" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <Map mapStyle={OPENFREEMAP_STYLE_URL} nativeID="live-trajectory-map" style={{ flex: 1 }} testID="live-trajectory-map">
        <Camera bounds={bounds ?? undefined} initialViewState={{ center: initialCenter, zoom: 14 }} padding={40} ref={cameraRef} />
        {referenceRoute?.coordinates?.length > 1 && (
          <GeoJSONSource id="live-trajectory-map-reference-source" shape={{ type: 'Feature', geometry: referenceRoute, properties: {} }}>
            <Layer id="live-trajectory-map-reference-layer" style={{ lineColor: '#94a3b8', lineWidth: 3, lineDasharray: [2, 2] }} type="line" />
          </GeoJSONSource>
        )}
        {traveledPoints?.length > 1 && (
          <GeoJSONSource id="live-trajectory-map-traveled-source" shape={traveledGeojson}>
            <Layer id="live-trajectory-map-traveled-layer" style={{ lineColor: '#8cc63e', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}
```

- [ ] **Step 2: Write the web version**

```jsx
// components/session-runtime/live-trajectory-map.web.jsx
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

export function LiveTrajectoryMap({ traveledPoints, referenceRoute }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const initialCenter = traveledPoints?.[0] ? [traveledPoints[0].longitude, traveledPoints[0].latitude] : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
    const map = new maplibregl.Map({ container: containerRef.current, style: OPENFREEMAP_STYLE_URL, center: initialCenter, zoom: 14, interactive: false });
    map.on('load', () => {
      map.addSource('live-trajectory-map-traveled', { type: 'geojson', data: EMPTY_LINE });
      map.addLayer({ id: 'live-trajectory-map-traveled-layer', type: 'line', source: 'live-trajectory-map-traveled', paint: { 'line-color': '#8cc63e', 'line-width': 4 } });
      if (referenceRoute?.coordinates?.length > 1) {
        map.addSource('live-trajectory-map-reference', { type: 'geojson', data: { type: 'Feature', geometry: referenceRoute, properties: {} } });
        map.addLayer({ id: 'live-trajectory-map-reference-layer', type: 'line', source: 'live-trajectory-map-reference', paint: { 'line-color': '#94a3b8', 'line-width': 3, 'line-dasharray': [2, 2] } });
      }
    });
    requestAnimationFrame(() => map.resize());
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
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
    <View className="h-64 overflow-hidden rounded-2xl" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
```

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/live-trajectory-map.jsx components/session-runtime/live-trajectory-map.web.jsx
git commit -m "feat(session-runtime): LiveTrajectoryMap — reusable route+traveled path map"
```

---

### Task 8: Extender `training-session-active-screen.jsx` — modo ruta

**Files:**
- Modify: `components/session-runtime/training-session-active-screen.jsx`

**Interfaces:**
- Consumes: `LiveTrajectoryMap` (Task 7).
- Produces: cuando `pendingSession.routeAttempt` está presente, `TrainingSessionActiveScreenContent`
  salta directo a la serie única, `SeriesView` muestra el mapa en vivo en vez del cronómetro
  circular y oculta el flujo de saltear, y al terminar navega a `/route-attempt-result` en vez de
  `SessionCompleteModal`.

**Riesgo:** archivo grande y ya probado en producción — cada cambio es un bloque chico y aislado,
gateado por `pendingSession?.routeAttempt`/`routeAttempt` (nunca toca la rama sin ese flag).

- [ ] **Step 1: Import + saltar a la serie única en el bootstrap**

```diff
--- a/components/session-runtime/training-session-active-screen.jsx
+++ b/components/session-runtime/training-session-active-screen.jsx
@@
 import { useGpsTracker } from '../../hooks/use-gps-tracker.js';
 import { logDebug } from '../../utils/debug-log.js';
+import { LiveTrajectoryMap } from './live-trajectory-map';
```

```diff
       setBooted(true);
+      // Spec 4c -- con 1 solo ejercicio/serie (instancia sintética de una
+      // competencia de ruta), salta directo a la vista de serie: el
+      // listado de ejercicios no aporta nada con una sola fila.
+      if (pendingSession.routeAttempt && bootSets.length === 1 && bootSets[0].status === 'pending') {
+        setCurrentSetId(bootSets[0].id);
+        setMode('series');
+      }
     } catch (error) {
```

- [ ] **Step 2: Pasar `routeAttempt` a `SeriesView` + mapear la navegación final**

```diff
         ) : currentSet ? (
           <SeriesView
             gpsEnabled={storeGpsEnabled}
             key={currentSet.id}
             onAdvance={handleAdvance}
             onBack={() => setMode('overview')}
             onCancelConfirmed={handleCancelConfirmed}
             onDataChanged={reloadSets}
             runId={run.id}
+            routeAttempt={pendingSession.routeAttempt ?? null}
             set={currentSet}
             totalSeriesForExercise={sets.filter((s) => s.exercise_instance_id === currentSet.exercise_instance_id).length}
           />
```

```diff
       if (next) {
         ...
       } else {
         await finalizeRun(run.id);
         logDebug('handleAdvance: sin series pendientes — finalizo run');
-        setMode('overview');
-        setSessionCompleteVisible(true);
+        if (pendingSession.routeAttempt) {
+          clearLiveSession();
+          router.replace({
+            pathname: '/route-attempt-result',
+            params: {
+              competitionId: pendingSession.routeAttempt.competitionId,
+              distanceMeters: String(sets[0]?.distance_meters ?? 0),
+              durationMs: String(sets[0]?.duration_ms ?? 0),
+            },
+          });
+          return;
+        }
+        setMode('overview');
+        setSessionCompleteVisible(true);
       }
```

(`sets` en ese punto todavía puede estar desactualizado respecto a lo que `finalizeRun`/`finishSet`
ya persistió — usar `all` en su lugar, la variable ya resuelta un par de líneas arriba en el mismo
`try`, que es exactamente el array recién leído con `getSetsForRun`.)

- [ ] **Step 3: `SeriesView` — prop + acumular puntos para el mapa**

```diff
-function SeriesView({ set, runId, gpsEnabled, totalSeriesForExercise, onAdvance, onBack, onCancelConfirmed, onDataChanged }) {
+function SeriesView({ set, runId, gpsEnabled, totalSeriesForExercise, onAdvance, onBack, onCancelConfirmed, onDataChanged, routeAttempt }) {
   const colors = useThemeColors();
   const stopwatch = useStopwatch();
   const gps = useGpsTracker(gpsEnabled);
   const [phase, setPhase] = useState(() => (set.status === 'started' && !set.ended_at ? 'paused' : 'ready'));
   const [countdown, setCountdown] = useState(3);
   const [distance, setDistance] = useState(set.distance_meters ?? null);
+  const [tracePoints, setTracePoints] = useState([]);
```

```diff
   const handleGpsPoint = async ({ latitude, longitude, timestamp, accuracy }) => {
     if (!gpsActiveRef.current) return;
     const point = { latitude, longitude, timestamp, accuracy };
     if (!lastPointRef.current) {
       lastPointRef.current = point;
       pointOrderRef.current = 0;
       clearGpsGrace();
       setGpsWarning(false);
       await insertGpsPoint(set.id, 0, latitude, longitude, timestamp ?? Date.now());
       distanceRef.current = 0;
       setDistance(0);
       await updateSetDistance(set.id, 0);
+      if (routeAttempt) setTracePoints((prev) => [...prev, { latitude, longitude }]);
       return;
     }
     const leg = acceptGpsLeg({ from: lastPointRef.current, to: point });
     if (leg == null) {
       logDebug(`gps punto descartado acc=${accuracy} (ruido o salto)`);
       return;
     }
     lastPointRef.current = point;
     pointOrderRef.current += 1;
     await insertGpsPoint(set.id, pointOrderRef.current, latitude, longitude, timestamp ?? Date.now());
+    if (routeAttempt) setTracePoints((prev) => [...prev, { latitude, longitude }]);
     if (leg > 0) {
```

- [ ] **Step 4: `SeriesView` — reemplazar el área del cronómetro y ocultar "Saltear" en modo ruta**

```diff
         <View className="flex-1 items-center justify-center" nativeID={`${idPrefix}-timer-area`} testID={`${idPrefix}-timer-area`}>
+          {routeAttempt && <LiveTrajectoryMap referenceRoute={routeAttempt.route} traveledPoints={tracePoints} />}
           {distance != null && (
             <View className="mb-4 flex-row items-center gap-2 rounded-full bg-emerald-50 px-5 py-2 dark:bg-emerald-900/20" nativeID={`${idPrefix}-gps-pill`} testID={`${idPrefix}-gps-pill`}>
```

```diff
-        {phase === 'ready' && (
+        {phase === 'ready' && !routeAttempt && (
           <View className="mb-4" nativeID={`${idPrefix}-skip-hint`} testID={`${idPrefix}-skip-hint`}>
```

```diff
               <View className="flex-row gap-3" nativeID={`${idPrefix}-secondary-controls`} testID={`${idPrefix}-secondary-controls`}>
-                <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
-                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="skip-next" size={18} />
-                </Pressable>
+                {!routeAttempt && (
+                  <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
+                    <MaterialCommunityIcons color={colors.onSurfaceVariant} name="skip-next" size={18} />
+                  </Pressable>
+                )}
                 <DragToFinishButton disabled={false} idPrefix={idPrefix} onTrigger={handleFinish} />
               </View>
```

```diff
-      <SkipMenuModal visible={skipVisible} onCancel={() => setSkipVisible(false)} onSkipSeries={skipSeries} onSkipExercise={skipExercise} busy={busy} />
+      {!routeAttempt && <SkipMenuModal visible={skipVisible} onCancel={() => setSkipVisible(false)} onSkipSeries={skipSeries} onSkipExercise={skipExercise} busy={busy} />}
       <FinishSummaryModal summary={summary ?? { wallMs: 0, activeMs: 0 }} onClose={onAdvance} visible={summary != null && phase === 'finishing'} />
```

- [ ] **Step 5: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green — este archivo no tiene tests propios (convención del repo, sin tests de
render), pero `npm test` confirma que nada en `services/session-db.js`/`session-sync.js` que SÍ
tiene tests se vio afectado (no debería, no se tocó ninguno de los dos).

- [ ] **Step 6: Commit**

```bash
git add components/session-runtime/training-session-active-screen.jsx
git commit -m "feat(competitions): route attempt mode in training-session-active-screen"
```

---

### Task 9: Pantalla de resultado

**Files:**
- Create: `components/session-runtime/route-attempt-result-screen.jsx`
- Create: `app/route-attempt-result.jsx`

**Interfaces:**
- Consumes: `getCompetition` (Task 4), `LiveTrajectoryMap` (Task 7), `formatMeters`/
  `formatStopwatch` (existentes).
- Produces: pantalla en `/route-attempt-result?competitionId=&distanceMeters=&durationMs=`.

- [ ] **Step 1: Write the screen**

```jsx
// components/session-runtime/route-attempt-result-screen.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { getCompetition } from '../../services/competitions.js';
import { toCompetitionModel } from '../../services/normalizers.js';
import { formatMeters } from '../../utils/distance.js';
import { formatStopwatch } from '../../utils/time.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 2000;

// Resultado de un intento de competencia de ruta (Spec 4c) -- el % de
// coincidencia se calcula server-side y puede no estar listo apenas
// termina el intento local, de ahí el reintento corto con backoff antes de
// mostrar "se está procesando". Distancia/tiempo propios vienen de los
// params de navegación (inmediatos, del run local) -- no esperan a nadie.
export function RouteAttemptResultScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const [competition, setCompetition] = useState(null);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async (attempt) => {
      try {
        const res = await getCompetition(params.competitionId);
        const model = toCompetitionModel(res.data ?? res);
        if (cancelled) return;
        setCompetition(model);
      } catch {
        // sigue reintentando hasta agotar POLL_ATTEMPTS
      }
      if (!cancelled && attempt < POLL_ATTEMPTS) {
        setTimeout(() => poll(attempt + 1), POLL_DELAY_MS);
      } else if (!cancelled) {
        setExhausted(true);
      }
    };
    poll(1);
    return () => { cancelled = true; };
  }, [params.competitionId]);

  const distanceMeters = Number(params.distanceMeters ?? 0);
  const durationMs = Number(params.durationMs ?? 0);

  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="route-attempt-result-screen-root" testID="route-attempt-result-screen-root">
        <View className="flex-1 p-4" nativeID="route-attempt-result-screen-content" testID="route-attempt-result-screen-content">
          <Text className="mb-3 text-center text-2xl font-bold text-slate-900 dark:text-white" nativeID="route-attempt-result-screen-title" testID="route-attempt-result-screen-title">
            Resultado de tu intento
          </Text>

          <LiveTrajectoryMap referenceRoute={competition?.route ?? null} traveledPoints={[]} />

          <View className="mt-4 flex-row justify-around" nativeID="route-attempt-result-screen-stats" testID="route-attempt-result-screen-stats">
            <View nativeID="route-attempt-result-screen-distance" testID="route-attempt-result-screen-distance">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-result-screen-distance-label" testID="route-attempt-result-screen-distance-label">Distancia</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-result-screen-distance-value" testID="route-attempt-result-screen-distance-value">{formatMeters(distanceMeters)}</Text>
            </View>
            <View nativeID="route-attempt-result-screen-duration" testID="route-attempt-result-screen-duration">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-result-screen-duration-label" testID="route-attempt-result-screen-duration-label">Tiempo</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-result-screen-duration-value" testID="route-attempt-result-screen-duration-value">{formatStopwatch(durationMs)}</Text>
            </View>
          </View>

          <View className="mt-4 items-center" nativeID="route-attempt-result-screen-match" testID="route-attempt-result-screen-match">
            {!competition && !exhausted && (
              <View className="flex-row items-center gap-2" nativeID="route-attempt-result-screen-calculating" testID="route-attempt-result-screen-calculating">
                <ActivityIndicator color={colors.primary} size="small" />
                <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="route-attempt-result-screen-calculating-label" testID="route-attempt-result-screen-calculating-label">Calculando resultado…</Text>
              </View>
            )}
            {!competition && exhausted && (
              <Text className="text-center text-sm text-amber-600 dark:text-amber-400" nativeID="route-attempt-result-screen-pending" testID="route-attempt-result-screen-pending">
                Se está procesando — revisá más tarde en la pestaña Competencias.
              </Text>
            )}
          </View>

          <Pressable className="mt-auto h-12 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80" nativeID="route-attempt-result-screen-close-button" onPress={() => router.replace('/')} testID="route-attempt-result-screen-close-button">
            <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-result-screen-close-label" testID="route-attempt-result-screen-close-label">Listo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </MobileOnlyRoute>
  );
}
```

- [ ] **Step 2: Write the route**

```jsx
// app/route-attempt-result.jsx
import { RouteAttemptResultScreen } from '../components/session-runtime/route-attempt-result-screen.jsx';

export default function RouteAttemptResult() {
  return <RouteAttemptResultScreen />;
}
```

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/route-attempt-result-screen.jsx app/route-attempt-result.jsx
git commit -m "feat(competitions): route attempt result screen"
```

---

### Task 10: Final verification + manual test script

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including every new test file from Tasks 1/2/4.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Grep-check `nativeID`/`testID` balance on every new/modified file**

```bash
for f in utils/route-geometry.js hooks/use-route-draw-picker.js components/team/route-draw-picker.jsx components/team/route-draw-picker.web.jsx services/competitions.js services/__mocks__/competitions-mock.js components/team/create-competition-modal.jsx hooks/use-competitions.js components/team/competitions-tab.jsx components/session-runtime/live-trajectory-map.jsx components/session-runtime/live-trajectory-map.web.jsx components/session-runtime/training-session-active-screen.jsx components/session-runtime/route-attempt-result-screen.jsx app/route-attempt-result.jsx; do
  n=$(grep -o 'nativeID=' "$f" | wc -l); t=$(grep -o 'testID=' "$f" | wc -l)
  result="OK"; [ "$n" != "$t" ] && result="MISMATCH"
  echo "$f: nativeID=$n testID=$t $result"
done
```

Expected: `nativeID` count equals `testID` count on every line.

- [ ] **Step 4: Output the manual test script (paste verbatim in the final chat reply — do not skip)**

```
Manual test script — Gamificación Spec 4c (Competencias por trayectoria)

Setup: EXPO_PUBLIC_USE_MOCKS=true. El dibujo de ruta y la creación andan en web; correr un
intento necesita GPS real -- probar esa parte en dispositivo/emulador Android, no en preview web.

Web (crear):
1. Pestaña Competencias de un equipo -> "Nueva competencia" -> tipo "Por trayectoria".
   Confirmar que desaparecen métrica y "Hasta", aparece el mapa de dibujo y "Radio de aceptación".
2. Click varios puntos en el mapa -> confirmar que la polilínea se dibuja en vivo y el contador de
   metros/vértices sube. Click "Deshacer" -> confirmar que sale el último punto. "Limpiar" ->
   confirmar que vacía todo.
3. Intentar confirmar con 1 solo punto -> no deja (botón deshabilitado). Con 2+, confirmar ->
   vuelve al form con la ruta cargada.
4. Radio fuera de [5,500] (ej. 1000) -> confirmar que el submit tira error antes de mandar nada.
5. Completar bien (ruta + radio + 2 participantes) -> guardar -> confirmar que aparece en la
   lista, tipo "Por trayectoria" en los metadatos de la fila.
6. Mismo flujo angostando el viewport -- no debe romperse en ningún punto intermedio.

Mobile (correr):
7. Como corredor participante de esa competencia: confirmar botón "Correr esta trayectoria" en la
   fila (status Activa). En web, confirmar que en su lugar aparece el aviso "solo en la app
   nativa" -- NO el botón.
8. Tocar "Correr esta trayectoria" -- confirmar que entra al pre-start normal (nombre "Corrida",
   1 ejercicio) y de ahí a la pantalla en vivo salta DIRECTO a la vista de la serie (sin pasar por
   un listado de ejercicios).
9. En la vista de la serie: confirmar que se ve un mapa real (no el cronómetro circular de antes)
   con la ruta marcada (línea punteada gris) -- sin botón "Saltear" en ningún estado.
10. Caminar/simular movimiento -- confirmar que la trayectoria recorrida (línea verde) crece en el
    mapa en vivo, y que distancia/tiempo siguen actualizándose igual que antes.
11. Terminar el intento (deslizar para terminar) -- confirmar que NO aparece el modal genérico de
    "sesión completada", sino que navega directo a la pantalla de resultado.
12. En la pantalla de resultado: confirmar mapa + distancia/tiempo inmediatos, y el estado de
    "Calculando resultado…" (el mock de GET /competitions/{id} debería resolver rápido -- si no
    resuelve en los 3 intentos, confirmar que cae al mensaje de "se está procesando").
13. Tocar "Correr esta trayectoria" una SEGUNDA vez en la misma competencia (volver a la pestaña
    Competencias) -- confirmar que el botón ahora dice "Ya corriste esta trayectoria" y está
    deshabilitado (o, si se refrescó el mock, que el segundo intento real tira el error y lo
    deshabilita recién ahí).
```

- [ ] **Step 5: Confirm clean working tree**

```bash
git status --porcelain
```

Expected: clean.
