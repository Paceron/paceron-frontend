# Route Attempt Live Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic single-"series" training screen for route-competition attempts with a dedicated, map-first live screen that auto-finalizes on timeout/route-drift/competition-closed in addition to the existing manual pause/finish/cancel controls, and fix the two real bugs in the result screen's map.

**Architecture:** New screen (`route-attempt-live-screen.jsx`) and route (`/route-attempt-live`) built directly on the existing low-level primitives (`services/session-db.js`, `services/session-sync.js`, `hooks/use-stopwatch.js`, `hooks/use-gps-tracker.js`) with its own simplified phase machine (no multi-set/skip/overview concepts, since a route attempt is always exactly one set). `route-attempt-pre-start-screen.jsx#handlePlay` is repointed to the new route; the dead `routeAttempt`-specific branches in `training-session-active-screen.jsx` are removed once nothing reaches them anymore. `LiveTrajectoryMap` gets a sizing/style/markers fix shared by the new live screen and the existing result screen; the result screen also gets its real bug fixed (it was passing a hardcoded empty array instead of the actual recorded GPS points).

**Tech Stack:** React Native + Expo Router, `@maplibre/maplibre-react-native`, `react-native-reanimated` + `react-native-gesture-handler` (drag-to-finish/pause sliders, already-proven pattern), Zustand (`session-runtime-store.js`, `live-session-store.js`), TanStack Query (`useCompetitionDetail`), SQLite via `expo-sqlite` (`services/session-db.js`), Jest for pure-function tests.

**Spec:** `docs/superpowers/specs/2026-10-19-route-attempt-live-screen-design.md`

## Global Constraints

