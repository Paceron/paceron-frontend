# Mapa en vivo + pulido visual del corredor (pre-start y sesión en vivo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El corredor ve un mapa en vivo de toda la sesión (async y presencial) mientras entrena, con ícono de inicio, ícono de fin (al terminar), fullscreen y recentrar — más una pasada de pulido visual en esas 2 pantallas y en el pre-start compartido.

**Architecture:** Dos props aditivas en `LiveTrajectoryMap` (nativo + web, ya construido para competencias) + un componente nuevo `LiveSessionMapPanel` que lo envuelve con los 2 botones flotantes. El GPS de la pantalla async converge al mismo modelo continuo que ya usa la presencial (`useSessionGpsTracker`, nunca se detiene, la distancia por serie se gatea aparte). Layout 50/50 (mapa arriba, contenido abajo) vía flexbox, con fullscreen ocultando el contenido de abajo — mismo patrón ya usado en `trainer-session-live-screen.jsx`.

**Tech Stack:** React Native + Expo, `@maplibre/maplibre-react-native` (nativo) / `maplibre-gl` (web), NativeWind, Zustand, `react-native-reanimated`.

**Spec:** `docs/superpowers/specs/2026-10-29-runner-live-session-map-design.md`

## Global Constraints

- Mobile-only (`MobileOnlyRoute`), sin fallback web funcional en estas 3 pantallas — el mapa web (`live-trajectory-map.web.jsx`) sigue construyéndose dual-plataforma por diseño (ya lo era), pero no es alcanzable en preview para este trabajo, igual que el resto de este subsistema.
- La distancia medida por serie NUNCA se toca — sigue saliendo de `acceptGpsLeg` sobre puntos crudos, exactamente igual que hoy. El trazo del mapa es puramente de display, usa `smoothGpsPoint`.
- `nativeID`/`testID` obligatorios en todo elemento visual nuevo (lint-enforced, `local/require-native-id`).
- Clases `dark:` en todo texto/fondo nuevo — ya se encontró un caso real roto esta rama (cronómetro sin color en `route-attempt-live-screen.jsx`).
- Sin tests de render de componentes (convención del repo) — los cambios de UI se verifican con `npm test`/`npm run lint` (regresión) + preview manual donde sea posible.
- Un solo trazo de sesión, sin segmentar por serie — el fragmento por serie es un pedido para `session-review-screen.jsx` (futuro, fuera de esta rama), no para esta.

---

### Task 1: `live-trajectory-map.jsx` (nativo) — 2 props aditivas

**Files:**
- Modify: `components/session-runtime/live-trajectory-map.jsx`

**Interfaces:**
- Produces: `LiveTrajectoryMap` gana `hideReferenceLine` (bool, default `false`) y `recenterSignal` (any, default `undefined`) — ningún caller existente (competencias) los pasa, comportamiento sin cambios para ellos.
- Consumes: ninguno nuevo (sigue usando `ROUTE_MARKER_META`, `computeBounds`/`expandBounds`, `AvatarPicker` tal cual).

- [ ] **Step 1: Cambiar la firma de la función**

En `components/session-runtime/live-trajectory-map.jsx`, reemplazar:

```js
export function LiveTrajectoryMap({ traveledPoints, referenceRoute, currentPosition, currentUserPhotoUrl, currentUserInitials }) {
```

por:

```js
export function LiveTrajectoryMap({ traveledPoints, referenceRoute, currentPosition, currentUserPhotoUrl, currentUserInitials, hideReferenceLine = false, recenterSignal }) {
```

- [ ] **Step 2: Gatear la línea de referencia con `hideReferenceLine`**

Reemplazar:

```jsx
        {referenceCoords.length > 1 && (
          <GeoJSONSource data={{ type: 'Feature', geometry: referenceRoute, properties: {} }} id="live-trajectory-map-reference-source">
            <Layer id="live-trajectory-map-reference-layer" style={{ lineColor: '#94a3b8', lineWidth: 3, lineDasharray: [2, 2] }} type="line" />
          </GeoJSONSource>
        )}
```

por:

```jsx
        {!hideReferenceLine && referenceCoords.length > 1 && (
          <GeoJSONSource data={{ type: 'Feature', geometry: referenceRoute, properties: {} }} id="live-trajectory-map-reference-source">
            <Layer id="live-trajectory-map-reference-layer" style={{ lineColor: '#94a3b8', lineWidth: 3, lineDasharray: [2, 2] }} type="line" />
          </GeoJSONSource>
        )}
```

Los markers de inicio/fin (`referenceCoords.length >= 1` / `>= 2`) NO cambian — siguen dibujándose con o sin `hideReferenceLine` (esta prop solo apaga la línea punteada entre ellos, nunca los markers).

- [ ] **Step 3: Agregar el efecto de `recenterSignal`**

Agregar, justo después de la línea `const currentPositionLngLat = currentPosition ? [currentPosition.longitude, currentPosition.latitude] : null;` (y antes del `return`):

```js
  // Gatillado por cambio de prop (un contador que el caller incrementa en su
  // botón de recentrar) en vez de exponer `cameraRef` hacia afuera -- este
  // componente sigue sin dar acceso a su cámara a quien lo usa.
  useEffect(() => {
    if (recenterSignal == null || !currentPositionLngLat) return;
    cameraRef.current?.flyTo({ center: currentPositionLngLat, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);
```

Agregar `useEffect` al import de React en la primera línea del archivo:

