# Calidad de GPS + marcadores en vivo — diseño

**Fecha:** 2026-10-24
**Rama:** `feature/route-competitions-polish`
**Pedido original:** "mejoras de GPS: lecturas frecuentes, icono de posicion en mapa de trayectoria en vivo, ponderacion de lecturas para mayor precision" + (surgido durante el diseño) "los iconos de inicio y fin [deberían tener] ademas del tooltip... un icono alusivo... distinto para cada caso. esto deberia aplicarse en todos lados" + "el icono de marcador de posicion actual debe ser el tipico icono con la foto de perfil del user (fallback a icon con iniciales)".

Paso 2 del roadmap acordado para esta rama (ver memoria
`gamification-branch-post-multiattempt-roadmap`): después de intentos
múltiples configurables (Gap 36, ya shippeado), mejorar la calidad de
lectura GPS antes de cerrar la rama.

## Alcance

**Esta rama:** solo `route-attempt-live-screen.jsx` (intento de competencia
de ruta) — es la única pantalla con mapa en vivo hoy. La sesión en vivo
del corredor (asíncrona/presencial, `training-session-active-screen.jsx`)
todavía no tiene mapa persistente — eso es un rework futuro ya anotado en
el roadmap, fuera de esta rama.

**Construido para reusarse después:** tanto el componente de mapa
(`LiveTrajectoryMap`) como la función de suavizado (`smoothGpsPoint`) se
diseñan genéricos a propósito — el equipo ya tiene en mente reusarlos
para el rework de sesión en vivo y para un futuro módulo nuevo
("entrenamiento individual sin equipo, dar play y correr"). No se
cablea nada específico de competencias en las piezas compartidas.

**Marcadores de inicio/fin con ícono:** aplica a los dos lugares que
hoy muestran ese patrón (dot + tooltip) — `live-trajectory-map.jsx`/
`.web.jsx` y `route-map-preview.jsx`/`.web.jsx`. **No** aplica a
`route-draw-picker.jsx`/`.web.jsx` — ese usa círculos GeoJSON
(`type: 'circle'`), un mecanismo completamente distinto, no un
`Marker`/`maplibregl.Marker`.

## Verificación previa (para no repetir el bug de `GeoJSONSource.shape`)

Todo lo siguiente se confirmó contra código real instalado, no contra
memoria/documentación, antes de diseñar sobre esto:

- **Nativo, `Marker` de `@maplibre/maplibre-react-native`**
  (`node_modules/@maplibre/maplibre-react-native/lib/typescript/commonjs/components/annotations/marker/Marker.d.ts`):
  `lngLat: LngLat` (array `[lng, lat]`), `children: ReactElement` (acepta
  cualquier árbol RN), `onPress`, `anchor`. Ya es el patrón que usan
  `TrajectoryMarker`/`RouteMarker` hoy.
- **Web, `maplibregl.Marker`**
  (`node_modules/maplibre-gl/dist/maplibre-gl.d.ts`): constructor acepta
  `element?: HTMLElement` — nodo DOM crudo. Patrón ya usado hoy
  (`buildMarker()` en ambos `.web.jsx`).
- **Glyphs de ícono** — `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json`:
  `flag-outline` = `0xf023d`, `flag-checkered` = `0xf023c`.
  `createIconSet(glyphMap, 'material-community', font)` — el font-family
  real en web es `'material-community'`. Confirmado en vivo (preview):
  `document.fonts` lista `'material-community'` ya registrado, y un
  `<span style="font-family:material-community">` con el codepoint
  renderiza contenido real (ancho/alto no-cero), no un glyph faltante.
- **`AvatarPicker`** (`components/shared/avatar-picker.jsx`): sin
  `onPick`/`onRemove` queda de solo lectura (sin lápiz, sin basurero) —
  reusable tal cual como `children` de un `Marker` nativo. En web no se
  puede montar (es un componente RN) — hay que rehacer la lógica a mano
  en el DOM crudo del marcador. Colores (`tailwind.config.js`):
  `primary-tint` = `#dcec9e` (fondo), `on-primary-tint` = `#3c6b12`
  (texto de iniciales).
- **`utils/user-initials.js#getUserInitials`** — función pura, sin
  dependencia de RN, reusable en el builder web tal cual.