- Every visual component (`View`, `Text`, `Pressable`, `Image`, `ScrollView`, `Modal`, `SafeAreaView`, incl. `Animated.*`) needs both `nativeID` and `testID`, kebab-case, unique in its screen (project-wide rule, enforced by `local/require-native-id` lint rule).
- No component render tests (project convention) — only pure-function logic gets Jest tests.
- `npm test` and `npm run lint` must be green before every commit.
- Drift-detection radius: 3× the competition's configured `acceptance_radius_meters` (not the radius itself — that stays reserved for the backend's end-of-attempt %-match calculation).
- Timeout: `max(30 minutes, (totalRouteMeters / 1000) * 12 min/km * 2)` — derived from route length, never a flat constant.
- "Competencia cerrada por el entrenador" = polling `GET /competitions/{id}` for `status !== 'active'`, NOT a new WebSocket control message.
- Hold-to-cancel stays in the control set, de-emphasized (smaller/lower) relative to the two sliders — not removed.
- Do **not** consolidate `HoldToCancelButton`/`DragToFinishButton`/`CountdownOverlay` into a shared component in this plan — apply the background-color fix to each of the existing 3 copies independently, and give the new screen its own 4th local copy. Consolidation is explicitly deferred.
- All new/modified files live under `components/session-runtime/`, `app/`, `utils/`, or `hooks/` — follow existing per-screen file conventions (large single-file screens with local, non-exported helper components, matching `training-session-active-screen.jsx`'s own style).
- Known, accepted limitation (not solved by this plan): if the native process is killed mid-attempt (not just backgrounded), `pendingSession` (Zustand, unpersisted) is lost and the user cannot resume via the UI without re-attempting `POST /competitions/{id}/attempts`, which the backend/mock rejects (no retries in v1). This is the same pre-existing limitation regular training sessions have; a full fix needs a backend contract change (idempotent attempts endpoint) that belongs to a later sub-project, not this one. What this plan **does** guard against cheaply: the hardware/gesture back button while an attempt is actively running must not silently pop back to the pre-start screen (which would let the user re-trigger `createCompetitionAttempt` and hit that rejection) — it must show the same cancel-confirmation flow as the Cancel control.

---

## File Structure

**Create:**
- `app/route-attempt-live.jsx` — route registration, trivial.
- `components/session-runtime/route-attempt-live-screen.jsx` — the new screen: bootstrap, phase machine, GPS handling, controls (local `CountdownOverlay`/`HoldToCancelButton`/`DragToFinishButton`/`ConfirmCancelModal` copies), auto-finalize triggers.

**Modify:**
- `utils/route-geometry.js` — add `distanceToRouteMeters` and `computeRouteTimeoutMs`.
- `hooks/use-competitions.js` — `useCompetitionDetail` accepts and forwards `refetchInterval`.
- `components/session-runtime/live-trajectory-map.jsx` — fill its container instead of a fixed height, switch to the "clean" map style, add start/end markers.
- `components/session-runtime/route-attempt-result-screen.jsx` — accept a `setId` nav param, fetch the real traveled GPS points with it.
- `components/session-runtime/training-session-active-screen.jsx` — background-color fix for its local `HoldToCancelButton`/`DragToFinishButton`; later, removal of the now-dead `routeAttempt` branches.
- `components/session-runtime/training-session-live-screen.jsx` — same background-color fix.
- `components/session-runtime/trainer-session-live-screen.jsx` — same background-color fix (its `DragToFinishButton` only; it has no `HoldToCancelButton`).
- `components/session-runtime/route-attempt-pre-start-screen.jsx` — `handlePlay` pushes `/route-attempt-live` instead of `/training-session-active`.

**Test:**
- `__tests__/route-geometry.test.js` — extended with cases for the two new functions.

---

### Task 1: Route-geometry helpers (distance-to-polyline, timeout)

**Files:**
- Modify: `utils/route-geometry.js`
- Test: `__tests__/route-geometry.test.js`

**Interfaces:**
- Produces: `distanceToRouteMeters(point, routeCoordinates)` where `point = {lat, lng}` and `routeCoordinates` is a GeoJSON-style array of `[lng, lat]` pairs (same shape `competition.route.coordinates` already uses everywhere in this codebase) → number (meters), `Infinity` if `routeCoordinates` has fewer than 2 points.
- Produces: `computeRouteTimeoutMs(totalMeters)` → number (milliseconds).

- [ ] **Step 1: Read the current file to confirm exact existing exports before editing**

Run: `sed -n '1,40p' utils/route-geometry.js` — confirm it currently exports `MAX_ROUTE_VERTICES`, `MAX_ROUTE_METERS`, `totalRouteMeters`, `routeLimitStatus`, all importing `haversineMeters` from `./distance.js`. Do not change any of those four.

- [ ] **Step 2: Write the failing tests**

Open `__tests__/route-geometry.test.js`. It currently only tests `totalRouteMeters`/`routeLimitStatus` (don't touch those tests). Add a new `import` for the two new functions and two new `describe` blocks at the end of the file:

```javascript
import { distanceToRouteMeters, computeRouteTimeoutMs } from '../utils/route-geometry.js';

describe('distanceToRouteMeters', () => {
  test('ruta con menos de 2 puntos -- Infinity', () => {
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.4 }, [[-58.4, -34.6]])).toBe(Infinity);
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.4 }, [])).toBe(Infinity);
  });

  test('punto exactamente sobre un vértice -- 0', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.4 }, route)).toBeCloseTo(0, 1);
  });

  test('punto a mitad de un segmento recto -- 0 (está sobre la línea)', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.395 }, route)).toBeCloseTo(0, 1);
  });

  test('punto perpendicular a un segmento -- distancia perpendicular real, no la del vértice más cercano', () => {
    // Segmento horizontal de ~890m (0.01 grados de longitud a esta latitud).
    // El punto está "arriba" del punto medio del segmento, a ~111m (0.001 grados de latitud).
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    const distance = distanceToRouteMeters({ lat: -34.599, lng: -58.395 }, route);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(130);
  });

  test('punto más allá del final del último segmento -- distancia al vértice final, no se extrapola', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    // Mismo offset de latitud que el caso anterior, pero en longitud MÁS ALLÁ del
    // segundo vértice -- la distancia mínima tiene que ser al vértice, no a una
    // extensión imaginaria de la línea.
    const farPoint = { lat: -34.599, lng: -58.38 };
    const distanceToEndpoint = distanceToRouteMeters({ lat: -34.6, lng: -58.39 }, route);
    const distanceFar = distanceToRouteMeters(farPoint, route);
    expect(distanceFar).toBeGreaterThan(distanceToEndpoint);
  });

  test('ruta con varios segmentos -- toma el mínimo entre todos, no solo el primero', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6], [-58.39, -34.59]];
    // Este punto está pegado al SEGUNDO segmento (vertical), lejos del primero.
    const point = { lat: -34.595, lng: -58.3895 };
    const distance = distanceToRouteMeters(point, route);
    expect(distance).toBeLessThan(100);
  });
});

describe('computeRouteTimeoutMs', () => {
  test('ruta muy corta -- usa el piso de 30 minutos, no un número casi 0', () => {
    expect(computeRouteTimeoutMs(300)).toBe(30 * 60_000);
  });

  test('ruta larga -- escala con la distancia (pace 12 min/km, margen x2), no con el piso', () => {
    // 10km a 12 min/km = 120 min estimados, x2 de margen = 240 min.
    expect(computeRouteTimeoutMs(10_000)).toBe(240 * 60_000);
  });

  test('es monótono creciente con la distancia', () => {
    expect(computeRouteTimeoutMs(20_000)).toBeGreaterThan(computeRouteTimeoutMs(10_000));
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npx jest __tests__/route-geometry.test.js`
Expected: FAIL — `distanceToRouteMeters`/`computeRouteTimeoutMs` are not exported yet.

- [ ] **Step 4: Implement the two functions**

Append to `utils/route-geometry.js` (after the existing `routeLimitStatus`, keep every existing line untouched above it):

```javascript
const METERS_PER_DEGREE_LAT = 111_320;

// Distancia mínima (metros) de un punto a cada SEGMENTO de la polilínea
// (no solo a sus vértices) -- proyección plana local (equirectangular,
// centrada en cada segmento), igual criterio de aproximación que ya usa el
// resto de este archivo/utils/map-bounds.js para distancias cortas (escala
// de una ruta de running, no geodesia de largo alcance). Pensada para el
// gate de "se alejó de la ruta esperada" durante un intento en vivo --
// comparar contra el punto de inicio solo no alcanza, un corredor puede
// desviarse a mitad de camino.
function distanceToSegmentMeters(point, a, b) {
  const midLat = (a.lat + b.lat) / 2;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((midLat * Math.PI) / 180);
  const toXY = (p) => ({
    x: (p.lng - a.lng) * metersPerDegreeLng,
    y: (p.lat - a.lat) * METERS_PER_DEGREE_LAT,
  });
  const p = toXY(point);
  const b2 = toXY(b);
  const lenSq = b2.x * b2.x + b2.y * b2.y;
  if (lenSq === 0) return Math.hypot(p.x, p.y);
  let t = (p.x * b2.x + p.y * b2.y) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - t * b2.x, p.y - t * b2.y);
}

export function distanceToRouteMeters(point, routeCoordinates) {
  const coords = routeCoordinates ?? [];
  if (coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1][1], lng: coords[i - 1][0] };
    const b = { lat: coords[i][1], lng: coords[i][0] };
    const d = distanceToSegmentMeters(point, a, b);
    if (d < min) min = d;
  }
  return min;
}

const REFERENCE_PACE_MIN_PER_KM = 12;
const TIMEOUT_MARGIN_FACTOR = 2;
const MIN_TIMEOUT_MS = 30 * 60_000;

// Timeout de un intento de ruta en vivo -- derivado del largo total, no un
// tope fijo (una ruta de 500m y una de 20km no deberían compartir número).
// Pace de referencia deliberadamente lento (caminata, no running) + margen
// x2 -- el objetivo es detectar "se olvidó la app corriendo", no apurar a
// nadie.
export function computeRouteTimeoutMs(totalMeters) {
  const estimatedMs = (totalMeters / 1000) * REFERENCE_PACE_MIN_PER_KM * 60_000;
  return Math.max(MIN_TIMEOUT_MS, estimatedMs * TIMEOUT_MARGIN_FACTOR);
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npx jest __tests__/route-geometry.test.js`
Expected: PASS, all tests including the pre-existing `totalRouteMeters`/`routeLimitStatus` ones.

- [ ] **Step 6: Lint**

Run: `npx eslint utils/route-geometry.js __tests__/route-geometry.test.js`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add utils/route-geometry.js __tests__/route-geometry.test.js
git commit -m "feat(competitions): add route drift-distance and timeout helpers"
```

---

### Task 2: `useCompetitionDetail` forwards `refetchInterval`

**Files:**
- Modify: `hooks/use-competitions.js`

**Interfaces:**
- Produces: `useCompetitionDetail(id, { enabled = true, refetchInterval } = {})` → `{ detail, loading }` (unchanged return shape; `refetchInterval` is the new accepted option, forwarded to the underlying `useQuery`, same pattern already used by `useSessionInstance` in `hooks/use-session-instance.js`).

- [ ] **Step 1: Read the current implementation**

Run: `grep -n "export function useCompetitionDetail" -A8 hooks/use-competitions.js` — confirm the current signature is `useCompetitionDetail(id, { enabled = true } = {})` with no `refetchInterval` forwarding.

- [ ] **Step 2: Edit the hook**

In `hooks/use-competitions.js`, change:

```javascript
export function useCompetitionDetail(id, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['competition', id],
    queryFn: () => getCompetition(id).then((response) => toCompetitionDetailModel(response.data ?? response)),
    enabled: Boolean(id) && enabled,
  });

  return { detail: query.data ?? null, loading: query.isLoading };
}
```

to:

```javascript
export function useCompetitionDetail(id, { enabled = true, refetchInterval } = {}) {
  const query = useQuery({
    queryKey: ['competition', id],
    queryFn: () => getCompetition(id).then((response) => toCompetitionDetailModel(response.data ?? response)),
    enabled: Boolean(id) && enabled,
    refetchInterval,
  });

  return { detail: query.data ?? null, loading: query.isLoading };
}
```

- [ ] **Step 3: Verify no existing caller breaks**

Run: `grep -rn "useCompetitionDetail(" components/ --include="*.jsx" | grep -v node_modules` — confirm every existing call site (`competitions-tab.jsx`, `competition-ranking-modal.jsx`, `route-attempt-pre-start-screen.jsx` if applicable) only ever passes `{ enabled }`, never relies on `refetchInterval` being absent/rejected. Since the new param is optional and defaults to `undefined` (TanStack Query treats `refetchInterval: undefined` as "don't poll", identical to omitting it), no existing caller's behavior changes.

- [ ] **Step 4: Lint and run the full test suite**

Run: `npx eslint hooks/use-competitions.js && npm test`
Expected: 0 lint errors; all existing tests still pass (this hook has no dedicated test file today, matching the convention already established for `use-session-instance.js`).

- [ ] **Step 5: Commit**

```bash
git add hooks/use-competitions.js
git commit -m "feat(competitions): useCompetitionDetail accepts refetchInterval"
```

---

### Task 3: Fix `LiveTrajectoryMap` sizing, style, and markers

**Files:**
- Modify: `components/session-runtime/live-trajectory-map.jsx`

**Interfaces:**
- Produces: `LiveTrajectoryMap({ traveledPoints, referenceRoute })` — same props as today (no signature change), but now fills its parent container instead of forcing a fixed 256px height, uses the "clean" map style, and draws start/end markers for `referenceRoute` when present.
- Consumes: `OPENFREEMAP_MINIMAL_STYLE_URL` from `config/maps.js` (already used by `route-map-preview.jsx`/`route-draw-picker.jsx` — confirm the exact export name before using).

- [ ] **Step 1: Confirm the minimal style constant's exact name**

Run: `grep -n "OPENFREEMAP" config/maps.js`
Expected: both `OPENFREEMAP_STYLE_URL` and `OPENFREEMAP_MINIMAL_STYLE_URL` exist as named exports.

- [ ] **Step 2: Read the current file in full**

Run: `cat components/session-runtime/live-trajectory-map.jsx` (it's 56 lines, already read in full during planning — reproduced below for reference, do not skip re-reading it in the actual implementation session since the file on disk is the source of truth).

- [ ] **Step 3: Edit the file**

Replace the full contents of `components/session-runtime/live-trajectory-map.jsx` with:

```javascript
import { useRef } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds } from '../../utils/map-bounds.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

