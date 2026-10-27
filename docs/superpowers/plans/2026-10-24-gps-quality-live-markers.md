# GPS Quality + Live Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smooth GPS readings for display (not measured distance), sample more frequently, show a live position marker with the runner's avatar, and add distinguishing icons to route start/end markers everywhere they appear.

**Architecture:** A new pure function (`smoothGpsPoint`, accuracy-weighted EMA) sits between the existing accept/reject GPS gate and the trace/marker rendering — it never touches the distance total, which keeps coming from the unchanged `acceptGpsLeg` leg calculation. `route-attempt-live-screen.jsx` tracks a second ref (`lastSmoothedPointRef`) alongside the existing raw-point ref. `LiveTrajectoryMap` gains a `currentPosition` + avatar props and renders a photo/initials marker; the same file plus `route-map-preview.jsx` get icon-in-dot treatment for start/end markers via a new shared constants file.

**Tech Stack:** `@maplibre/maplibre-react-native` (native maps), `maplibre-gl` (web maps), `expo-location`, `@expo/vector-icons` (MaterialCommunityIcons), existing `AvatarPicker`/`getUserInitials`.

**Spec:** `docs/superpowers/specs/2026-10-24-gps-quality-live-markers-design.md`

## Global Constraints

- Smoothing affects ONLY rendered trace/marker position — never the distance total (`distanceRef`/`insertGpsPoint`/`updateSetDistance` keep using raw-leg values from `acceptGpsLeg`, unchanged).
- The accept/reject gate (`acceptGpsLeg`) keeps comparing raw-to-raw points — never against the smoothed point.
- Icon codepoints verified against the installed glyphmap: `flag-outline` = `0xf023d` (start), `flag-checkered` = `0xf023c` (end). Web font-family for the icon font is `'material-community'` (verified registered via `document.fonts` at runtime).
- Native `Marker` (`@maplibre/maplibre-react-native`) coordinate prop is `lngLat` (array `[lng, lat]`), accepts arbitrary `children`. Web `maplibregl.Marker` takes `{ element: HTMLElement }`.
- Every visual RN element needs `nativeID`+`testID` (kebab-case, unique) per project convention.
- `npm test` and `npm run lint` must be green before each commit.
- No new dependencies.

---

### Task 1: `smoothGpsPoint` in `utils/distance.js`

**Files:**
- Modify: `utils/distance.js`
- Test: `__tests__/distance.test.js`