## Arquitectura

### 1. Suavizado de puntos (`utils/distance.js#smoothGpsPoint`)

Media móvil exponencial ponderada por `accuracy` — mejor precisión
(`accuracy` más bajo) pesa más hacia el punto crudo nuevo; peor
precisión (pero que ya pasó el filtro de `acceptGpsLeg`) pesa más hacia
el historial ya suavizado:

```js
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

Sin `accuracy` (caso raro, no debería pasar si ya cruzó `acceptGpsLeg`,
pero defensivo): se trata como `alphaMax` (confío en el punto crudo, no
penalizo por un dato que no puedo evaluar) — mismo criterio permisivo
que ya usa `acceptGpsLeg` con `accuracy` ausente.

**Decisión clave — el suavizado NO toca la distancia total.** La
distancia de un intento alimenta `compliance_ratio` y se persiste al
backend — sigue saliendo 100% del cálculo actual (`leg` que devuelve
`acceptGpsLeg`, tramo crudo-a-crudo, sin cambios). El suavizado solo
afecta **qué coordenadas se dibujan** (el trazo del mapa) y **dónde se
posiciona el ícono de "acá estoy"** — nunca el número de metros
recorridos ni lo que se persiste vía `insertGpsPoint` (eso sigue
guardando las coordenadas crudas, igual que hoy).

**El filtro de aceptación sigue comparando crudo-contra-crudo**, no
contra el punto suavizado — el suavizado atrasa un poco por diseño
(es una EMA), así que compararlo contra el suavizado podría rechazar
movimiento real por "velocidad implícita" falsa contra una referencia
que va un paso atrás. `lastPointRef` (la referencia del gate) y un
nuevo `lastSmoothedPointRef` (la referencia para trazo/ícono) viven en
paralelo, cada uno con su propio propósito.

### 2. Frecuencia (`hooks/use-gps-tracker.js`)

`timeInterval: 1000` → `500`. `Location.Accuracy.High` y
`distanceInterval: 1` sin tocar (no se vuelve a `BestForNavigation`,
que ya se probó y se descartó por jitter estando quieto). Este hook lo
comparte `training-session-active-screen.jsx` (por serie) con
`route-attempt-live-screen.jsx` — el cambio de frecuencia le llega
también a la sesión normal, sin cambiar su lógica (mismo filtro de
aceptación que ya tiene, solo más muestras de entrada).

### 3. Integración en `route-attempt-live-screen.jsx`

`handleGpsPoint` (línea ~433 hoy) gana un `lastSmoothedPointRef` nuevo,
en paralelo al `lastPointRef` existente. Los dos `setTracePoints(...)`
(primer punto y puntos subsiguientes) pasan a empujar el punto
**suavizado**, no el crudo — `insertGpsPoint`/`leg`/`distanceRef`
siguen usando las coordenadas crudas sin ningún cambio:

```js
// primer punto:
lastSmoothedPointRef.current = { latitude, longitude };
setTracePoints((prev) => [...prev, lastSmoothedPointRef.current]);

// puntos subsiguientes, después de que acceptGpsLeg acepta el tramo:
const smoothed = smoothGpsPoint(lastSmoothedPointRef.current, point);
lastSmoothedPointRef.current = smoothed;
setTracePoints((prev) => [...prev, smoothed]);
```

`route-attempt-live-screen.jsx` suma `useUser(userId)` (mismo patrón
que `leaderboard-tab.jsx`) para `photoUrl`/`name`/`surname` del
corredor. `<LiveTrajectoryMap>` recibe 3 props nuevos:
- `currentPosition` — `tracePoints[tracePoints.length - 1] ?? null` (el
  último punto suavizado, derivado en cada render, sin estado nuevo).
- `currentUserPhotoUrl` — `user?.photoUrl ?? null`.
- `currentUserInitials` — `getUserInitials(user)`.

### 4. Marcador de posición (`LiveTrajectoryMap`/`.web.jsx`)

**Nativo:** nuevo `children` de `Marker` cuando `currentPosition` está
presente — `<AvatarPicker uri={currentUserPhotoUrl} initials={currentUserInitials} size={32} fallbackIcon="account" idPrefix="live-trajectory-map-current-position" accessibilityLabel="Tu posición actual" />`, sin `onPick`/`onRemove` (solo lectura). Un borde blanco alrededor
(`View` contenedor con `borderRadius`/`borderWidth`/`borderColor:
'#fff'`) para que se distinga del fondo del mapa, mismo criterio visual
que los dots de inicio/fin (borde blanco de 2px).

**Web:** nueva función en `.web.jsx` (mismo archivo, al lado de
`buildMarker`) que arma el nodo DOM a mano — círculo 32px, `<img
src={photoUrl}>` si hay foto (con `onerror` cayendo a iniciales, mismo
criterio que `AvatarPicker`), si no `<div>` con las iniciales
centradas, `font-size` proporcional (`size * 0.35`, igual que
`AvatarPicker`), colores `#dcec9e`/`#3c6b12`, borde blanco 2px. Se
actualiza (no se recrea el marker en cada punto) vía
`marker.setLngLat([lng, lat])` en el efecto que ya reacciona a cambios
de `traveledPoints`.