// Mapa real con la trayectoria recorrida (y opcionalmente una ruta de
// referencia marcada) -- diseñado genérico a propósito (Spec 4c): esta
// spec solo lo usa para intentos de competencia de ruta, pero no le
// hardcodea nada de ese dominio (el caller decide si pasa `referenceRoute`
// o no). Pensado para reusarse en la mejora futura de "trayectoria de toda
// la sesión" (sin ruta de referencia, solo lo recorrido).
//
// `data` (no `shape`) en GeoJSONSource y `padding` como objeto (no número)
// en Camera -- ver CLAUDE.md, sección maplibre-react-native, para el crash
// nativo real que motivó encontrar estos dos bugs en route-map-preview.jsx
// (mismo componente de librería).
//
// Llena su contenedor (`h-full w-full`, el `Map` con `flex: 1`) en vez de
// forzar una altura fija -- bug real 2026-10-19: el caller decide cuánto
// espacio darle (antes 256px fijos, pensados para convivir con un
// cronómetro gigante que ya no existe en los callers reales de hoy).
// Estilo "limpio" (OPENFREEMAP_MINIMAL_STYLE_URL, no el estándar) para que
// coincida con route-map-preview.jsx/route-draw-picker.jsx -- antes usaba
// el estilo con más detalle visual, pedido real: "el estilo del mapa debe
// ser limpio como los demás casos". Markers de inicio/fin de
// `referenceRoute` (dot simple, sin tooltip -- esto es una vista en vivo o
// un resumen estático, no necesita tap-to-toggle) -- antes no tenía
// ninguno, bug real reportado.
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
  const referenceCoords = referenceRoute?.coordinates ?? [];

  return (
    <View className="h-full w-full overflow-hidden rounded-2xl" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <Map mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL} nativeID="live-trajectory-map" style={{ flex: 1 }} testID="live-trajectory-map">
        <Camera bounds={bounds ?? undefined} initialViewState={{ center: initialCenter, zoom: 14 }} padding={{ bottom: 40, left: 40, right: 40, top: 40 }} ref={cameraRef} />
        {referenceCoords.length > 1 && (
          <GeoJSONSource data={{ type: 'Feature', geometry: referenceRoute, properties: {} }} id="live-trajectory-map-reference-source">
            <Layer id="live-trajectory-map-reference-layer" style={{ lineColor: '#94a3b8', lineWidth: 3, lineDasharray: [2, 2] }} type="line" />
          </GeoJSONSource>
        )}
        {traveledPoints?.length > 1 && (
          <GeoJSONSource data={traveledGeojson} id="live-trajectory-map-traveled-source">
            <Layer id="live-trajectory-map-traveled-layer" style={{ lineColor: '#8cc63e', lineWidth: 4 }} type="line" />
          </GeoJSONSource>
        )}
        {referenceCoords.length >= 1 && (
          <Marker anchor="bottom" id="live-trajectory-map-start-marker" lngLat={referenceCoords[0]}>
            <View nativeID="live-trajectory-map-start-dot" style={{ backgroundColor: '#ef4444', borderColor: '#ffffff', borderRadius: 7, borderWidth: 2, height: 14, width: 14 }} testID="live-trajectory-map-start-dot" />
          </Marker>
        )}
        {referenceCoords.length >= 2 && (
          <Marker anchor="bottom" id="live-trajectory-map-end-marker" lngLat={referenceCoords[referenceCoords.length - 1]}>
            <View nativeID="live-trajectory-map-end-dot" style={{ backgroundColor: '#2563eb', borderColor: '#ffffff', borderRadius: 7, borderWidth: 2, height: 14, width: 14 }} testID="live-trajectory-map-end-dot" />
          </Marker>
        )}
      </Map>
    </View>
  );
}
```

- [ ] **Step 4: Verify nativeID/testID balance**

Run: `echo "nativeID=$(grep -c 'nativeID=' components/session-runtime/live-trajectory-map.jsx) testID=$(grep -c 'testID=' components/session-runtime/live-trajectory-map.jsx)"`
Expected: both counts equal (7 each).

- [ ] **Step 5: Lint**

Run: `npx eslint components/session-runtime/live-trajectory-map.jsx`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/session-runtime/live-trajectory-map.jsx
git commit -m "fix(competitions): LiveTrajectoryMap fills container, clean style, start/end markers"
```

Note: there is no automated test for this component (native map, project convention — see Global Constraints). Real verification happens on-device once Tasks 4 and 6 wire it into actual screens.

---

### Task 4: Fix `route-attempt-result-screen.jsx`'s traveled-path bug

**Files:**
- Modify: `components/session-runtime/route-attempt-result-screen.jsx`

**Interfaces:**
- Consumes: `getGpsPoints(setId)` from `services/session-db.js` (already exists, returns `Promise<Array<{latitude, longitude, ...}>>` ordered by `point_order`).
- Produces: this screen now reads a `setId` nav param (string) in addition to its existing `competitionId`/`distanceMeters`/`durationMs` params. Task 6 (and the dead-code removal in Task 9) must pass `setId` when navigating here.

- [ ] **Step 1: Read the current file**

Run: `cat components/session-runtime/route-attempt-result-screen.jsx` (96 lines, already read in full during planning).

- [ ] **Step 2: Edit the file**

In `components/session-runtime/route-attempt-result-screen.jsx`:

1. Add the import:

```javascript
import { getGpsPoints } from '../../services/session-db.js';
```

2. Replace the component body's state/effect setup (currently just the polling `useEffect` for `competition`) by adding a second state + effect for the traveled points, right after the existing `const [exhausted, setExhausted] = useState(false);` line:

```javascript
  const [traveledPoints, setTraveledPoints] = useState([]);

  useEffect(() => {
    if (!params.setId) return;
    let cancelled = false;
    (async () => {
      const points = await getGpsPoints(params.setId);
      if (!cancelled) setTraveledPoints(points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
    })();
    return () => { cancelled = true; };
  }, [params.setId]);
```

3. Replace the hardcoded call:

```javascript
<LiveTrajectoryMap referenceRoute={competition?.route ?? null} traveledPoints={[]} />
```

with:

```javascript
<LiveTrajectoryMap referenceRoute={competition?.route ?? null} traveledPoints={traveledPoints} />
```

4. Wrap the `<LiveTrajectoryMap .../>` line in a sized `View` so the sizing fix from Task 3 has somewhere to fill — replace that single line with:

```javascript
<View className="h-80 w-full" nativeID="route-attempt-result-screen-map-wrap" testID="route-attempt-result-screen-map-wrap">
  <LiveTrajectoryMap referenceRoute={competition?.route ?? null} traveledPoints={traveledPoints} />
</View>
```

(`h-80`, 320px — bigger than the old implicit size since the map is now meant to be legible, not an afterthought; this is a plain static result screen so a fixed height here is fine, unlike the live screen in Task 6 which needs `flex-1`.)

- [ ] **Step 3: Verify nativeID/testID balance**

Run: `echo "nativeID=$(grep -c 'nativeID=' components/session-runtime/route-attempt-result-screen.jsx) testID=$(grep -c 'testID=' components/session-runtime/route-attempt-result-screen.jsx)"`
Expected: both counts equal (one pair higher than before this task, from the new wrapping `View`).

- [ ] **Step 4: Lint**