**Interfaces:**
- Produces: `smoothGpsPoint(previousSmoothed, rawPoint, options?)` → `{ latitude, longitude }`. Consumed by Task 5 (`route-attempt-live-screen.jsx`).

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/distance.test.js` (new `describe` block, keep existing ones untouched):

```js
import { acceptGpsLeg, haversineMeters, smoothGpsPoint } from '../utils/distance.js';
```

(update the existing top import line to add `smoothGpsPoint`)

```js
describe('smoothGpsPoint', () => {
  test('sin punto previo, devuelve el crudo tal cual (sin historial para suavizar)', () => {
    const result = smoothGpsPoint(null, { latitude: -34.6, longitude: -58.4, accuracy: 5 });
    expect(result).toEqual({ latitude: -34.6, longitude: -58.4 });
  });

  test('buena precisión (accuracy bajo) pesa cerca de alphaMax hacia el punto crudo', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 5 }; // k=4 default, 4/5=0.8=alphaMax
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.8, 5);
  });

  test('precisión mala (accuracy alto, pero ya pasó el gate) se clampea a alphaMin', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 29 }; // 4/29 ≈ 0.138, clamp a 0.2
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.2, 5);
  });

  test('accuracy intermedio interpola entre alphaMin y alphaMax', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 10 }; // 4/10 = 0.4
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.4, 5);
  });

  test('sin accuracy en el punto, usa alphaMax (no penaliza un dato que no puede evaluar)', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0 };
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.8, 5);
  });

  test('longitude se suaviza con el mismo alpha que latitude', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 0, longitude: 2, accuracy: 5 };
    const result = smoothGpsPoint(previous, raw);
    expect(result.longitude).toBeCloseTo(1.6, 5);
  });

  test('opciones custom (k/alphaMin/alphaMax) se respetan', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 5 };
    const result = smoothGpsPoint(previous, raw, { k: 1, alphaMin: 0, alphaMax: 1 });
    expect(result.latitude).toBeCloseTo(0.2, 5); // 1/5 = 0.2, sin clamp porque alphaMax=1
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/distance.test.js`
Expected: FAIL — `smoothGpsPoint is not a function` (or similar import error).

- [ ] **Step 3: Implement `smoothGpsPoint`**

In `utils/distance.js`, add after `acceptGpsLeg` (before `formatMeters`):

```js
// Media móvil exponencial ponderada por `accuracy` -- SOLO para el trazo
// dibujado y el ícono de posición, nunca para la distancia total (esa
// sigue saliendo de `acceptGpsLeg`, crudo-a-crudo, sin cambios -- la
// distancia de un intento alimenta compliance_ratio y se persiste al
// backend, no se toca con una heurística de suavizado nueva). Mejor
// precisión (accuracy bajo) pesa más hacia el punto crudo nuevo; peor
// precisión (pero que ya pasó el filtro de acceptGpsLeg) pesa más hacia
// el historial ya suavizado. Sin `accuracy`, usa alphaMax -- no penaliza
// un dato que no puede evaluar, mismo criterio permisivo que ya usa
// acceptGpsLeg con accuracy ausente.
export function smoothGpsPoint(previousSmoothed, rawPoint, { k = 4, alphaMin = 0.2, alphaMax = 0.8 } = {}) {
  if (!previousSmoothed) return { latitude: rawPoint.latitude, longitude: rawPoint.longitude };
  const { accuracy } = rawPoint;
  const alpha = Number.isFinite(accuracy) ? Math.min(alphaMax, Math.max(alphaMin, k / Math.max(accuracy, 1))) : alphaMax;
  return {
    latitude: previousSmoothed.latitude + alpha * (rawPoint.latitude - previousSmoothed.latitude),
    longitude: previousSmoothed.longitude + alpha * (rawPoint.longitude - previousSmoothed.longitude),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/distance.test.js`
Expected: PASS, all tests including the new `smoothGpsPoint` describe block.

- [ ] **Step 5: Run full suite + lint, then commit**

Run: `npm test && npm run lint`
Expected: both green.

```bash
git add utils/distance.js __tests__/distance.test.js
git commit -m "feat(gps): add accuracy-weighted smoothing for display, not distance"
```

---

### Task 2: `utils/route-marker-meta.js`

**Files:**
- Create: `utils/route-marker-meta.js`

**Interfaces:**
- Produces: `ROUTE_MARKER_META` → `{ start: {color, label, icon, iconCodepoint}, end: {color, label, icon, iconCodepoint} }`. Consumed by Task 3 (`live-trajectory-map.jsx`/`.web.jsx`) and Task 4 (`route-map-preview.jsx`/`.web.jsx`).

- [ ] **Step 1: Create the file**

```js
// utils/route-marker-meta.js
// Color/label/ícono de los marcadores de inicio/fin de una ruta --
// centralizado acá porque hasta ahora estaba duplicado idéntico en 4
// archivos (live-trajectory-map.jsx/.web.jsx, route-map-preview.jsx/
// .web.jsx). `iconCodepoint` es el mismo glyph que `icon` pero como
// codepoint numérico -- lo necesita el lado web, que arma el marcador
// con un nodo DOM crudo (no puede usar <MaterialCommunityIcons/>, un
// componente RN) y escribe el glyph directo como texto del font
// 'material-community' (ver utils/distance.js y el spec de esta rama
// para la verificación de que ese font-family y esos codepoints son
// reales, no copiados de memoria).
export const ROUTE_MARKER_META = {
  start: { color: '#ef4444', label: 'Punto de inicio', icon: 'flag-outline', iconCodepoint: 0xf023d },
  end: { color: '#2563eb', label: 'Punto de llegada', icon: 'flag-checkered', iconCodepoint: 0xf023c },
};
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add utils/route-marker-meta.js
git commit -m "feat(gps): add shared start/end marker metadata (color/label/icon)"
```

---

### Task 3: `LiveTrajectoryMap` — avatar marker + icon dots

**Files:**
- Modify: `components/session-runtime/live-trajectory-map.jsx`
- Modify: `components/session-runtime/live-trajectory-map.web.jsx`

**Interfaces:**
- Consumes: `ROUTE_MARKER_META` from Task 2; `AvatarPicker` from `components/shared/avatar-picker.jsx`; `getUserInitials` from `utils/user-initials.js` (web side needs the STRING, computed by the caller — see Task 5).
- Produces: `LiveTrajectoryMap` gains 3 new optional props — `currentPosition` (`{latitude, longitude} | null`), `currentUserPhotoUrl` (`string | null`), `currentUserInitials` (`string`). Consumed by Task 5.

- [ ] **Step 1: Native — `live-trajectory-map.jsx`**

Replace the full file content:

```jsx
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_MINIMAL_STYLE_URL } from '../../config/maps.js';
import { computeBounds, expandBounds } from '../../utils/map-bounds.js';
import { ROUTE_MARKER_META } from '../../utils/route-marker-meta.js';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
// Mismo ancho de banda que RouteMarker en route-map-preview.jsx -- sin esto
// la etiqueta (absolute, no cuenta para el ancho intrínseco del Marker) se
// aplasta contra el ancho del dot (~18px), texto invisible aunque el fondo
// de color sí se vea (bug ya documentado ahí).
const LABEL_BAND_WIDTH = 200;

// Marcador con tooltip por tap -- mismo patrón que RouteMarker en
// route-map-preview.jsx, simplificado (label fijo, sin resolución de
// dirección -- acá no hace falta abrir Google Maps desde el tooltip).
// El dot pasa a tener un ícono adentro (pedido real 2026-10-24) --
// agrandado de 14 a 22px para que el ícono entre legible, mismo color
// de fondo que antes.
function TrajectoryMarker({ point, meta, idPrefix, active, onToggle, labelBelow }) {
  return (
    <Marker anchor="bottom" id={idPrefix} lngLat={point} onPress={onToggle}>
      <View className="items-center" nativeID={idPrefix} style={{ width: LABEL_BAND_WIDTH }} testID={idPrefix}>
        <View
          className="items-center justify-center"
          nativeID={`${idPrefix}-dot`}
          style={{ backgroundColor: meta.color, borderColor: '#ffffff', borderRadius: 11, borderWidth: 2, height: 22, width: 22 }}
          testID={`${idPrefix}-dot`}
        >
          <MaterialCommunityIcons color="#ffffff" name={meta.icon} size={12} />
        </View>
        {active && (
          <View className="absolute left-0 right-0 items-center" nativeID={`${idPrefix}-label-wrap`} style={labelBelow ? { top: 26 } : { bottom: 26 }} testID={`${idPrefix}-label-wrap`}>
            <View className="rounded-md px-2 py-1" nativeID={`${idPrefix}-label`} style={{ backgroundColor: meta.color }} testID={`${idPrefix}-label`}>
              <Text className="text-xs font-semibold text-white" nativeID={`${idPrefix}-label-text`} numberOfLines={1} testID={`${idPrefix}-label-text`}>{meta.label}</Text>
            </View>
          </View>
        )}
      </View>
    </Marker>
  );
}

// Marcador de "acá estoy" -- avatar de solo lectura (sin onPick/onRemove),
// mismo componente que el resto de la app usa para fotos ajenas. Borde
// blanco para distinguirse del fondo del mapa, mismo criterio que los
// dots de inicio/fin.
function CurrentPositionMarker({ point, photoUrl, initials }) {
  return (
    <Marker anchor="center" id="live-trajectory-map-current-position" lngLat={point}>
      <View className="overflow-hidden rounded-full border-2 border-white" nativeID="live-trajectory-map-current-position-ring" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3 }} testID="live-trajectory-map-current-position-ring">
        <AvatarPicker accessibilityLabel="Tu posición actual" fallbackIcon="account" idPrefix="live-trajectory-map-current-position-avatar" initials={initials} size={32} uri={photoUrl} />
      </View>
    </Marker>
  );
}

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
//
// `currentPosition`/`currentUserPhotoUrl`/`currentUserInitials` (pedido
// real 2026-10-24) -- ícono de "acá estoy" con la foto de perfil del
// usuario, fallback a iniciales. `currentPosition` ya viene SUAVIZADO
// (ver utils/distance.js#smoothGpsPoint) por el caller -- este
// componente no sabe ni le importa de dónde salió el punto, solo lo
// dibuja.
export function LiveTrajectoryMap({ traveledPoints, referenceRoute, currentPosition, currentUserPhotoUrl, currentUserInitials }) {
  const cameraRef = useRef(null);
  const [activeMarker, setActiveMarker] = useState(null);
  // Mismo guard que RouteMapPreview -- Marker.onPress no consume el tap
  // para el Map.onPress de abajo (los dos disparan para el mismo toque),
  // así que sin esto el tap-afuera-cierra se come su propio toggle.
  const suppressMapCloseRef = useRef(false);
  const handleMarkerToggle = (id) => {
    suppressMapCloseRef.current = true;
    setActiveMarker((v) => (v === id ? null : id));
  };

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
  // Acota pan/zoom-out a una zona razonable alrededor de la trayectoria --
  // margen mucho más generoso que el de RouteMapPreview (esa es una
  // preview de lectura, bloqueada a propósito a una zona chica). Sin
  // minZoom numérico aparte (ver Camera más abajo) -- el propio tamaño de
  // este rectángulo YA es el único límite de zoom-out, así que tiene que
  // ser él el que se agrande, no un número que compita con él.
  const maxBounds = bounds ? expandBounds(bounds, { marginRatio: 3, minMarginMeters: 3000 }) : undefined;
  const initialCenter = traveledPoints?.[0]
    ? [traveledPoints[0].longitude, traveledPoints[0].latitude]
    : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
  const referenceCoords = referenceRoute?.coordinates ?? [];
  // Mitad norte de los bounds -- mismo criterio que RouteMarker en
  // route-map-preview.jsx para decidir si la etiqueta crece hacia arriba o
  // abajo sin cortarse contra el borde de la preview. bounds es
  // [west, south, east, north].
  const midLat = bounds ? (bounds[1] + bounds[3]) / 2 : null;
  const startLabelBelow = midLat != null && referenceCoords[0] ? referenceCoords[0][1] > midLat : false;
  const endLabelBelow = midLat != null && referenceCoords[referenceCoords.length - 1] ? referenceCoords[referenceCoords.length - 1][1] > midLat : false;
  const currentPositionLngLat = currentPosition ? [currentPosition.longitude, currentPosition.latitude] : null;

  return (
    <View className="h-full w-full overflow-hidden rounded-2xl border-2 border-gray-200" nativeID="live-trajectory-map-wrapper" testID="live-trajectory-map-wrapper">
      <Map
        attribution={false}
        logo={false}
        mapStyle={OPENFREEMAP_MINIMAL_STYLE_URL}
        nativeID="live-trajectory-map"
        onDidFinishLoadingMap={() => {
          // Fit imperativo UNA sola vez al terminar de cargar -- mismo
          // patrón ya probado en RouteMapPreview. Antes `bounds` iba como
          // prop DECLARATIVO de `<Camera>` -- Camera.tsx lo mergea dentro
          // de `...stop`, un objeto nuevo en cada render que se manda tal
          // cual a la capa nativa como comando de cámara; en cualquier
          // re-render (no solo el primero) eso vuelve a disparar un
          // "stop" hacia bounds, y es lo que dejaba el zoom-out efectivo
          // sin límite real en mobile (bug real reportado 2026-10-21) --
          // minZoom/maxBounds quedaban peleando contra un comando de
          // cámara que se repetía solo.
          if (bounds) cameraRef.current?.fitBounds(bounds, { duration: 0, padding: { bottom: 40, left: 40, right: 40, top: 40 } });
        }}
        onPress={() => {
          if (suppressMapCloseRef.current) { suppressMapCloseRef.current = false; return; }
          setActiveMarker(null);
        }}
        style={{ flex: 1 }}
        testID="live-trajectory-map"
      >
        {/* minZoom explícito de nuevo -- pedido real 2026-10-21 (3ra vuelta):
            con el pan ya acotado por maxBounds, el zoom-out seguía sin
            límite ("hasta ver el mapa del mundo completo"). A diferencia de
            maplibre-gl en web, que deriva un minZoom efectivo del tamaño de
            maxBounds, el SDK nativo de maplibre-react-native SOLO usa
            maxBounds para limitar el centro de la cámara -- no toca el
            zoom. Sin minZoom propio, no hay ningún límite de zoom-out en
            absoluto. 12, no 10 -- valor cercano al que el maxBounds (mismo
            margen que el de arriba) ya termina clampeando de forma natural
            en la versión web, para que las dos plataformas se sientan
            parecidas. */}
        <Camera initialViewState={{ center: initialCenter, zoom: 14 }} maxBounds={maxBounds} maxZoom={18} minZoom={12} ref={cameraRef} />
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
          <TrajectoryMarker
            active={activeMarker === 'start'}
            idPrefix="live-trajectory-map-start-marker"
            labelBelow={startLabelBelow}
            meta={ROUTE_MARKER_META.start}
            onToggle={() => handleMarkerToggle('start')}
            point={referenceCoords[0]}
          />
        )}
        {referenceCoords.length >= 2 && (
          <TrajectoryMarker
            active={activeMarker === 'end'}
            idPrefix="live-trajectory-map-end-marker"
            labelBelow={endLabelBelow}
            meta={ROUTE_MARKER_META.end}
            onToggle={() => handleMarkerToggle('end')}
            point={referenceCoords[referenceCoords.length - 1]}
          />
        )}
        {currentPositionLngLat && (
          <CurrentPositionMarker initials={currentUserInitials} photoUrl={currentUserPhotoUrl} point={currentPositionLngLat} />
        )}
      </Map>
    </View>
  );
}
```

- [ ] **Step 2: Web — `live-trajectory-map.web.jsx`**

Replace the full file content:

```jsx
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
  dot.addEventListener('mouseenter', () => { positionTooltip(); tooltip.style.opacity = '1'; });
  dot.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  return { element: dot, destroy: () => tooltip.remove() };
}