### 5. Íconos en marcadores de inicio/fin

Nuevo archivo chico, `utils/route-marker-meta.js` — hoy el color y el
label de inicio/fin están duplicados en 4 lugares (`live-trajectory-map.jsx`,
`.web.jsx`, `route-map-preview.jsx`, `.web.jsx`) con los mismos valores
exactos; se centraliza:

```js
export const ROUTE_MARKER_META = {
  start: { color: '#ef4444', label: 'Punto de inicio', icon: 'flag-outline', iconCodepoint: 0xf023d },
  end: { color: '#2563eb', label: 'Punto de llegada', icon: 'flag-checkered', iconCodepoint: 0xf023c },
};
```

**Nativo** (`TrajectoryMarker` en `live-trajectory-map.jsx`,
`RouteMarker` en `route-map-preview.jsx`): el dot (hoy un `View` vacío
de 14x14) pasa a tener un `MaterialCommunityIcons` adentro, centrado —
dot agrandado a algo como 22x22 para que el ícono entre legible
(tamaño exacto a definir en el plan, no crítico para el diseño).

**Web** (`buildMarker` en ambos `.web.jsx`): el `<div>` del dot suma un
`<span>` hijo centrado con `font-family: 'material-community'` y
`textContent = String.fromCodePoint(iconCodepoint)`, color blanco —
mismo glyph, mismo tamaño visual que nativo, verificado arriba que
renderiza de verdad.

El tooltip existente (hover en web, tap en nativo) **no cambia** — el
ícono es adicional al tooltip, no lo reemplaza.

## Archivos afectados

- **Modificar:** `utils/distance.js` (suma `smoothGpsPoint`),
  `hooks/use-gps-tracker.js` (timeInterval), `components/session-runtime/route-attempt-live-screen.jsx`
  (integración + `useUser`), `components/session-runtime/live-trajectory-map.jsx`
  y `.web.jsx` (marcador de posición + ícono en dots),
  `components/team/route-map-preview.jsx` y `.web.jsx` (ícono en dots).
- **Crear:** `utils/route-marker-meta.js`.

## Testing

- `smoothGpsPoint` — función pura, nueva, testeable: alpha alto con
  buena precisión, alpha bajo (clampeado a `alphaMin`) con precisión
  mala-pero-aceptada, primer punto sin historial pasa tal cual, sin
  `accuracy` usa `alphaMax`.
- `acceptGpsLeg` — sin cambios, tests existentes siguen válidos tal
  cual (el gate sigue comparando crudo-contra-crudo).
- Sin tests de componente (convención del repo) — el marcador de
  posición/íconos se verifica a mano en preview (web) y en dispositivo
  real (nativo, mapa no es simulable en preview — mismo límite ya
  documentado para `live-trajectory-map.jsx`).

## Referencias

- Roadmap acordado: memoria `gamification-branch-post-multiattempt-roadmap`.
- `acceptGpsLeg`/filtro de calidad actual: `utils/distance.js`, pedido
  real 2026-09-25 (CLAUDE.md, sección GPS).
- Bug histórico de prop mal nombrada en maplibre (`GeoJSONSource.shape`
  vs `.data`): `CLAUDE.md`, motivo de la verificación exhaustiva de
  arriba antes de diseñar sobre las APIs de `Marker`.