Run: `npx eslint components/session-runtime/route-attempt-result-screen.jsx`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/session-runtime/route-attempt-result-screen.jsx
git commit -m "fix(competitions): route-attempt-result-screen reads the real traveled GPS path"
```

Note: `params.setId` will be `undefined` until Task 6 starts passing it — this is expected and safe (the `useEffect`'s guard `if (!params.setId) return;` means `traveledPoints` just stays `[]` for any attempt finished before this change, same as before, no crash). No automated test (native-only navigation params + SQLite, same convention as the rest of this module).

---

### Task 5: Background-color fix for the 3 existing slider/cancel control copies

**Files:**
- Modify: `components/session-runtime/training-session-active-screen.jsx`
- Modify: `components/session-runtime/training-session-live-screen.jsx`
- Modify: `components/session-runtime/trainer-session-live-screen.jsx`

**Interfaces:** none (purely visual `className` changes, no prop/signature changes in any of the three files).

- [ ] **Step 1: Fix `training-session-active-screen.jsx`**

In `HoldToCancelButton` (around line 113), change:

```javascript
className={`h-12 flex-row items-center justify-center gap-2 rounded-full border border-red-300 px-4 ${disabled ? 'opacity-50' : ''} dark:border-red-900/60`}
```

to:

```javascript
className={`h-12 flex-row items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-4 dark:border-red-900/60 dark:bg-surface ${disabled ? 'opacity-50' : ''}`}
```

In `DragToFinishButton`'s track (around line 235), change:

```javascript
className={`h-24 flex-1 rounded-full border ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
```

to:

```javascript
className={`h-24 flex-1 rounded-full border bg-white dark:bg-surface ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
```

- [ ] **Step 2: Fix `training-session-live-screen.jsx`**

Run: `grep -n "rounded-full border border-red-300\|h-24 flex-1 rounded-full border" components/session-runtime/training-session-live-screen.jsx` to find the two exact lines (this file has its own independent copy of both components, confirmed during planning at lines 97 and 175 — line numbers may have shifted slightly, use the grep output as the source of truth). Apply the identical two changes as Step 1 (add `bg-white dark:bg-surface` to each track/button `className`).

- [ ] **Step 3: Fix `trainer-session-live-screen.jsx`**

Run: `grep -n "const DragToFinishButton = forwardRef" -A30 components/session-runtime/trainer-session-live-screen.jsx` to see this file's variant (it uses `forwardRef`, a different prop set than the other two — do not assume the className is on the same line number as the other files). Find its track `View`'s `className` and add `bg-white dark:bg-surface` to it, same spirit as Steps 1-2. This file has no `HoldToCancelButton` (confirmed during planning) — only the one `DragToFinishButton` to fix.

- [ ] **Step 4: Visual sanity check (no automated test — these are native gesture components)**

Run: `npm run lint && npm test`
Expected: 0 lint errors, all existing tests still pass (this is a pure `className` change, no logic touched, so nothing should break).

- [ ] **Step 5: Commit**

```bash
git add components/session-runtime/training-session-active-screen.jsx components/session-runtime/training-session-live-screen.jsx components/session-runtime/trainer-session-live-screen.jsx
git commit -m "fix(session-runtime): solid background on slider/cancel pill controls (were fully transparent)"
```

---

### Task 6: Build the `route-attempt-live-screen.jsx` core (bootstrap, phase machine, controls)

**Files:**
- Create: `app/route-attempt-live.jsx`
- Create: `components/session-runtime/route-attempt-live-screen.jsx`

**Interfaces:**
- Consumes: `pendingSession` from `useSessionRuntimeStore` — by the time this screen mounts, `pendingSession.sessionInstance` and `pendingSession.routeAttempt = { route, acceptanceRadiusMeters, competitionId }` are both guaranteed present (set by `route-attempt-pre-start-screen.jsx#handlePlay` before navigating here, wired in Task 8). `pendingSession.sessionInstance.exercises[0]` is the single synthetic exercise; its one set is what this screen tracks.
- Consumes: `initSessionDb`, `getRun`, `createRun`, `getActiveRun`, `getSetsForRun`, `markSetStarted`, `insertGpsPoint`, `updateSetDistance`, `updateSetTimings`, `finishSet`, `markSetInterrupted`, `cancelRun`, `interruptStartedSets` from `services/session-db.js`; `syncRun` from `services/session-sync.js`; `useStopwatch` from `hooks/use-stopwatch.js`; `useGpsTracker` from `hooks/use-gps-tracker.js`; `acceptGpsLeg` from `utils/distance.js`; `toIsoUtc`/`formatStopwatch` from `utils/time.js`; `formatMeters` from `utils/distance.js`; `setSessionStarted`/`clearLiveSession` from `store/live-session-store.js`; `LiveTrajectoryMap` from `./live-trajectory-map.jsx` (Task 3's fixed version).
- Produces: navigates to `/route-attempt-result` with params `{ competitionId, setId, distanceMeters, durationMs }` on every terminal path (finish, timeout, drift-cancel, competition-closed-cancel, manual cancel) — this is a behavior change from today's generic flow (which only reached the result screen via the finish path; cancel went `router.back()`). This task implements the manual finish/pause/cancel paths; Task 7 adds the two automatic ones (drift, timeout, competition-closed) on top of the same finish/cancel entry points this task exposes internally.

- [ ] **Step 1: Create the route file**

```javascript
// app/route-attempt-live.jsx
import { RouteAttemptLiveScreen } from '../components/session-runtime/route-attempt-live-screen.jsx';

export default function RouteAttemptLive() {
  return <RouteAttemptLiveScreen />;
}
```

- [ ] **Step 2: Create the screen file — imports and local helper components**

Create `components/session-runtime/route-attempt-live-screen.jsx`:

```javascript
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { formatStopwatch, toIsoUtc } from '../../utils/time.js';
import { acceptGpsLeg, formatMeters } from '../../utils/distance.js';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/haptics.js';
import {
  cancelRun,
  createRun,
  finalizeRun,
  finishSet,
  getActiveRun,
  getRun,
  getSetsForRun,
  initSessionDb,
  insertGpsPoint,
  interruptStartedSets,
  markSetInterrupted,
  markSetStarted,
  updateSetDistance,
  updateSetTimings,
} from '../../services/session-db.js';
import { syncRun } from '../../services/session-sync.js';
import { useStopwatch } from '../../hooks/use-stopwatch.js';
import { useGpsTracker } from '../../hooks/use-gps-tracker.js';
import { logDebug } from '../../utils/debug-log.js';
import { LiveTrajectoryMap } from './live-trajectory-map.jsx';

const COUNTDOWN_GIF_BG = '#979597';

function CountdownOverlay({ value, onCancelCountdown }) {
  return (
    <View className="absolute inset-0 z-20 items-center justify-center rounded-3xl bg-black/70" nativeID="route-attempt-live-countdown-overlay" testID="route-attempt-live-countdown-overlay">
      <View
        className="mb-5 overflow-hidden rounded-2xl px-5 py-3"
        nativeID="route-attempt-live-countdown-overlay-animation-plate"
        style={{ backgroundColor: COUNTDOWN_GIF_BG }}
        testID="route-attempt-live-countdown-overlay-animation-plate"
      >
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Animación de un corredor corriendo"
          contentFit="contain"
          nativeID="route-attempt-live-countdown-overlay-animation"
          resizeMode="contain"
          source={require('../../assets/paceron-runner-waiting.gif')}
          style={{ height: 64, width: 114 }}
          testID="route-attempt-live-countdown-overlay-animation"
        />
      </View>
      <Text className="text-base font-semibold uppercase tracking-wide text-white/80" nativeID="route-attempt-live-countdown-overlay-label" testID="route-attempt-live-countdown-overlay-label">Empezamos en</Text>
      <Text className="mt-2 text-8xl text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="route-attempt-live-countdown-overlay-value" testID="route-attempt-live-countdown-overlay-value">{value}</Text>
      <Pressable className="mt-6 h-9 items-center justify-center rounded-full border border-white/30 px-4" nativeID="route-attempt-live-countdown-overlay-cancel" onPress={onCancelCountdown} testID="route-attempt-live-countdown-overlay-cancel">
        <Text className="text-xs font-semibold text-white" nativeID="route-attempt-live-countdown-overlay-cancel-label" testID="route-attempt-live-countdown-overlay-cancel-label">Cancelar inicio</Text>
      </Pressable>
    </View>
  );
}

// Mismas 3 copias ya duplicadas en training-session-active-screen.jsx/
// training-session-live-screen.jsx/trainer-session-live-screen.jsx -- 4ta
// copia deliberada, no se consolida en este sub-proyecto (ver spec, sección
// Arquitectura). Fondo sólido desde el día uno (a diferencia de las otras 3,
// que lo tenían transparente hasta Task 5 de este plan).
const DRAG_VARIANTS = {
  finish: {
    trackBorder: 'border-emerald-300 dark:border-emerald-800/70',
    fill: 'bg-emerald-500/20',
    thumb: 'bg-emerald-500/70 border border-emerald-600/60',
    iconColor: '#ffffff',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
  neutral: {
    trackBorder: 'border-slate-200 dark:border-slate-700/60',
    fill: 'bg-slate-300/25',
    thumb: 'bg-slate-300/80 border border-slate-400/60',
    iconColor: '#ffffff',
    label: 'text-slate-500 dark:text-slate-400',
  },
};

function DragToFinishButton({ onTrigger, disabled, idPrefix, label, icon = 'flag-checkered', variant = 'finish' }) {
  const THUMB_SIZE = 64;
  const colors = DRAG_VARIANTS[variant] || DRAG_VARIANTS.finish;
  const translateX = useSharedValue(0);
  const widthSV = useSharedValue(120);
  const triggerRef = useRef(onTrigger);
  const triggeredRef = useRef(false);
  triggerRef.current = onTrigger;

  const fillStyle = useAnimatedStyle(() => ({ width: translateX.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const pan = useMemo(() => {
    let p = Gesture.Pan().runOnJS(true);
    if (disabled) p = p.enabled(false);
    return p
      .onStart(() => { triggeredRef.current = false; })
      .onUpdate((e) => {
        if (triggeredRef.current) return;
        const maxX = (widthSV.value || 120) - THUMB_SIZE;
        translateX.value = Math.max(0, Math.min(maxX, e.translationX));
        if (e.translationX >= maxX) {
          triggeredRef.current = true;
          triggerRef.current();
        }
      })
      .onEnd((e) => {
        if (triggeredRef.current) return;
        const maxX = (widthSV.value || 120) - THUMB_SIZE;
        if (e.translationX >= maxX) {
          triggeredRef.current = true;
          triggerRef.current();
        } else {
          translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
        }
      })
      .onFinalize(() => {
        if (!triggeredRef.current) translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return (
    <GestureDetector gesture={pan}>
      <View
        className={`h-24 flex-1 rounded-full border bg-white dark:bg-surface ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
        nativeID={`${idPrefix}-drag-track`}
        onLayout={(event) => { widthSV.value = Math.round(event.nativeEvent.layout.width); }}
        testID={`${idPrefix}-drag-track`}
      >
        <Animated.View className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`} nativeID={`${idPrefix}-drag-fill`} style={fillStyle} testID={`${idPrefix}-drag-fill`} />
        <Animated.View className={`absolute left-0.5 top-4 h-16 w-16 items-center justify-center rounded-full ${colors.thumb}`} nativeID={`${idPrefix}-drag-thumb`} style={thumbStyle} testID={`${idPrefix}-drag-thumb`}>
          <MaterialCommunityIcons color={colors.iconColor} name={icon} size={26} />
        </Animated.View>
        <View className="absolute inset-0 items-center justify-center px-20" nativeID={`${idPrefix}-drag-content`} pointerEvents="none" testID={`${idPrefix}-drag-content`}>
          <Text className={`text-center text-base font-bold uppercase tracking-wide ${colors.label}`} nativeID={`${idPrefix}-drag-label`} numberOfLines={1} testID={`${idPrefix}-drag-label`}>{label}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

// Más chico y menos prominente que los sliders a propósito -- de-énfasis
// visual pedido en la spec (sigue siendo la única salida deliberada
// mientras haya un solo intento permitido, pero no compite con finalizar).
function HoldToCancelButton({ onTrigger, disabled, idPrefix }) {
  const HOLD_MS = 900;
  const colors = useThemeColors();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const stopHold = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setHolding(false);
    setProgress(0);
  };

  const startHold = () => {
    if (disabled) return;
    firedRef.current = false;
    setHolding(true);
    setProgress(0);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const next = Math.min(1, (Date.now() - startedAt) / HOLD_MS);
      setProgress(next);
      if (next >= 1) {
        stopHold();
        if (!firedRef.current) { firedRef.current = true; onTrigger(); }
      }
    }, 40);
  };

  return (
    <Pressable
      className={`h-10 flex-row items-center justify-center gap-2 self-center rounded-full border border-red-300 bg-white px-4 dark:border-red-900/60 dark:bg-surface ${disabled ? 'opacity-50' : ''}`}
      disabled={disabled}
      nativeID={`${idPrefix}-cancel-button`}
      onPressIn={startHold}
      onPressOut={stopHold}
      testID={`${idPrefix}-cancel-button`}
    >
      {holding && (
        <View className="h-1.5 w-12 overflow-hidden rounded-full bg-red-200 dark:bg-red-950" nativeID={`${idPrefix}-cancel-progress-track`} testID={`${idPrefix}-cancel-progress-track`}>
          <View className="h-full rounded-full bg-red-600" nativeID={`${idPrefix}-cancel-progress`} style={{ width: `${Math.round(progress * 100)}%` }} testID={`${idPrefix}-cancel-progress`} />
        </View>
      )}
      <MaterialCommunityIcons color={colors.error} name="stop-circle-outline" size={16} />
      <Text className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400" nativeID={`${idPrefix}-cancel-button-label`} testID={`${idPrefix}-cancel-button-label`}>
        {holding ? 'Soltá para cancelar' : 'Mantener presionado para cancelar'}
      </Text>
    </Pressable>
  );
}

function ConfirmCancelModal({ visible, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (visible) notifyWarning(); }, [visible]);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => { if (!loading) onCancel(); };

  return (
    <Modal animationType="fade" nativeID="route-attempt-live-cancel-modal" onRequestClose={handleCancel} testID="route-attempt-live-cancel-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="route-attempt-live-cancel-modal-backdrop" onPress={handleCancel} testID="route-attempt-live-cancel-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="route-attempt-live-cancel-modal-card" onPress={() => {}} testID="route-attempt-live-cancel-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="route-attempt-live-cancel-modal-header" testID="route-attempt-live-cancel-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="stop-circle-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="route-attempt-live-cancel-modal-title" testID="route-attempt-live-cancel-modal-title">Cancelar intento</Text>
          </View>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="route-attempt-live-cancel-modal-description" testID="route-attempt-live-cancel-modal-description">
            Vas a cancelar tu intento de esta competencia. Lo recorrido hasta ahora queda guardado, pero no se puede reanudar después de confirmar.
          </Text>
          <View className="mt-5 flex-row gap-3" nativeID="route-attempt-live-cancel-modal-actions" testID="route-attempt-live-cancel-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              disabled={loading}
              nativeID="route-attempt-live-cancel-modal-cancel-button"
              onPress={handleCancel}
              testID="route-attempt-live-cancel-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="route-attempt-live-cancel-modal-cancel-label" testID="route-attempt-live-cancel-modal-cancel-label">Seguir corriendo</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 active:opacity-80"
              disabled={loading}
              nativeID="route-attempt-live-cancel-modal-confirm-button"
              onPress={handleConfirm}
              testID="route-attempt-live-cancel-modal-confirm-button"
            >
              {loading ? <ActivityIndicator color="#ffffff" size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="route-attempt-live-cancel-modal-confirm-label" testID="route-attempt-live-cancel-modal-confirm-label">Cancelar intento</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 3: Add the main component — bootstrap and phase machine**

Append to the same file:

```javascript
function RouteAttemptLiveScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const setSessionStarted = useLiveSessionStore((s) => s.setSessionStarted);
  const clearLiveSession = useLiveSessionStore((s) => s.clearLiveSession);
  const routeAttempt = pendingSession?.routeAttempt ?? null;

  const [booted, setBooted] = useState(false);
  const [run, setRun] = useState(null);
  const [set, setSet] = useState(null);
  const [phase, setPhase] = useState('ready'); // ready -> countdown -> running <-> paused -> finishing
  const [countdown, setCountdown] = useState(3);
  const [distance, setDistance] = useState(null);
  const [tracePoints, setTracePoints] = useState([]);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopwatch = useStopwatch();
  const gps = useGpsTracker(true); // GPS ya es obligatorio para haber llegado a esta pantalla (gate del pre-start)

  const savedTimingsRef = useRef({ wallMs: 0, activeMs: 0 });
  const gpsActiveRef = useRef(false);
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  const distanceRef = useRef(null);
  const countdownRef = useRef(3);
  const countdownTimerRef = useRef(null);

  // Bootstrap -- subconjunto deliberadamente más simple que
  // training-session-active-screen.jsx#bootstrap: una competencia de ruta
  // SIEMPRE tiene 1 ejercicio/1 set (instancia sintética), así que no hay
  // mode='overview' ni multi-set que resolver.
  useEffect(() => {
    if (!pendingSession?.sessionInstance || !routeAttempt) return;
    (async () => {
      await initSessionDb();
      const sessionInstance = pendingSession.sessionInstance;
      let runRow = await getActiveRun(sessionInstance.id, pendingSession.date, userId);
      if (!runRow) {
        const createdId = await createRun({
          sessionInstanceId: sessionInstance.id,
          sessionName: sessionInstance.name ?? 'Corrida',
          sessionDate: pendingSession.date,
          teamId: pendingSession.teamId,
          userId,
          gpsEnabled: true,
          exercises: sessionInstance.exercises ?? [],
        });
        runRow = await getRun(createdId);
      }
      setSessionStarted(runRow.id, true);
      setRun(runRow);
      const sets = await getSetsForRun(runRow.id);
      const onlySet = sets[0];
      setSet(onlySet);
      setDistance(onlySet.distance_meters ?? null);
      distanceRef.current = onlySet.distance_meters ?? null;
      savedTimingsRef.current = { wallMs: onlySet.duration_ms ?? 0, activeMs: onlySet.active_duration_ms ?? 0 };
      if (onlySet.status === 'started' && !onlySet.ended_at) setPhase('paused');
      setBooted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGpsPoint = async ({ latitude, longitude, timestamp, accuracy }) => {
    if (!gpsActiveRef.current || !set) return;
    const point = { latitude, longitude, timestamp, accuracy };
    if (!lastPointRef.current) {
      lastPointRef.current = point;
      pointOrderRef.current = 0;
      await insertGpsPoint(set.id, 0, latitude, longitude, timestamp ?? Date.now());
      distanceRef.current = 0;
      setDistance(0);
      await updateSetDistance(set.id, 0);
      setTracePoints((prev) => [...prev, { latitude, longitude }]);
      return;
    }
    const leg = acceptGpsLeg({ from: lastPointRef.current, to: point });
    if (leg == null) return;
    lastPointRef.current = point;
    pointOrderRef.current += 1;
    await insertGpsPoint(set.id, pointOrderRef.current, latitude, longitude, timestamp ?? Date.now());
    setTracePoints((prev) => [...prev, { latitude, longitude }]);
    if (leg > 0) {
      const nextDistance = (distanceRef.current ?? 0) + leg;
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
      await updateSetDistance(set.id, nextDistance);
    }
  };

  const beginSet = async () => {
    try {
      await markSetStarted(set.id, toIsoUtc());
      savedTimingsRef.current = { wallMs: 0, activeMs: 0 };
      stopwatch.start();
      setPhase('running');
      gpsActiveRef.current = true;
      pointOrderRef.current = 0;
      await gps.start({ onPoint: handleGpsPoint });
    } catch (error) {
      logDebug('route-attempt-live beginSet error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos iniciar el intento', text2: error.message });
    } finally {
      setBusy(false);
    }
  };

  const startCountdown = () => {
    setPhase('countdown');
    countdownRef.current = 3;
    setCountdown(3);
    countdownTimerRef.current = setInterval(() => {
      const remaining = countdownRef.current - 1;
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setBusy(true);
        beginSet();
      } else {
        countdownRef.current = remaining;
        setCountdown(remaining);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    setPhase('ready');
    setCountdown(3);
  };

  const handlePlay = () => {
    if (busy) return;
    if (phase === 'ready') { startCountdown(); return; }
    if (phase === 'paused') {
      setBusy(true);
      stopwatch.resumeFrom(savedTimingsRef.current);
      setPhase('running');
      if (gpsActiveRef.current) gps.start({ onPoint: handleGpsPoint }).finally(() => setBusy(false));
      else setBusy(false);
    }
  };

  const handlePause = async () => {
    if (phase !== 'running' || busy) return;
    setBusy(true);
    const snap = stopwatch.pause();
    savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
    await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
    await gps.stop();
    setPhase('paused');
    setBusy(false);
  };

  const goToResult = () => {
    clearLiveSession();
    router.replace({
      pathname: '/route-attempt-result',
      params: {
        competitionId: routeAttempt.competitionId,
        setId: String(set.id),
        distanceMeters: String(distanceRef.current ?? 0),
        durationMs: String(savedTimingsRef.current.wallMs ?? 0),
      },
    });
  };

  const handleFinish = async () => {
    if ((phase !== 'running' && phase !== 'paused') || busy) return;
    setBusy(true);
    try {
      const snap = phase === 'running' ? stopwatch.pause() : savedTimingsRef.current;
      savedTimingsRef.current = snap;
      await gps.stop();
      await finishSet(set.id, { endedAtIso: toIsoUtc(), durationMs: snap.wallMs, activeDurationMs: snap.activeMs, distanceMeters: distanceRef.current });
      await finalizeRun(run.id);
      const result = await syncRun(run.id);
      if (result.errors.length) {
        notifyError();
        Toast.show({ type: 'warning', text1: 'Intento finalizado', text2: 'Algunos datos no pudieron sincronizarse -- quedaron guardados en el dispositivo.' });
      } else {
        notifySuccess();
      }
      goToResult();
    } catch (error) {
      logDebug('route-attempt-live handleFinish error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos finalizar el intento', text2: error.message });
      setBusy(false);
    }
  };

  const handleCancelConfirmed = async () => {
    try {
      const snap = phase === 'running' ? stopwatch.pause() : savedTimingsRef.current;
      await gps.stop();
      await markSetInterrupted(set.id, { endedAtIso: toIsoUtc(), durationMs: snap.wallMs, activeDurationMs: snap.activeMs, distanceMeters: distanceRef.current });
      await interruptStartedSets(run.id);
      await cancelRun(run.id);
      await syncRun(run.id);
      Toast.show({ type: 'info', text1: 'Intento cancelado' });
    } catch (error) {
      logDebug('route-attempt-live handleCancelConfirmed error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos cancelar el intento', text2: error.message });
    }
    goToResult();
  };

  // Intercepta el back nativo/gesto mientras hay un intento en curso -- sin
  // esto, volver a pre-start deja al corredor en una pantalla que reintentaría
  // POST /competitions/{id}/attempts (rechazado, sin reintentos v1) en vez de
  // simplemente cancelar lo que ya está corriendo. Mismo mecanismo que
  // useUnsavedChangesGuard usa en otras pantallas (usePreventRemove de
  // @react-navigation/native, ya viene con expo-router).
  usePreventRemove(phase === 'running' || phase === 'paused', () => setCancelVisible(true));

  if (!pendingSession || !routeAttempt) return <Redirect href="/" />;
  if (!booted || !set) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="route-attempt-live-screen-loading-root" testID="route-attempt-live-screen-loading-root">
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const showTimer = phase === 'running' || phase === 'paused' || phase === 'finishing';

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="route-attempt-live-screen-root" testID="route-attempt-live-screen-root">
      <View className="flex-1 px-4 pt-2" nativeID="route-attempt-live-screen-map-wrap" testID="route-attempt-live-screen-map-wrap">
        <LiveTrajectoryMap referenceRoute={routeAttempt.route} traveledPoints={tracePoints} />
      </View>

      <View className="items-center gap-1 px-4 py-2" nativeID="route-attempt-live-screen-stats-row" testID="route-attempt-live-screen-stats-row">
        <Text className="text-4xl" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="route-attempt-live-screen-timer" testID="route-attempt-live-screen-timer">
          {showTimer ? formatStopwatch(stopwatch.wallMs) : '00:00:00'}
        </Text>
        {distance != null && (
          <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-400" nativeID="route-attempt-live-screen-distance" testID="route-attempt-live-screen-distance">
            {formatMeters(distance)}
          </Text>
        )}
      </View>

      <View className="gap-3 px-4 pb-3" nativeID="route-attempt-live-screen-controls" testID="route-attempt-live-screen-controls">
        {phase === 'ready' && (
          <Pressable
            className="h-16 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
            nativeID="route-attempt-live-screen-play-button"
            onPress={handlePlay}
            testID="route-attempt-live-screen-play-button"
          >
            <MaterialCommunityIcons color={colors.onPrimary} name="play" size={28} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-live-screen-play-label" testID="route-attempt-live-screen-play-label">Arrancar</Text>
          </Pressable>
        )}
        {phase === 'paused' && (
          <>
            <Pressable
              className="h-16 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
              nativeID="route-attempt-live-screen-resume-button"
              onPress={handlePlay}
              testID="route-attempt-live-screen-resume-button"
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="play" size={28} />
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-live-screen-resume-label" testID="route-attempt-live-screen-resume-label">Reanudar</Text>
            </Pressable>
            <DragToFinishButton idPrefix="route-attempt-live-screen-finish" label="Deslizá para finalizar" onTrigger={handleFinish} />
          </>
        )}
        {phase === 'running' && (
          <View className="flex-row gap-3" nativeID="route-attempt-live-screen-running-controls" testID="route-attempt-live-screen-running-controls">
            <DragToFinishButton icon="pause" idPrefix="route-attempt-live-screen-pause" label="Deslizá para pausar" onTrigger={handlePause} variant="neutral" />
            <DragToFinishButton idPrefix="route-attempt-live-screen-finish" label="Deslizá para finalizar" onTrigger={handleFinish} />
          </View>
        )}
        {(phase === 'running' || phase === 'paused') && (
          <HoldToCancelButton disabled={busy} idPrefix="route-attempt-live-screen" onTrigger={() => setCancelVisible(true)} />
        )}
      </View>

      {phase === 'countdown' && <CountdownOverlay onCancelCountdown={cancelCountdown} value={countdown} />}
      <ConfirmCancelModal onCancel={() => setCancelVisible(false)} onConfirm={handleCancelConfirmed} visible={cancelVisible} />
    </SafeAreaView>
  );
}

export function RouteAttemptLiveScreen() {
  return (
    <MobileOnlyRoute>
      <RequireAuth>
        <RouteAttemptLiveScreenContent />
      </RequireAuth>
    </MobileOnlyRoute>
  );
}
```

- [ ] **Step 4: Verify nativeID/testID balance**

Run: `echo "nativeID=$(grep -c 'nativeID=' components/session-runtime/route-attempt-live-screen.jsx) testID=$(grep -c 'testID=' components/session-runtime/route-attempt-live-screen.jsx)"`
Expected: both counts equal.

- [ ] **Step 5: Lint**

Run: `npx eslint components/session-runtime/route-attempt-live-screen.jsx app/route-attempt-live.jsx`
Expected: 0 errors. Pay attention to the `react-hooks/exhaustive-deps` warning already suppressed on the bootstrap effect (intentional, mount-only — same pattern used elsewhere in this codebase) and the one on `DragToFinishButton`'s `useMemo` (intentional, same reasoning as the original).

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass (this task adds no new pure-logic tests of its own — the only new pure logic, `distanceToRouteMeters`/`computeRouteTimeoutMs`, was already tested in Task 1 and isn't wired in until Task 7).

- [ ] **Step 7: Commit**

```bash
git add app/route-attempt-live.jsx components/session-runtime/route-attempt-live-screen.jsx
git commit -m "feat(competitions): dedicated live screen for route attempts (manual controls)"
```

**Note for the reviewer of this task:** this task deliberately does NOT yet include the three automatic finalize triggers (route drift, timeout, competition closed) — those are Task 7, layered on top of the `handleFinish`/`handleCancelConfirmed` entry points this task already exposes. This task's deliverable is independently testable on-device: boot into the screen, see the countdown, play/pause/resume/finish/cancel all work and correctly persist to SQLite + sync + navigate to `/route-attempt-result`.

---

### Task 7: Wire the 3 automatic finalize triggers

**Files:**
- Modify: `components/session-runtime/route-attempt-live-screen.jsx`

**Interfaces:**
- Consumes: `distanceToRouteMeters`, `computeRouteTimeoutMs` from `utils/route-geometry.js` (Task 1); `useCompetitionDetail` from `hooks/use-competitions.js` with its new `refetchInterval` option (Task 2).
- Produces: no new exports — this task only adds internal effects to the component built in Task 6, calling the existing (already-tested-manually) `handleFinish`/`handleCancelConfirmed` functions from new triggers instead of adding new terminal paths.

- [ ] **Step 1: Add the imports**

At the top of `components/session-runtime/route-attempt-live-screen.jsx`, add:

```javascript
import { useCompetitionDetail } from '../../hooks/use-competitions.js';
import { computeRouteTimeoutMs, distanceToRouteMeters } from '../../utils/route-geometry.js';
```

- [ ] **Step 2: Timeout trigger**

Inside `RouteAttemptLiveScreenContent`, after the `beginSet` definition, add a ref and a derived value:

```javascript
  const timeoutTimerRef = useRef(null);
```

And inside `beginSet`, right after `await gps.start({ onPoint: handleGpsPoint });`, add:

```javascript
      const totalMeters = (routeAttempt.route?.coordinates ?? []).length > 1
        ? routeAttempt.route.coordinates.reduce((sum, coord, i, arr) => {
          if (i === 0) return 0;
          const [lng1, lat1] = arr[i - 1];
          const [lng2, lat2] = coord;
          return sum + Math.hypot((lng2 - lng1) * 111_320, (lat2 - lat1) * 111_320);
        }, 0)
        : 0;
      timeoutTimerRef.current = setTimeout(() => {
        logDebug('route-attempt-live timeout -- finalizando como finish');
        handleFinish();
      }, computeRouteTimeoutMs(totalMeters));
```

Note: this re-derives total meters with a quick planar approximation rather than importing `totalRouteMeters` from `utils/route-geometry.js` (which expects `{lat, lng}` objects, not GeoJSON `[lng, lat]` pairs, and this is a one-time calculation at start, not a hot path) — for consistency and to avoid a second slightly-different distance formula living in the same file, replace that inline reduce with a direct import instead:

Remove the inline `totalMeters` block above and instead add this import at the top of the file:

```javascript
import { totalRouteMeters } from '../../utils/route-geometry.js';
```

And replace the block with:

```javascript
      const totalMeters = totalRouteMeters((routeAttempt.route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })));
      timeoutTimerRef.current = setTimeout(() => {
        logDebug('route-attempt-live timeout -- finalizando como finish');
        handleFinish();
      }, computeRouteTimeoutMs(totalMeters));
```

Clear the timer in `handlePause` (right after `await gps.stop();`), `handleFinish` (right after `await gps.stop();`), and `handleCancelConfirmed` (right after `await gps.stop();`) — in each of those three places add:

```javascript
      if (timeoutTimerRef.current) { clearTimeout(timeoutTimerRef.current); timeoutTimerRef.current = null; }
```

And in `handlePlay`'s resume branch (the `phase === 'paused'` case), re-arm it with the *remaining* time is unnecessary precision for v1 — simplest correct behavior: re-arm with the full `computeRouteTimeoutMs(totalMeters)` again on resume (a pause-then-resume effectively restarts the countdown; this under-triggers rather than over-triggers, which is the safer direction for an auto-finalize meant to catch "forgot the app running", not to be a strict race clock). Add inside the `phase === 'paused'` branch of `handlePlay`, right after `gps.start({...})`:

```javascript
      const totalMeters = totalRouteMeters((routeAttempt.route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })));
      timeoutTimerRef.current = setTimeout(() => { logDebug('route-attempt-live timeout -- finalizando como finish'); handleFinish(); }, computeRouteTimeoutMs(totalMeters));