// Marcador de "acá estoy" -- círculo con foto de perfil (fallback a
// iniciales), rehecho a mano en DOM crudo porque AvatarPicker es un
// componente RN y un maplibregl.Marker necesita un HTMLElement real (no
// se puede montar un componente RN ahí, ver spec de esta rama). Mismos
// colores que AvatarPicker (tailwind.config.js: primary-tint #dcec9e,
// on-primary-tint #3c6b12) para que se vea igual que en nativo.
function buildCurrentPositionMarker(photoUrl, initials) {
  const SIZE = 32;
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
```

- [ ] **Step 3: Run tests + lint**

Run: `npm test && npm run lint`
Expected: both green (no component render tests exist for this file per repo convention — this step just confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/live-trajectory-map.jsx components/session-runtime/live-trajectory-map.web.jsx
git commit -m "feat(gps): live position avatar marker + start/end icon dots in LiveTrajectoryMap"
```

---

### Task 4: `RouteMapPreview` — icon dots

**Files:**
- Modify: `components/team/route-map-preview.jsx`
- Modify: `components/team/route-map-preview.web.jsx`

**Interfaces:**
- Consumes: `ROUTE_MARKER_META` from Task 2.
- Produces: no prop/signature changes — purely visual (icon added to the existing dot).

- [ ] **Step 1: Native — `route-map-preview.jsx`**

Add the import:

```js
import { ROUTE_MARKER_META } from '../../utils/route-marker-meta.js';
import { MaterialCommunityIcons } from '@expo/vector-icons';
```

Replace the `RouteMarker` function's signature and dot (it currently takes `color`/`label` as separate props — switch to a single `meta` prop, mirroring Task 3's `TrajectoryMarker`):