```js
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos (componente presentacional, sin tests de render en este repo — la verificación real es manual, en preview, más adelante cuando el panel que lo consume esté armado).

- [ ] **Step 5: Commit**

```bash
git add components/session-runtime/live-trajectory-map.jsx
git commit -m "feat(session-runtime): add hideReferenceLine + recenterSignal to LiveTrajectoryMap"
```

---

### Task 2: `live-trajectory-map.web.jsx` — mismas 2 props

**Files:**
- Modify: `components/session-runtime/live-trajectory-map.web.jsx`

**Interfaces:**
- Produces: mismo contrato que Task 1, para la variante web.

- [ ] **Step 1: Cambiar la firma de la función**

Reemplazar:

```js
export function LiveTrajectoryMap({ traveledPoints, referenceRoute, currentPosition, currentUserPhotoUrl, currentUserInitials }) {
```

por:

```js
export function LiveTrajectoryMap({ traveledPoints, referenceRoute, currentPosition, currentUserPhotoUrl, currentUserInitials, hideReferenceLine = false, recenterSignal }) {
```

- [ ] **Step 2: Gatear la línea de referencia con `hideReferenceLine`**

Dentro del callback `map.on('load', () => { ... })` del primer efecto, reemplazar:

```js
      const refCoords = referenceRoute?.coordinates ?? [];
      if (refCoords.length > 1) {
        map.addSource('live-trajectory-map-reference', { type: 'geojson', data: { type: 'Feature', geometry: referenceRoute, properties: {} } });
        map.addLayer({ id: 'live-trajectory-map-reference-layer', type: 'line', source: 'live-trajectory-map-reference', paint: { 'line-color': '#94a3b8', 'line-width': 3, 'line-dasharray': [2, 2] } });
      }
```

por:

```js
      const refCoords = referenceRoute?.coordinates ?? [];
      if (!hideReferenceLine && refCoords.length > 1) {
        map.addSource('live-trajectory-map-reference', { type: 'geojson', data: { type: 'Feature', geometry: referenceRoute, properties: {} } });
        map.addLayer({ id: 'live-trajectory-map-reference-layer', type: 'line', source: 'live-trajectory-map-reference', paint: { 'line-color': '#94a3b8', 'line-width': 3, 'line-dasharray': [2, 2] } });
      }
```

Nota: esta rama NO corrige que los markers de inicio/fin de esta variante web solo se crean una vez al montar (closure de `referenceRoute` capturado en el mount effect, `deps: []`) — si `referenceRoute` ganara su punto de fin DESPUÉS del montaje (nuestro caso: la sesión termina mucho después de que el panel ya está montado), el marker de fin no aparecería en web. Es una limitación ya aceptada para este componente (igual que el avatar de posición, documentado en la verificación de la rama anterior) porque las 3 pantallas que lo usan son `MobileOnlyRoute` — sin alcance real en web hoy. No se toca sin un caso real que lo necesite.

- [ ] **Step 3: Agregar el efecto de `recenterSignal`**

Agregar, dentro del componente, después del efecto que maneja `currentPositionMarkerRef` (el que reacciona a `[currentPosition]`):

```js
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterSignal == null || !currentPosition) return;
    map.flyTo({ center: [currentPosition.longitude, currentPosition.latitude], duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos.

- [ ] **Step 5: Commit**

```bash
git add components/session-runtime/live-trajectory-map.web.jsx
git commit -m "feat(session-runtime): add hideReferenceLine + recenterSignal to LiveTrajectoryMap.web"
```

---

### Task 3: `live-session-map-panel.jsx` — componente nuevo

**Files:**
- Create: `components/session-runtime/live-session-map-panel.jsx`

**Interfaces:**
- Consumes: `LiveTrajectoryMap` (Tasks 1-2) con `hideReferenceLine`/`recenterSignal`; `useThemeColors` (`theme/colors.js`).
- Produces: `LiveSessionMapPanel({ tracePoints, currentUserPhotoUrl, currentUserInitials, finished, fullscreen, onToggleFullscreen })` — componente default-export-less (named export), usado por Tasks 5 y 7.
  - `tracePoints`: array de `{ latitude, longitude }` (ya suavizados por el caller), orden cronológico.
  - `finished`: bool — true recién cuando la sesión terminó.
  - `fullscreen`/`onToggleFullscreen`: estado levantado, vive en la pantalla que lo usa.

- [ ] **Step 1: Crear el componente**

```jsx
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

// Mapa compartido por las pantallas en vivo del corredor para entrenamiento
// NORMAL (async y presencial) -- las competencias de ruta ya tienen el suyo
// propio (route-attempt-live-screen.jsx). Un solo trazo de toda la sesión,
// sin segmentar por serie (ver docs/superpowers/specs/
// 2026-10-29-runner-live-session-map-design.md): el inicio se marca desde el
// primer punto, el fin recién al terminar la sesión -- mientras corre, lo
// que se ve es el avatar de posición en vivo (ya construido en
// LiveTrajectoryMap), no hay "fin" todavía.
export function LiveSessionMapPanel({ tracePoints, currentUserPhotoUrl, currentUserInitials, finished, fullscreen, onToggleFullscreen }) {
  const colors = useThemeColors();
  const [recenterSignal, setRecenterSignal] = useState(0);

  const startPoint = tracePoints?.[0] ?? null;
  const endPoint = finished ? tracePoints?.[tracePoints.length - 1] ?? null : null;
  const referenceRoute = {
    type: 'LineString',
    coordinates: startPoint
      ? [[startPoint.longitude, startPoint.latitude], ...(endPoint ? [[endPoint.longitude, endPoint.latitude]] : [])]
      : [],
  };
  const currentPosition = finished ? null : tracePoints?.[tracePoints.length - 1] ?? null;

  return (
    <View className="flex-1 overflow-hidden" nativeID="live-session-map-panel" testID="live-session-map-panel">
      <LiveTrajectoryMap
        currentPosition={currentPosition}
        currentUserInitials={currentUserInitials}
        currentUserPhotoUrl={currentUserPhotoUrl}
        hideReferenceLine
        recenterSignal={recenterSignal}
        referenceRoute={referenceRoute}
        traveledPoints={tracePoints ?? []}
      />
      <View className="absolute right-3 top-3 gap-2" nativeID="live-session-map-panel-buttons" testID="live-session-map-panel-buttons">
        <Pressable
          accessibilityHint="Agranda o reduce el mapa de la sesión"
          accessibilityLabel={fullscreen ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'}
          className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
          nativeID="live-session-map-panel-fullscreen-button"
          onPress={onToggleFullscreen}
          testID="live-session-map-panel-fullscreen-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} />
        </Pressable>
        <Pressable
          accessibilityHint="Vuelve a centrar el mapa en tu posición actual"
          accessibilityLabel="Centrar mapa en mi posición"
          className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
          nativeID="live-session-map-panel-recenter-button"
          onPress={() => setRecenterSignal((v) => v + 1)}
          testID="live-session-map-panel-recenter-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-radius-outline" size={22} />
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/session-runtime/live-session-map-panel.jsx
git commit -m "feat(session-runtime): add LiveSessionMapPanel shared component"
```

---

### Task 4: GPS continuo del lado presencial — trazo de sesión + intervalo

**Files:**
- Modify: `hooks/use-live-session-runtime.js`
- Modify: `hooks/use-session-gps-tracker.js`

**Interfaces:**
- Consumes: `smoothGpsPoint` (`utils/distance.js`, ya existe, firma `smoothGpsPoint(previousSmoothed, rawPoint, options?)`).
- Produces: `useLiveSessionRuntime()` devuelve un campo nuevo `tracePoints` (array de `{latitude, longitude}`, consumido por Task 5).

- [ ] **Step 1: Subir el intervalo del tracker continuo a 500ms**

En `hooks/use-session-gps-tracker.js`, reemplazar:

```js
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
```

por:

```js
          {
            accuracy: Location.Accuracy.High,
            // 500ms -- mismo ajuste ya aplicado a use-gps-tracker.js (ver
            // utils/distance.js#smoothGpsPoint, que atenúa el ruido de
            // muestras más frecuentes): las dos modalidades miden con la
            // misma frecuencia.
            timeInterval: 500,
            distanceInterval: 1,
          },
```

- [ ] **Step 2: Agregar el trazo de sesión en `use-live-session-runtime.js`**

Agregar el import de `smoothGpsPoint` junto al de `acceptGpsLeg`:

```js
import { acceptGpsLeg, smoothGpsPoint } from '../utils/distance.js';
```

Agregar un state y un ref nuevos, junto a los demás `useState`/`useRef` del hook (cerca de `distanceBySetId`/`distanceRef`):

```js
  const [tracePoints, setTracePoints] = useState([]);
  const lastSmoothedPointRef = useRef(null);
```

Dentro de `handleGpsPoint`, agregar el trazo ANTES del `send('presence', ...)` existente (se agrega siempre, sin importar fase/serie activa -- a diferencia de la distancia, que sigue gateada más abajo sin cambios):

```js
  const handleGpsPoint = async (point) => {
    const smoothed = smoothGpsPoint(lastSmoothedPointRef.current, point);
    lastSmoothedPointRef.current = smoothed;
    setTracePoints((prev) => [...prev, smoothed]);

    // Movimiento en vivo: SIEMPRE, haya o no serie activa -- efímero, nunca
    // se persiste. Ver spec 2026-09-28, sección "GPS continuo".
    send('presence', undefined, { event: 'position', payload: { latitude: point.latitude, longitude: point.longitude } });

    const setId = activeSetIdRef.current;
```

(El resto de la función, desde `if (!setId || activePhaseRef.current !== 'running') return;` en adelante, queda EXACTAMENTE igual -- no se toca nada de la medición de distancia.)

Agregar `tracePoints` al objeto que devuelve el hook:

```js
  return {
    booted,
    bootError,
    run,
    sets,
    connectionStatus,
    connectedPeerIds,
    pendingControl,
    clearPendingControl: () => setPendingControl(null),
    distanceBySetId,
    tracePoints,
    activeSetId,
```

(resto del objeto de retorno sin cambios)

- [ ] **Step 3: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos (sin tests de render; la lógica de distancia no cambió, sin necesidad de nuevos casos).

- [ ] **Step 4: Commit**

```bash
git add hooks/use-live-session-runtime.js hooks/use-session-gps-tracker.js
git commit -m "feat(session-runtime): continuous session trace + 500ms interval for presencial GPS"
```

---

### Task 5: `training-session-live-screen.jsx` — panel + layout 50/50 + pulido

**Files:**
- Modify: `components/session-runtime/training-session-live-screen.jsx`

**Interfaces:**
- Consumes: `LiveSessionMapPanel` (Task 3), `tracePoints` de `useLiveSessionRuntime()` (Task 4), `useUser` (`hooks/use-user.js`, ya existe: `useUser(userId) -> { user }`), `getUserInitials` (`utils/user-initials.js`, ya existe).

- [ ] **Step 1: Imports nuevos**

Agregar, junto a los imports existentes de `components/session-runtime/training-session-live-screen.jsx`:

```js
import { useUser } from '../../hooks/use-user.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { LiveSessionMapPanel } from './live-session-map-panel.jsx';
```

- [ ] **Step 2: Leer `tracePoints` del hook + estado de fullscreen + propio usuario**

Dentro de `TrainingSessionLiveScreenContent`, en la desestructuración de `useLiveSessionRuntime()`, agregar `tracePoints`:

```js
  const {
    booted,
    bootError,
    run,
    sets,
    connectionStatus,
    connectedPeerIds,
    pendingControl,
    clearPendingControl,
    distanceBySetId,
    tracePoints,
    activeSetId,
    activePhase,
    stopwatchWallMs,
    startSet,
    pauseSet,
    resumeSet,
    finishSet,
    skipSet,
    skipExercise,
    cancelSession,
    finalizeSession,
  } = useLiveSessionRuntime();
```

Agregar, junto a los demás `useState` del componente (cerca de `[mode, setMode]`):

```js
  const [fullscreenMap, setFullscreenMap] = useState(false);
```

Agregar, junto a `const { user: trainerUser } = useUser(trainerUserId);`-equivalente (en este archivo no existe todavía, agregar después de `const myUserId = useAuthStore((s) => s.userId);`):

```js
  const { user: myUser } = useUser(myUserId);
```

- [ ] **Step 3: Reemplazar el `return` del componente**

Reemplazar el bloque completo desde `return (` hasta el cierre de `</MobileOnlyRoute>` (el `return` de `TrainingSessionLiveScreenContent`) por:

```jsx
  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="training-session-live-root" testID="training-session-live-root">
        <View className="items-center py-2" nativeID="training-session-live-banner-container" testID="training-session-live-banner-container">
          {connectionStatus && <ConnectionBanner status={connectionStatus} />}
        </View>

        <View className="flex-1 px-4" nativeID="training-session-live-map-wrap" testID="training-session-live-map-wrap">
          <LiveSessionMapPanel
            currentUserInitials={getUserInitials(myUser)}
            currentUserPhotoUrl={myUser?.photoUrl ?? null}
            finished={sessionComplete}
            fullscreen={fullscreenMap}
            onToggleFullscreen={() => setFullscreenMap((v) => !v)}
            tracePoints={tracePoints}
          />
        </View>

        {!fullscreenMap && (
          <View className="flex-1" nativeID="training-session-live-content-wrap" testID="training-session-live-content-wrap">
            {currentSet ? (
              <LiveSeriesView
                activePhase={activePhase}
                distance={distanceBySetId.get(currentSet.id)}
                key={currentSet.id}
                onAdvance={advance}
                onBack={() => setMode('overview')}
                onCancelConfirmed={handleCancelConfirmed}
                onFinish={async (setId) => {
                  const snap = await handleFinishSet(setId);
                  return snap;
                }}
                onPause={pauseSet}
                onResume={resumeSet}
                onSkipExercise={handleSkipExercise}
                onSkipSeries={handleSkipSet}
                onStart={startSet}
                set={currentSet}
                totalSeriesForExercise={sets.filter((s) => s.exercise_instance_id === currentSet.exercise_instance_id).length}
                wallMs={stopwatchWallMs}
              />
            ) : (
              <LiveOverviewView
                activePhase={activePhase}
                activeSetId={activeSetId}
                onCancel={handleCancelConfirmed}
                onOpenMessages={() => setMessagesVisible(true)}
                onOpenSet={handleOpenSet}
                router={router}
                run={run}
                sets={sets}
              />
            )}
          </View>
        )}

        <Modal animationType="fade" nativeID="training-session-live-complete-modal" onRequestClose={() => { clearLiveSession(); router.back(); }} testID="training-session-live-complete-modal" transparent visible={sessionComplete}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/50 px-4"
            nativeID="training-session-live-complete-modal-backdrop"
            onPress={() => { clearLiveSession(); router.back(); }}
            testID="training-session-live-complete-modal-backdrop"
          >
            <Pressable className="w-full max-w-md items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="training-session-live-complete-modal-card" onPress={() => {}} testID="training-session-live-complete-modal-card">
              <MaterialCommunityIcons color="#16a34a" name="check-decagram" size={40} />
              <Text className="mt-2 text-xl font-bold text-slate-900 dark:text-white" nativeID="training-session-live-complete-modal-title" testID="training-session-live-complete-modal-title">¡Sesión completada!</Text>
              <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-complete-modal-subtitle" testID="training-session-live-complete-modal-subtitle">
                Completaste todos los ejercicios de la sesión.
              </Text>
              <Pressable
                className="mt-5 h-11 w-full flex-row items-center justify-center gap-2 rounded-full border border-primary bg-primary-tint active:opacity-80 dark:bg-primary/15"
                disabled={openingComparison}
                nativeID="training-session-live-complete-modal-compare-button"
                onPress={handleOpenComparison}
                testID="training-session-live-complete-modal-compare-button"
              >
                {openingComparison ? <ActivityIndicator color="#8cc63e" size="small" /> : <MaterialCommunityIcons color="#8cc63e" name="scale-balance" size={18} />}
                <Text className="text-sm font-semibold text-on-primary-tint dark:text-primary" nativeID="training-session-live-complete-modal-compare-label" testID="training-session-live-complete-modal-compare-label">
                  Ver comparación con lo planificado
                </Text>
              </Pressable>
              <Pressable
                className="mt-3 h-12 w-full items-center justify-center rounded-full bg-primary active:opacity-80"
                nativeID="training-session-live-complete-modal-close-button"
                onPress={() => { clearLiveSession(); router.back(); }}
                testID="training-session-live-complete-modal-close-button"
              >
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="training-session-live-complete-modal-close-label" testID="training-session-live-complete-modal-close-label">Terminar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <SessionMessagesModal
          connectedPeerIds={connectedPeerIds}
          idPrefix="training-session-live-messages-modal"
          isSending={isSending}
          myUserId={myUserId}
          onClose={() => setMessagesVisible(false)}
          onSend={sendMessage}
          messages={messages}
          role="runner"
          rosterMembers={peerMembers}
          trainerName={trainerName}
          trainerUserId={trainerUserId != null ? String(trainerUserId) : null}
          visible={messagesVisible}
        />
      </SafeAreaView>
    </MobileOnlyRoute>
  );
}
```

(Único cambio real de contenido respecto al original: el `View` de mapa nuevo, el `{!fullscreenMap && (...)}` envolviendo lo que antes era directo, y el `nativeID`/`testID` de ese wrapper -- el resto del JSX es idéntico al que ya existía.)

- [ ] **Step 4: Pulido visual -- cronómetro de `LiveSeriesView` más chico**

Dentro de `LiveSeriesView`, reemplazar:

```jsx
          <Text className="text-6xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
```

por:

```jsx
          <Text className="text-4xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
```

(Mismo tamaño que ya usa `route-attempt-live-screen.jsx`, pensado para un layout con mapa arriba ocupando la otra mitad de la pantalla.)

- [ ] **Step 5: Pulido visual -- accesibilidad en controles sin label**

En `HoldToCancelButton` (dentro de este mismo archivo), agregar al `Pressable`:

```jsx
    <Pressable
      accessibilityHint="Mantené presionado para cancelar la sesión completa"
      accessibilityLabel="Cancelar sesión"
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 dark:border-red-900/60 dark:bg-red-950/40 ${disabled ? 'opacity-50' : ''}`}
```

En `DragToFinishButton`, agregar al `View` con `gesture={pan}` (el que tiene `className` con `drag-track`):

```jsx
      <View
        accessibilityHint="Arrastrá hasta el final para confirmar"
        accessibilityLabel={label}
        className={`h-24 flex-1 rounded-full border ${colors.trackBg} ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
```

En `AttendanceQuickAccessButton`, agregar al `Pressable`:

```jsx
    <Pressable
      accessibilityLabel="Registrar asistencia"
      className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
```

- [ ] **Step 6: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos.

- [ ] **Step 7: Commit**

```bash
git add components/session-runtime/training-session-live-screen.jsx
git commit -m "feat(session-runtime): wire live session map panel + polish into presencial live screen"
```

---

### Task 6: `training-session-active-screen.jsx` — GPS continuo (migrar de por-serie al padre)

**Riesgo:** el más sensible de todos los tasks -- toca la medición de distancia. Se MIGRA de lugar, no de comportamiento. El patrón entero es un espejo exacto del ya probado en `use-live-session-runtime.js` (presencial) -- no se inventa nada nuevo.

**Files:**
- Modify: `components/session-runtime/training-session-active-screen.jsx`

**Interfaces:**
- Consumes: `smoothGpsPoint` (`utils/distance.js`).
- Produces: `TrainingSessionActiveScreenContent` gana estado `tracePoints`/`distanceBySetId` (consumidos por Task 7); `SeriesView` cambia de firma (ver Step 3).

- [ ] **Step 1: Agregar el import de `smoothGpsPoint`**

Reemplazar:

```js
import { acceptGpsLeg, formatMeters } from '../../utils/distance.js';
```

por:

```js
import { acceptGpsLeg, formatMeters, smoothGpsPoint } from '../../utils/distance.js';
```

- [ ] **Step 2: Levantar el GPS continuo a `TrainingSessionActiveScreenContent`**

Dentro de `TrainingSessionActiveScreenContent`, agregar (junto a los demás `useState`/`useRef`, después de `const [sessionCompleteVisible, setSessionCompleteVisible] = useState(false);`):

```js
  const [distanceBySetId, setDistanceBySetId] = useState(new Map());
  const [tracePoints, setTracePoints] = useState([]);
  const activeSetIdRef = useRef(null);
  const activePhaseRef = useRef('idle');
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  const distanceRef = useRef(new Map());
  const lastSmoothedPointRef = useRef(null);
  const gps = useGpsTracker(storeGpsEnabled);
```

Agregar `handleGpsPoint`, en el mismo nivel que `bootstrap`/`reloadSets` (después de `reloadSets`):

```js
  // Mismo patrón que use-live-session-runtime.js (presencial) -- el GPS
  // corre continuo de punta a punta, la distancia por serie se gatea aparte
  // (activePhaseRef/activeSetIdRef), y el trazo para el mapa se acumula
  // SIEMPRE, sin importar si hay una serie corriendo. `smoothGpsPoint`
  // nunca toca el cálculo de distancia, que sigue sobre puntos crudos.
  const handleGpsPoint = async (point) => {
    const smoothed = smoothGpsPoint(lastSmoothedPointRef.current, point);
    lastSmoothedPointRef.current = smoothed;
    setTracePoints((prev) => [...prev, smoothed]);

    const setId = activeSetIdRef.current;
    if (!setId || activePhaseRef.current !== 'running') return;

    if (!lastPointRef.current) {
      lastPointRef.current = point;
      pointOrderRef.current = 0;
      await insertGpsPoint(setId, 0, point.latitude, point.longitude, point.timestamp ?? Date.now());
      distanceRef.current.set(setId, 0);
      setDistanceBySetId(new Map(distanceRef.current));
      await updateSetDistance(setId, 0);
      return;
    }
    const leg = acceptGpsLeg({ from: lastPointRef.current, to: point });
    if (leg == null) return;
    lastPointRef.current = point;
    pointOrderRef.current += 1;
    await insertGpsPoint(setId, pointOrderRef.current, point.latitude, point.longitude, point.timestamp ?? Date.now());
    if (leg > 0) {
      const nextTotal = (distanceRef.current.get(setId) ?? 0) + leg;
      distanceRef.current.set(setId, nextTotal);
      setDistanceBySetId(new Map(distanceRef.current));
      await updateSetDistance(setId, nextTotal);
    }
  };
```

Agregar los dos efectos nuevos, después del `useEffect` de `bootstrap` existente:

```js
  // Arranca una sola vez, al bootear -- nunca se detiene por pausar o
  // cambiar de serie (mismo criterio que la presencial).
  useEffect(() => {
    if (!booted) return undefined;
    gps.start({ onPoint: handleGpsPoint });
    return () => { gps.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  // `currentSet` (no el `currentSetId` crudo) -- se vuelve null también al
  // volver al Overview, no solo al cambiar de serie, así que un punto
  // perdido mientras no hay ninguna serie abierta no se le atribuye a la
  // última que estuvo activa.
  useEffect(() => {
    activeSetIdRef.current = currentSet?.id ?? null;
    lastPointRef.current = null;
    pointOrderRef.current = 0;
  }, [currentSet?.id]);
```

(`currentSet` ya se calcula más abajo en el componente, antes del `return` -- ver Step 4 para moverlo arriba de estos efectos si el orden actual del archivo lo exige; en caso de necesitarlo, `currentSet` se puede derivar en una sola línea arriba de todos los hooks, ya que solo depende de `mode`/`currentSetId`/`sets`, todos ya disponibles en ese punto.)

- [ ] **Step 3: Reescribir `SeriesView` para leer distancia por prop y reportar fase**

Reemplazar la firma:

```js
function SeriesView({ set, runId, gpsEnabled, totalSeriesForExercise, onAdvance, onBack, onCancelConfirmed, onDataChanged }) {
```

por:

```js
function SeriesView({ set, runId, gpsEnabled, distance, totalSeriesForExercise, onAdvance, onBack, onCancelConfirmed, onDataChanged, onPhaseChange }) {
```

(`runId` se mantiene -- lo usa `skipExercise` más abajo, `await skipSetsForExercise(runId, set.exercise_instance_id)`, sin relación con GPS. Solo se agregan `distance`/`onPhaseChange` a la firma.)

Quitar estas líneas (ya no hacen falta, la distancia/el tracker viven en el padre):

```js
  const gps = useGpsTracker(gpsEnabled);
```

```js
  const [distance, setDistance] = useState(set.distance_meters ?? null);
```

```js
  const gpsActiveRef = useRef(false);
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  const distanceRef = useRef(set.distance_meters ?? null);
```

Agregar, en su lugar, un ref-mirror de la prop `distance` (lo necesita el timer de aviso "sin señal", que lee el valor más reciente 5s después de armarse):

```js
  const latestDistanceRef = useRef(distance);
  latestDistanceRef.current = distance;
```

Reemplazar `armGpsGrace`:

```js
  const armGpsGrace = () => {
    if (!gpsEnabled) return;
    clearGpsGrace();
    setGpsWarning(false);
    gpsGraceTimerRef.current = setTimeout(() => {
      gpsGraceTimerRef.current = null;
      if (distanceRef.current == null) setGpsWarning(true);
    }, 5000);
  };
```

por:

```js
  const armGpsGrace = () => {
    if (!gpsEnabled) return;
    clearGpsGrace();
    setGpsWarning(false);
    gpsGraceTimerRef.current = setTimeout(() => {
      gpsGraceTimerRef.current = null;
      if (latestDistanceRef.current == null) setGpsWarning(true);
    }, 5000);
  };
```

Quitar `handleGpsPoint` entero de `SeriesView` (ya no hace falta, vive en el padre):

```js
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
    if (leg > 0) {
      const nextDistance = (distanceRef.current ?? 0) + leg;
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
      await updateSetDistance(set.id, nextDistance);
    }
  };
```

Agregar un efecto nuevo que reporte la fase al padre en cada cambio (cubre también el valor inicial, al montar):

```js
  useEffect(() => {
    onPhaseChange(phase);
  }, [phase, onPhaseChange]);
```

En `beginSet`, reemplazar:

```js
      await onDataChanged();
      if (gpsEnabled) {
        gpsActiveRef.current = true;
        pointOrderRef.current = 0;
        armGpsGrace();
        await gps.start({ onPoint: handleGpsPoint });
      }
```

por:

```js
      await onDataChanged();
      if (gpsEnabled) armGpsGrace();
```

En `handlePlay` (rama `phase === 'paused'`), reemplazar:

```js
      try {
        stopwatch.resumeFrom(savedTimingsRef.current);
        setPhase('running');
        if (gpsActiveRef.current) {
          if (distanceRef.current == null) armGpsGrace();
          await gps.start({ onPoint: handleGpsPoint });
        }
      } finally {
        setBusy(false);
      }
```

por:

```js
      try {
        stopwatch.resumeFrom(savedTimingsRef.current);
        setPhase('running');
        if (gpsEnabled && distance == null) armGpsGrace();
      } finally {
        setBusy(false);
      }
```

En `handlePause`, reemplazar:

```js
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
      await gps.stop();
      clearGpsGrace();
```

por:

```js
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
      clearGpsGrace();
```

En `handleFinish`, reemplazar:

```js
      const snap = phase === 'running' ? stopwatch.pause() : savedTimingsRef.current;
      await gps.stop();
      clearGpsGrace();
      setGpsWarning(false);
      await finishSet(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: snap.wallMs,
        activeDurationMs: snap.activeMs,
        distanceMeters: distanceRef.current,
      });
      logDebug(`finishSet set=${set.id} persistido wall=${snap.wallMs} active=${snap.activeMs} dist=${distanceRef.current}`);
      setSummary({ wallMs: snap.wallMs, activeMs: snap.activeMs, distanceMeters: distanceRef.current });
```

por:

```js
      const snap = phase === 'running' ? stopwatch.pause() : savedTimingsRef.current;
      clearGpsGrace();
      setGpsWarning(false);
      await finishSet(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: snap.wallMs,
        activeDurationMs: snap.activeMs,
        distanceMeters: distance,
      });
      logDebug(`finishSet set=${set.id} persistido wall=${snap.wallMs} active=${snap.activeMs} dist=${distance}`);
      setSummary({ wallMs: snap.wallMs, activeMs: snap.activeMs, distanceMeters: distance });
```

En `handleExit`, reemplazar:

```js
    if (phase === 'running') {
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
      await gps.stop();
    }
```

por:

```js
    if (phase === 'running') {
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
    }
```

En `prepareCancel`, reemplazar:

```js
    if (phase === 'running') {
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await markSetInterrupted(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: snap.wallMs,
        activeDurationMs: snap.activeMs,
        distanceMeters: distanceRef.current,
      });
    } else if (phase === 'paused') {
      await markSetInterrupted(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: savedTimingsRef.current.wallMs,
        activeDurationMs: savedTimingsRef.current.activeMs,
        distanceMeters: distanceRef.current,
      });
    }
    await gps.stop();
    clearGpsGrace();
```

por:

```js
    if (phase === 'running') {
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await markSetInterrupted(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: snap.wallMs,
        activeDurationMs: snap.activeMs,
        distanceMeters: distance,
      });
    } else if (phase === 'paused') {
      await markSetInterrupted(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: savedTimingsRef.current.wallMs,
        activeDurationMs: savedTimingsRef.current.activeMs,
        distanceMeters: distance,
      });
    }
    clearGpsGrace();
```

En el efecto de montaje/desmontaje de `SeriesView`, reemplazar:

```js
  useEffect(() => {
    logDebug(`SeriesView montado set=${set.id} nombre="${set.exercise_name}" serie=${set.set_number + 1} status="${set.status}" wallMs=${set.duration_ms} activeMs=${set.active_duration_ms} dist=${set.distance_meters}`);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); clearGpsGrace(); gps.stop(); };
  }, []);
```

por:

```js
  useEffect(() => {
    logDebug(`SeriesView montado set=${set.id} nombre="${set.exercise_name}" serie=${set.set_number + 1} status="${set.status}" wallMs=${set.duration_ms} activeMs=${set.active_duration_ms} dist=${set.distance_meters}`);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); clearGpsGrace(); };
  }, []);
```

Por último, dentro del JSX de `SeriesView`, reemplazar todas las referencias de lectura a `distance` (el pill verde) -- ya son una prop con el mismo nombre, así que el JSX (`{distance != null && (...)}`, `{formatMeters(distance)}`) **no cambia de texto**, solo de origen (antes `useState` local, ahora prop). No hace falta tocar esas líneas.

- [ ] **Step 4: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos. Prestar atención a cualquier warning de `react-hooks/exhaustive-deps` nuevo en los efectos agregados -- los `eslint-disable-next-line` ya puestos en el plan cubren los casos esperados (mismo patrón que `use-live-session-runtime.js`).

- [ ] **Step 5: Commit**

```bash
git add components/session-runtime/training-session-active-screen.jsx
git commit -m "refactor(session-runtime): lift async GPS tracking from SeriesView to parent (continuous, mirrors presencial)"
```

---

### Task 7: `training-session-active-screen.jsx` — panel + layout 50/50 + pulido

**Files:**
- Modify: `components/session-runtime/training-session-active-screen.jsx` (mismo archivo que Task 6 -- task separado porque es un cambio de UI/wiring, no de la lógica de medición que acaba de migrar).

**Interfaces:**
- Consumes: `LiveSessionMapPanel` (Task 3), `tracePoints`/`distanceBySetId` (Task 6, ya en el componente), `useUser`/`getUserInitials` (igual que Task 5).

- [ ] **Step 1: Imports nuevos**

Agregar:

```js
import { useUser } from '../../hooks/use-user.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { LiveSessionMapPanel } from './live-session-map-panel.jsx';
```

- [ ] **Step 2: Estado de fullscreen + usuario propio**

Agregar, junto a los demás `useState` de `TrainingSessionActiveScreenContent`:

```js
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const { user } = useUser(userId);
```

- [ ] **Step 3: Mover `currentSet` arriba de los efectos de GPS (si el executor siguió el Step 2 de Task 6 literal, moverlo acá)**

Confirmar que la línea `const currentSet = mode === 'series' ? sets.find((s) => s.id === currentSetId) : null;` quede ANTES de los dos `useEffect` agregados en el Step 2 de Task 6 (que dependen de `currentSet?.id`). Si quedó después, moverla arriba, junto con `handleOpenSet`/`handleAdvance`/`handleCancelConfirmed` (son funciones, no dependen de orden) -- solo el orden relativo a los hooks importa en React.

- [ ] **Step 4: Reemplazar el `return` del componente**

Reemplazar desde `return (` (el que empieza con `<MobileOnlyRoute>` después del chequeo `if (!booted)`) hasta su cierre, por:

```jsx
  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="training-session-active-screen-root" testID="training-session-active-screen-root">
        {__DEV__ && <DebugLogPanel />}
        {bootError ? (
          <View className="flex-1 items-center justify-center px-6" nativeID="training-session-active-screen-error" testID="training-session-active-screen-error">
            <Text className="text-center text-base text-red-600 dark:text-red-400" nativeID="training-session-active-screen-error-label" testID="training-session-active-screen-error-label">
              No pudimos preparar la sesión local. {bootError.message}
            </Text>
            <Pressable className="mt-4 h-11 items-center justify-center rounded-full border border-slate-300 px-6 dark:border-slate-600" nativeID="training-session-active-screen-error-back" onPress={() => router.back()} testID="training-session-active-screen-error-back">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="training-session-active-screen-error-back-label" testID="training-session-active-screen-error-back-label">Volver</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="flex-1 px-4 pt-2" nativeID="training-session-active-screen-map-wrap" testID="training-session-active-screen-map-wrap">
              <LiveSessionMapPanel
                currentUserInitials={getUserInitials(user)}
                currentUserPhotoUrl={user?.photoUrl ?? null}
                finished={sessionCompleteVisible}
                fullscreen={fullscreenMap}
                onToggleFullscreen={() => setFullscreenMap((v) => !v)}
                tracePoints={tracePoints}
              />
            </View>
            {!fullscreenMap && (
              <View className="flex-1" nativeID="training-session-active-screen-content-wrap" testID="training-session-active-screen-content-wrap">
                {currentSet ? (
                  <SeriesView
                    distance={distanceBySetId.get(currentSet.id) ?? null}
                    gpsEnabled={storeGpsEnabled}
                    key={currentSet.id}
                    onAdvance={handleAdvance}
                    onBack={() => setMode('overview')}
                    onCancelConfirmed={handleCancelConfirmed}
                    onDataChanged={reloadSets}
                    onPhaseChange={(phase) => { activePhaseRef.current = phase; }}
                    runId={run.id}
                    set={currentSet}
                    totalSeriesForExercise={sets.filter((s) => s.exercise_instance_id === currentSet.exercise_instance_id).length}
                  />
                ) : (
                  <OverviewView onCancel={handleCancelConfirmed} onOpenSet={handleOpenSet} run={run} sets={sets} />
                )}
              </View>
            )}
          </>
        )}

        <SessionCompleteModal
          counts={{ finished: sets.filter((s) => s.status === 'finished').length, skipped: sets.filter((s) => s.status === 'skipped').length }}
          onClose={() => {
            clearLiveSession();
            router.back();
          }}
          onCompare={() => {
            clearLiveSession();
            router.replace({ pathname: '/training-comparison/session', params: { sessionInstanceId: run.session_instance_id, date: run.session_date } });
          }}
          runId={run.id}
          visible={sessionCompleteVisible}
        />
      </SafeAreaView>
    </MobileOnlyRoute>
  );
}
```

(`distanceBySetId`/`tracePoints`/`activePhaseRef` ya existen en el componente desde Task 6.)

- [ ] **Step 5: Pulido visual -- cronómetro de `SeriesView` más chico**

Reemplazar:

```jsx
          <Text className="text-6xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
```

por:

```jsx
          <Text className="text-4xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
```

- [ ] **Step 6: Pulido visual -- accesibilidad en controles sin label**

Mismos 3 agregados que el Step 5 de Task 5, en los componentes equivalentes de este archivo (`HoldToCancelButton`, `DragToFinishButton`) -- el texto exacto de `accessibilityLabel`/`accessibilityHint` es el mismo, salvo que este archivo no tiene `AttendanceQuickAccessButton` (eso es solo de la presencial).

En `HoldToCancelButton`:

```jsx
    <Pressable
      accessibilityHint="Mantené presionado para cancelar la sesión completa"
      accessibilityLabel="Cancelar sesión"
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 dark:border-red-900/60 dark:bg-red-950/40 ${disabled ? 'opacity-50' : ''}`}
```

En `DragToFinishButton` (el `View` con `gesture={pan}`):

```jsx
      <View
        accessibilityHint="Arrastrá hasta el final para confirmar"
        accessibilityLabel={label}
        className={`h-24 flex-1 rounded-full border ${colors.trackBg} ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
```

- [ ] **Step 7: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos.

- [ ] **Step 8: Commit**

```bash
git add components/session-runtime/training-session-active-screen.jsx
git commit -m "feat(session-runtime): wire live session map panel + polish into async live screen"
```

---

### Task 8: `session-pre-start-screen.jsx` — pulido visual (sin mapa)

**Files:**
- Modify: `components/session-runtime/session-pre-start-screen.jsx`

**Interfaces:** ninguna nueva -- cambios puramente visuales sobre el componente existente.

- [ ] **Step 1: Import de reanimated**

Agregar, junto a los demás imports:

```js
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
```

- [ ] **Step 2: Pulso en el botón Play**

Agregar, dentro de `SessionPreStartScreenContent`, junto a los demás `useState` (después de `const [hasLocalInProgressRun, setHasLocalInProgressRun] = useState(false);`):

```js
  // Mismo patrón que route-attempt-pre-start-screen.jsx -- invita a tocar
  // sin molestar mientras el botón está deshabilitado/cargando.
  const playReady = !starting && !runnerSessionLoading;
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = playReady
      ? withRepeat(withTiming(1.06, { duration: 650 }), -1, true)
      : withTiming(1, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playReady]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
```

Reemplazar el botón de Play (rama final del ternario del footer):

```jsx
        ) : isWeb ? null : (
          <Pressable
            className={`h-24 w-24 items-center justify-center self-center rounded-full bg-primary active:opacity-80 ${starting || runnerSessionLoading ? 'opacity-50' : ''}`}
            disabled={starting || runnerSessionLoading}
            nativeID="session-pre-start-screen-play-button"
            onPress={handlePlay}
            testID="session-pre-start-screen-play-button"
          >
            {runnerSessionLoading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />}
          </Pressable>
        )}
```

por:

```jsx
        ) : isWeb ? null : (
          <Animated.View className="self-center" nativeID="session-pre-start-screen-play-button-pulse" style={pulseStyle} testID="session-pre-start-screen-play-button-pulse">
            <Pressable
              accessibilityHint="Arranca el entrenamiento"
              accessibilityLabel="Iniciar entrenamiento"
              className={`h-24 w-24 items-center justify-center rounded-full bg-primary active:opacity-80 ${starting || runnerSessionLoading ? 'opacity-50' : ''}`}
              disabled={starting || runnerSessionLoading}
              nativeID="session-pre-start-screen-play-button"
              onPress={handlePlay}
              testID="session-pre-start-screen-play-button"
            >
              {runnerSessionLoading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />}
            </Pressable>
          </Animated.View>
        )}
```

- [ ] **Step 3: Ícono en el label de "Ejercicios de la sesión"**

Reemplazar:

```jsx
        <View className="mb-4" nativeID="session-pre-start-screen-exercise-container" testID="session-pre-start-screen-exercise-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-exercise-container-label" testID="session-pre-start-screen-exercise-container-label">
            Ejercicios de la sesión ({exercises.length})
          </Text>
```

por:

```jsx
        <View className="mb-4" nativeID="session-pre-start-screen-exercise-container" testID="session-pre-start-screen-exercise-container">
          <View className="mb-2 flex-row items-center gap-1.5" nativeID="session-pre-start-screen-exercise-container-header" testID="session-pre-start-screen-exercise-container-header">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dumbbell" size={14} />
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-exercise-container-label" testID="session-pre-start-screen-exercise-container-label">
              Ejercicios de la sesión ({exercises.length})
            </Text>
          </View>
```

- [ ] **Step 4: Accesibilidad en botones sin label**

Agregar a los 2 botones del header-row:

```jsx
          <Pressable
            accessibilityLabel="Volver"
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
            nativeID="session-pre-start-screen-back-button"
            onPress={() => router.back()}
            testID="session-pre-start-screen-back-button"
          >
```

```jsx
            <Pressable
              accessibilityLabel="Registrar asistencia"
              className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
              nativeID="session-pre-start-screen-attendance-button"
              onPress={handleOpenAttendance}
              testID="session-pre-start-screen-attendance-button"
            >
```

Agregar al botón de "Registro de Sesión":

```jsx
            <Pressable
              accessibilityHint="Abre la pantalla para ver o editar lo registrado"
              accessibilityLabel="Registro de Sesión"
              className="h-14 w-56 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80"
              nativeID={reviewButtonId}
              onPress={handleOpenReview}
              testID={reviewButtonId}
            >
```

- [ ] **Step 5: Verificar**

Run: `npm test && npm run lint`
Expected: sin fallos nuevos.

- [ ] **Step 6: Commit**

```bash
git add components/session-runtime/session-pre-start-screen.jsx
git commit -m "feat(session-runtime): visual polish for runner pre-start screen (pulse, icons, a11y)"
```

---

### Task 9: Regresión final + verificación manual

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa**

Run: `npm test && npm run lint`
Expected: 100% verde, 0 errores de lint (warnings preexistentes documentados sin cambios).

- [ ] **Step 2: Verificación manual en preview (lo que sea alcanzable)**

Las 3 pantallas (`session-pre-start-screen.jsx`, `training-session-active-screen.jsx`, `training-session-live-screen.jsx`) son `MobileOnlyRoute` -- sin alcance en el preview web, igual que el resto de este subsistema. No se puede verificar el mapa en vivo, el fullscreen, ni el recentrar en este entorno. Si el pulido del pre-start tocó algo verificable (el ícono nuevo del label, por ejemplo) se puede confirmar leyendo el componente renderizado si existe algún camino de preview, pero no se espera que lo haya dado el gate de `MobileOnlyRoute`.

- [ ] **Step 3: Reporte de límites conocidos**

Documentar explícitamente (en el mensaje final al usuario, no en un archivo nuevo) qué quedó sin verificar en este entorno: GPS real/continuo en movimiento, el panel de mapa funcionando en las 2 pantallas, fullscreen/recentrar, y el ícono de fin apareciendo al terminar la sesión -- los 4 necesitan dispositivo real, mismo límite ya aceptado en el resto de esta rama base.

- [ ] **Step 4: Commit final (si Step 1 requirió algún fix)**

Si `npm test`/`npm run lint` encontraron algo, arreglarlo y commitear aparte antes de considerar el plan completo. Si no, no hace falta ningún commit en este task.