```

- [ ] **Step 3: Route-drift trigger (with anti-flapping)**

Add a ref for the consecutive-off-route counter, near the other refs:

```javascript
  const offRouteStreakRef = useRef(0);
```

Inside `handleGpsPoint`, right after the line `setTracePoints((prev) => [...prev, { latitude, longitude }]);` that follows the `leg == null` early-return block (i.e., in the branch that actually accepted the point, not the discarded-as-noise branch), add the drift check:

```javascript
    const driftMeters = distanceToRouteMeters({ lat: latitude, lng: longitude }, routeAttempt.route?.coordinates ?? []);
    const driftThreshold = routeAttempt.acceptanceRadiusMeters * 3;
    if (driftMeters > driftThreshold) {
      offRouteStreakRef.current += 1;
      if (offRouteStreakRef.current >= 3) {
        logDebug(`route-attempt-live alejamiento sostenido (${Math.round(driftMeters)}m > ${driftThreshold}m) -- cancelando`);
        setCancelVisible(false);
        handleCancelConfirmed();
        return;
      }
    } else {
      offRouteStreakRef.current = 0;
    }
```

This runs on every accepted GPS point (the same cadence `acceptGpsLeg` already gates to ~1/sec of real movement), so "3 en fila" means roughly 3 consecutive accepted samples outside the drift radius, filtering out a single noisy jump the same way the existing accuracy/speed filter already does for distance accumulation.

- [ ] **Step 4: Competition-closed trigger**

Inside `RouteAttemptLiveScreenContent`, add the polling hook call (near the top, with the other hooks, before the `useEffect`s):

```javascript
  const { detail: competitionDetail } = useCompetitionDetail(routeAttempt?.competitionId, {
    enabled: phase === 'running' || phase === 'paused',
    refetchInterval: (phase === 'running' || phase === 'paused') ? 15000 : false,
  });