```jsx
function RouteMarker({ point, meta, idPrefix, active, onToggle, labelBelow, addressLabel }) {
  return (
    <Marker anchor="bottom" id={idPrefix} lngLat={point} onPress={onToggle}>
      {/* El dot es el ÚNICO hijo en flujo normal -- `anchor="bottom"` ancla
          el Marker entero contra el borde inferior de su contenido
          renderizado, así que si la etiqueta pasara a ser un sibling
          normal DESPUÉS del dot (caso labelBelow), el punto visualmente ya
          no coincidiría con la coordenada real. La etiqueta va `absolute`
          (no participa del cálculo de anchor), arriba o abajo del dot
          según `labelBelow`, con offset fijo (26 = 22px dot + 2px border
          x2) en vez de porcentual. Dot agrandado de 14 a 22px y con un
          ícono adentro (pedido real 2026-10-24, mismo tratamiento que
          live-trajectory-map.jsx -- ver ROUTE_MARKER_META). */}
      <View className="items-center" nativeID={idPrefix} style={{ width: LABEL_BAND_WIDTH }} testID={idPrefix}>
        <View
          className="items-center justify-center"
          nativeID={`${idPrefix}-dot`}
          style={{ backgroundColor: meta.color, borderColor: '#ffffff', borderRadius: 11, borderWidth: 2, height: 22, width: 22 }}
          testID={`${idPrefix}-dot`}
        >
          <MaterialCommunityIcons color="#ffffff" name={meta.icon} size={12} />
        </View>
        {active && (
          <View
            className="absolute left-0 right-0 items-center"
            nativeID={`${idPrefix}-label-wrap`}
            style={labelBelow ? { top: 26 } : { bottom: 26 }}
            testID={`${idPrefix}-label-wrap`}
          >
            <View className="rounded-md px-2 py-1" nativeID={`${idPrefix}-label`} style={{ backgroundColor: meta.color }} testID={`${idPrefix}-label`}>
              <Text className="text-xs font-semibold text-white" nativeID={`${idPrefix}-label-text`} numberOfLines={1} testID={`${idPrefix}-label-text`}>
                {meta.label}
              </Text>
            </View>
            {addressLabel && (
              <Pressable
                className="mt-1 max-w-full rounded-md bg-white px-2 py-0.5"
                nativeID={`${idPrefix}-address`}
                onPress={() => openLocationInMaps({ lat: point[1], lng: point[0] })}
                testID={`${idPrefix}-address`}
              >
                <Text className="text-[10px] font-medium text-primary underline" nativeID={`${idPrefix}-address-label`} numberOfLines={1} testID={`${idPrefix}-address-label`}>
                  {addressLabel}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Marker>
  );
}
```