```

And add a dedicated effect to react to it (place it after the bootstrap effect):

```javascript
  useEffect(() => {
    if (!competitionDetail || competitionDetail.status === 'active') return;
    if (phase !== 'running' && phase !== 'paused') return;
    logDebug(`route-attempt-live competencia status="${competitionDetail.status}" -- cancelando`);
    setCancelVisible(false);
    handleCancelConfirmed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionDetail]);
```

- [ ] **Step 5: Verify nativeID/testID balance (should be unchanged from Task 6 — this task adds no new JSX elements)**

Run: `echo "nativeID=$(grep -c 'nativeID=' components/session-runtime/route-attempt-live-screen.jsx) testID=$(grep -c 'testID=' components/session-runtime/route-attempt-live-screen.jsx)"`
Expected: both counts equal, same numbers as Task 6's Step 4.

- [ ] **Step 6: Lint**

Run: `npx eslint components/session-runtime/route-attempt-live-screen.jsx`
Expected: 0 errors.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all pass (no new pure-logic to test here — the underlying math was tested in Task 1, this task is pure wiring).

- [ ] **Step 8: Commit**

```bash
git add components/session-runtime/route-attempt-live-screen.jsx
git commit -m "feat(competitions): auto-finalize route attempts on timeout, drift, or competition close"
```

**Note for the reviewer of this task:** the anti-flapping threshold (3 consecutive off-route points) and the 15-second competition-status poll interval are implementation choices, not contract — adjustable without revisiting the spec if device testing shows they're too twitchy or too slow (see spec's "Riesgos" section).

---

### Task 8: Point the pre-start screen's Play at the new live screen

**Files:**
- Modify: `components/session-runtime/route-attempt-pre-start-screen.jsx`

**Interfaces:** none new — this is a one-line routing change.

- [ ] **Step 1: Make the change**

Run: `grep -n "router.push('/training-session-active')" components/session-runtime/route-attempt-pre-start-screen.jsx` to confirm the exact current line, then change:

```javascript
    router.push('/training-session-active');
```

to:

```javascript
    router.push('/route-attempt-live');
```

- [ ] **Step 2: Lint**

Run: `npx eslint components/session-runtime/route-attempt-pre-start-screen.jsx`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/session-runtime/route-attempt-pre-start-screen.jsx
git commit -m "feat(competitions): pre-start Play now opens the dedicated live screen"
```

---

### Task 9: Remove the now-dead `routeAttempt` code from `training-session-active-screen.jsx`

**Files:**
- Modify: `components/session-runtime/training-session-active-screen.jsx`

**Interfaces:** `SeriesView`'s prop list loses `routeAttempt`; its only caller (inside the same file) stops passing it. No external interface changes (nothing outside this file imports `SeriesView` directly).

Once Task 8 lands, no route attempt will ever reach `/training-session-active` again (the pre-start screen is the only place that sets `pendingSession.routeAttempt` and navigates toward this flow, and it now points elsewhere). The following branches become unreachable dead code:

- [ ] **Step 1: Remove the bootstrap shortcut**

Remove this block from the `bootstrap` function (around where `setBooted(true)` is called):

```javascript
      // Spec 4c -- con 1 solo ejercicio/serie (instancia sintética de una
      // competencia de ruta), salta directo a la vista de serie: el
      // listado de ejercicios no aporta nada con una sola fila.
      if (pendingSession.routeAttempt && bootSets.length === 1 && bootSets[0].status === 'pending') {
        setCurrentSetId(bootSets[0].id);
        setMode('series');
      }
```