Update the two `<RouteMarker>` call sites (inside `RouteMapPreview`) to pass `meta={ROUTE_MARKER_META.start}`/`meta={ROUTE_MARKER_META.end}` instead of the separate `color`/`label` props:

```jsx
{mapReady && points.length >= 1 && (
  <RouteMarker
    active={activeMarker === 'start'}
    addressLabel={startAddressLabel}
    idPrefix={`${nativeID}-start-marker`}
    labelBelow={startLabelBelow}
    meta={ROUTE_MARKER_META.start}
    onToggle={() => handleMarkerToggle('start')}
    point={points[0]}
  />
)}
{mapReady && points.length >= 2 && (
  <RouteMarker
    active={activeMarker === 'end'}
    addressLabel={endAddressLabel}
    idPrefix={`${nativeID}-end-marker`}
    labelBelow={endLabelBelow}
    meta={ROUTE_MARKER_META.end}
    onToggle={() => handleMarkerToggle('end')}
    point={points[points.length - 1]}
  />
)}
```

- [ ] **Step 2: Web — `route-map-preview.web.jsx`**

Add the import:

```js
import { ROUTE_MARKER_META } from '../../utils/route-marker-meta.js';
```

Replace `buildMarker(color, label)` with the icon-aware version (same shape as Task 3's web `buildMarker`):

```js
function buildMarker(meta) {
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
  dot.addEventListener('mouseenter', () => { positionTooltip(); tooltip.style.opacity = '1'; });
  dot.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  return { element: dot, destroy: () => tooltip.remove() };
}
```

Update the two call sites inside the `map.on('load', ...)` handler:

```js
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
```

- [ ] **Step 3: Run tests + lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add components/team/route-map-preview.jsx components/team/route-map-preview.web.jsx
git commit -m "feat(gps): start/end icon dots in RouteMapPreview (shared meta)"
```

---

### Task 5: `route-attempt-live-screen.jsx` integration + sampling frequency

**Files:**
- Modify: `components/session-runtime/route-attempt-live-screen.jsx`
- Modify: `hooks/use-gps-tracker.js`

**Interfaces:**
- Consumes: `smoothGpsPoint` from Task 1; `currentPosition`/`currentUserPhotoUrl`/`currentUserInitials` props on `LiveTrajectoryMap` from Task 3; `useUser` from `hooks/use-user.js`; `getUserInitials` from `utils/user-initials.js`.

- [ ] **Step 1: `hooks/use-gps-tracker.js` — lower `timeInterval`**

Change line 60 (`timeInterval: 1000,`) to `timeInterval: 500,`. Update the comment above it:

```js
// 500ms / 1m: con el suavizado por accuracy (ver utils/distance.js#smoothGpsPoint,
// que atenúa el ruido de muestras más frecuentes) tiene sentido pedir el
// doble de densidad que antes para un trazo/ícono más fluidos. Los
// filtros de acceptGpsLeg siguen siendo la primera barrera para el
// ruido, el suavizado es la segunda, solo para lo que se dibuja.
timeInterval: 500,
distanceInterval: 1,
```

- [ ] **Step 2: `route-attempt-live-screen.jsx` — imports**

Add imports (near the existing ones):

```js
import { acceptGpsLeg, formatMeters, smoothGpsPoint } from '../../utils/distance.js';
```

(this replaces the existing `import { acceptGpsLeg, formatMeters } from '../../utils/distance.js';` line — just add `smoothGpsPoint` to the same import)

```js
import { useUser } from '../../hooks/use-user.js';
import { getUserInitials } from '../../utils/user-initials.js';
```

- [ ] **Step 3: `route-attempt-live-screen.jsx` — fetch the viewer's user data**

Right after `const userId = useAuthStore((s) => s.userId);` (line 331), add:

```js
const { user } = useUser(userId);
```

- [ ] **Step 4: `route-attempt-live-screen.jsx` — new ref for the smoothed point**

Right after `const lastPointRef = useRef(null);` (line 358), add:

```js
// Punto suavizado (ver utils/distance.js#smoothGpsPoint) -- en paralelo
// a lastPointRef (que sigue siendo la referencia CRUDA para el gate de
// acceptGpsLeg, sin cambios). Este es el que se dibuja (trazo + ícono
// de posición), nunca el que calcula distancia.
const lastSmoothedPointRef = useRef(null);
```

- [ ] **Step 5: `route-attempt-live-screen.jsx` — wire smoothing into `handleGpsPoint`**

Replace the full `handleGpsPoint` function:

```js
const handleGpsPoint = async ({ latitude, longitude, timestamp, accuracy }) => {
  if (!gpsActiveRef.current || !set) return;
  const point = { latitude, longitude, timestamp, accuracy };
  if (!lastPointRef.current) {
    lastPointRef.current = point;
    lastSmoothedPointRef.current = { latitude, longitude };
    pointOrderRef.current = 0;
    await insertGpsPoint(set.id, 0, latitude, longitude, timestamp ?? Date.now());
    distanceRef.current = 0;
    setDistance(0);
    await updateSetDistance(set.id, 0);
    setTracePoints((prev) => [...prev, lastSmoothedPointRef.current]);
    return;
  }
  const leg = acceptGpsLeg({ from: lastPointRef.current, to: point });
  if (leg == null) return;
  lastPointRef.current = point;
  const smoothed = smoothGpsPoint(lastSmoothedPointRef.current, point);
  lastSmoothedPointRef.current = smoothed;
  pointOrderRef.current += 1;
  await insertGpsPoint(set.id, pointOrderRef.current, latitude, longitude, timestamp ?? Date.now());
  setTracePoints((prev) => [...prev, smoothed]);
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
  if (leg > 0) {
    const nextDistance = (distanceRef.current ?? 0) + leg;
    distanceRef.current = nextDistance;
    setDistance(nextDistance);
    await updateSetDistance(set.id, nextDistance);
  }
};
```

(Note: `insertGpsPoint`/`driftMeters`/`leg`/`distanceRef` all keep using the RAW `latitude`/`longitude`/`point` — unchanged. Only the two `setTracePoints` calls switch from the raw `{ latitude, longitude }` to the smoothed point.)

- [ ] **Step 6: `route-attempt-live-screen.jsx` — pass the new props to `LiveTrajectoryMap`**

Replace the `<LiveTrajectoryMap>` call (around line 660):

```jsx
<LiveTrajectoryMap
  currentPosition={tracePoints[tracePoints.length - 1] ?? null}
  currentUserInitials={getUserInitials(user)}
  currentUserPhotoUrl={user?.photoUrl ?? null}
  referenceRoute={routeAttempt.route}
  traveledPoints={tracePoints}
/>
```

- [ ] **Step 7: Run tests + lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 8: Commit**

```bash
git add components/session-runtime/route-attempt-live-screen.jsx hooks/use-gps-tracker.js
git commit -m "feat(gps): wire smoothing + live avatar marker into route-attempt-live-screen"
```

---

### Task 6: Final regression + manual preview verification

**Files:** none (verification only).

- [ ] **Step 1: Full test + lint pass**

Run: `npm test && npm run lint`
Expected: both green, no new warnings beyond the 4 pre-existing ones already documented in this branch's history.

- [ ] **Step 2: Web preview — `RouteMapPreview` icon dots**

Navigate to a screen showing a route preview (e.g. a route-type competition's detail in `competitions-tab.jsx`, or the pre-start screen). Confirm via `preview_inspect`/`preview_eval`: both start and end dots are 22px, show a white flag glyph (`flag-outline` vs `flag-checkered`), hover still shows the tooltip with the right label/color.

- [ ] **Step 3: Web preview — `LiveTrajectoryMap` icon dots + avatar marker**

This screen (`route-attempt-live-screen.jsx`) requires an actual GPS-gated attempt flow to reach — if reachable via mocks without live GPS (check how the mock `useGpsTracker` behaves, or whether the screen can be reached and rendered with an empty/synthetic `tracePoints` state for visual inspection), confirm: start/end dots show icons, and once `tracePoints` has at least one entry, the avatar marker renders at the last point (mock user's photo or initials, matching `AvatarPicker`'s look).

If the live GPS flow can't be exercised in the web preview (likely, given it's gated by real device GPS permissions), note this explicitly rather than claiming it was verified — fall back to a static code read-through confirming prop wiring is correct, and flag that full verification needs a native device (same category of limitation already documented for this screen in prior plans on this branch).

- [ ] **Step 4: Note native-only verification gap**

Native avatar marker (`AvatarPicker` inside `Marker`), native icon dots, and the actual GPS sampling-frequency/smoothing behavior under real movement cannot be verified in this environment (no real GPS, no native build runner here) — this matches the project's already-documented preview limitations for `live-trajectory-map.jsx`. Report this clearly to the user rather than claiming native verification that didn't happen.

- [ ] **Step 5: Final commit if any fixes were needed during verification**

If Steps 2-4 surfaced a bug, fix it, re-run `npm test && npm run lint`, commit the fix with a clear message. If everything passed as designed, no additional commit needed (verification-only task).