- [ ] **Step 2: Remove the result-screen redirect branch in `handleAdvance`**

Remove this block from `handleAdvance` (right after `await finalizeRun(run.id);`):

```javascript
        if (pendingSession.routeAttempt) {
          clearLiveSession();
          router.replace({
            pathname: '/route-attempt-result',
            params: {
              competitionId: pendingSession.routeAttempt.competitionId,
              distanceMeters: String(all[0]?.distance_meters ?? 0),
              durationMs: String(all[0]?.duration_ms ?? 0),
            },
          });
          return;
        }
```

(leave the `setMode('overview'); setSessionCompleteVisible(true);` lines that follow it untouched — that's the real generic-training path).

- [ ] **Step 3: Remove `routeAttempt` from `SeriesView`'s signature and body**

Change the signature:

```javascript
function SeriesView({ set, runId, gpsEnabled, totalSeriesForExercise, onAdvance, onBack, onCancelConfirmed, onDataChanged, routeAttempt }) {
```

to:

```javascript
function SeriesView({ set, runId, gpsEnabled, totalSeriesForExercise, onAdvance, onBack, onCancelConfirmed, onDataChanged }) {
```

Remove the two `if (routeAttempt) setTracePoints(...)` lines inside `handleGpsPoint` (the trace-point accumulation is no longer needed here — `SeriesView` never renders a trajectory map anymore after the next step). Remove the `tracePoints`/`setTracePoints` state declaration entirely (it has no other use once those two lines are gone).

Remove the `{routeAttempt && <LiveTrajectoryMap referenceRoute={routeAttempt.route} traveledPoints={tracePoints} />}` line from the render.

Change `{phase === 'ready' && !routeAttempt && (` (the skip-hint block) to `{phase === 'ready' && (` — skip is always relevant for generic training again.

Change `{!routeAttempt && (` inside the `phase === 'paused'` secondary controls block to remove the conditional — the skip button should always render there now; simplify:

```javascript
              <View className="flex-row gap-3" nativeID={`${idPrefix}-secondary-controls`} testID={`${idPrefix}-secondary-controls`}>
                {!routeAttempt && (
                  <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
                    <MaterialCommunityIcons color={colors.onSurfaceVariant} name="skip-next" size={18} />
                  </Pressable>
                )}
                <DragToFinishButton disabled={false} idPrefix={idPrefix} onTrigger={handleFinish} />
              </View>
```

to:

```javascript
              <View className="flex-row gap-3" nativeID={`${idPrefix}-secondary-controls`} testID={`${idPrefix}-secondary-controls`}>
                <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="skip-next" size={18} />
                </Pressable>
                <DragToFinishButton disabled={false} idPrefix={idPrefix} onTrigger={handleFinish} />
              </View>
```

Change `{!routeAttempt && <SkipMenuModal .../>}` to always render it unconditionally (remove the `!routeAttempt &&` guard):

```javascript
      <SkipMenuModal visible={skipVisible} onCancel={() => setSkipVisible(false)} onSkipSeries={skipSeries} onSkipExercise={skipExercise} busy={busy} />
```

- [ ] **Step 4: Remove the now-unused `LiveTrajectoryMap` import**

Run: `grep -n "LiveTrajectoryMap\|routeAttempt" components/session-runtime/training-session-active-screen.jsx` to confirm no remaining references, then remove the import line:

```javascript
import { LiveTrajectoryMap } from './live-trajectory-map.jsx';
```

- [ ] **Step 5: Remove `routeAttempt` from `SeriesView`'s only call site**

Find where `SeriesView` is rendered (passing `routeAttempt={pendingSession.routeAttempt ?? null}`) and remove that prop from the JSX call.

- [ ] **Step 6: Verify nativeID/testID balance**

Run: `echo "nativeID=$(grep -c 'nativeID=' components/session-runtime/training-session-active-screen.jsx) testID=$(grep -c 'testID=' components/session-runtime/training-session-active-screen.jsx)"`
Expected: both counts equal (lower than before this task, since conditional blocks that only ever rendered for the now-impossible `routeAttempt` case are gone).

- [ ] **Step 7: Lint**

Run: `npx eslint components/session-runtime/training-session-active-screen.jsx`
Expected: 0 errors, no unused-variable warnings for `routeAttempt`/`tracePoints`/`setTracePoints`/`LiveTrajectoryMap`.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all pass — this file has no dedicated render tests (project convention), and no pure-logic file imports from it, so this is a pure cleanup with nothing to regress in Jest. Real verification is manual: start a **normal** (non-route) training session on-device/preview and confirm skip/multi-set/overview still work exactly as before.

- [ ] **Step 9: Commit**

```bash
git add components/session-runtime/training-session-active-screen.jsx
git commit -m "chore(competitions): remove dead routeAttempt branches from training-session-active-screen"
```

---

### Task 10: Final full-branch regression pass

**Files:** none (verification only).

- [ ] **Step 1: Full lint**

Run: `npm run lint`
Expected: 0 errors. The 4 pre-existing warnings in `achievements-screen.jsx`/`training-session-active-screen.jsx` (missing deps in unrelated effects, already present before this plan) are acceptable — confirm no *new* warnings were introduced by this plan's changes to `training-session-active-screen.jsx`.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all test suites pass, including the extended `__tests__/route-geometry.test.js` from Task 1.

- [ ] **Step 3: nativeID/testID balance across every touched/new file**

```bash
for f in app/route-attempt-live.jsx components/session-runtime/route-attempt-live-screen.jsx components/session-runtime/live-trajectory-map.jsx components/session-runtime/route-attempt-result-screen.jsx components/session-runtime/training-session-active-screen.jsx components/session-runtime/training-session-live-screen.jsx components/session-runtime/trainer-session-live-screen.jsx components/session-runtime/route-attempt-pre-start-screen.jsx; do
  echo "$f: nativeID=$(grep -c 'nativeID=' "$f") testID=$(grep -c 'testID=' "$f")"
done
```

Expected: every pair of numbers equal on every line.

- [ ] **Step 4: Manual on-device verification checklist (write this down for the user, do not attempt to automate it)**

1. As a corredor participating in an active `type='route'` competition, tap "Correr esta trayectoria" → lands on the pre-start screen (unchanged from before this plan).
2. Walk to within the configured `acceptance_radius_meters` of the route's start point (or use the mock's GPS-seeded competition, `task_78c1464c`'s fix notwithstanding — this is a separate concern) → Play button enables.
3. Tap Play → 3-2-1 countdown → lands on the new map-first live screen, timer starts, map shows the expected route (dashed) and the traveled path (solid, growing).
4. Tap the pause slider → timer stops, GPS tracking stops, "Reanudar" button + finish slider appear.
5. Tap "Reanudar" → resumes correctly from the paused elapsed time (not from 0).
6. Tap the finish slider → navigates to `/route-attempt-result`, which now shows the actual traveled path (not just the dashed expected route) and start/end markers.
7. Start a new attempt (different competition, or after confirming via mock that attempts reset) and this time hold the cancel button → confirmation modal appears → confirm → also lands on the result screen (not just `router.back()`).
8. Start an attempt and press the hardware/gesture back button while running → the cancel confirmation modal appears instead of silently navigating back to pre-start.
9. Separately, start a **normal** (non-route) training session end-to-end (multi-set, with a skip) to confirm Task 9's cleanup didn't regress the generic flow.

No step here is skippable by inspecting code alone — GPS, native gestures, and MapLibre rendering are the three things this whole plan touches that Jest/ESLint cannot verify.

- [ ] **Step 5: Push the branch**

```bash
git push
```

---

## Self-Review Notes (completed during plan authoring, not a step for the executor)

- **Spec coverage:** every section of `docs/superpowers/specs/2026-10-19-route-attempt-live-screen-design.md` maps to a task — Architecture → Tasks 6/8/9; Layout/Controls → Task 6; Finalización automática → Task 7; Fix visual de los pills → Task 5; Bug B → Tasks 3/4; Riesgos' consolidation note → explicitly called out as deferred in Global Constraints and Task 6's header comment.
- **Resume beyond in-memory `pendingSession`:** the spec didn't explicitly scope this down; during plan-writing it became clear a full cold-restart resume needs a backend contract change (idempotent attempts endpoint) out of reach for this plan — documented as an accepted limitation in Global Constraints, with the one cheap mitigation (hardware-back-intercept) implemented in Task 6.
- **Type/name consistency check:** `set.id`/`run.id` used consistently across Tasks 6, 7, and the result-screen fix in Task 4 (`setId` nav param). `routeAttempt.acceptanceRadiusMeters`/`routeAttempt.route.coordinates`/`routeAttempt.competitionId` (camelCase, matching `toCompetitionModel`'s output shape already used by `route-attempt-pre-start-screen.jsx`) used consistently in Task 7's new code — double-checked against the existing `routeAttempt` shape set by `competitions-tab.jsx#handleRun`.
