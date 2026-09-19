# LocationPicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `LocationPicker` component (native + web) backed by MapLibre/OpenFreeMap and Nominatim, plus the dev-client infrastructure needed to run a native map module on this project.

**Architecture:** Platform split at the component level (`.jsx`/`.web.jsx`, same pattern as `checkout-flow.jsx`), sharing state/logic through `hooks/use-location-picker.js`. Native uses `@maplibre/maplibre-react-native`; web uses `maplibre-gl`. Both consume the same OpenFreeMap style URL and the same `services/geocoding.js` (Nominatim). A dev-client build profile replaces Expo Go for this project going forward, since a real native module is involved.

**Tech Stack:** `@maplibre/maplibre-react-native@11.3.10`, `maplibre-gl@6.10.0`, `expo-dev-client`, `expo-location` (already installed), Nominatim (public API, no key).

**Spec:** `docs/superpowers/specs/2026-09-16-location-picker-design.md`

## Global Constraints

- Todo `View`/`Text`/`Pressable`/`TextInput`/`Modal`/`ScrollView` (y variantes `Animated.*`) lleva `nativeID` y `testID` únicos — enforced por `local/require-native-id` (ESLint), `npm run lint` debe estar en verde.
- Sin tests de render de componentes (convención del proyecto) — solo `services/geocoding.js` lleva test unitario (parseo no trivial de la respuesta de Nominatim).
- Shape de dato: `{ lat: number, lng: number, label: string | null }` — igual al `presencial_location`/`default_location` del backend, sin traducción en ningún punto.
- Import de `location-picker` sin extensión en cualquier call site futuro (Metro solo resuelve `.web.jsx` vs `.jsx` así — ver Quirks de `CLAUDE.md`).
- `npm test` y `npm run lint` en verde antes de cada commit de código.
- Rama ya creada: `feature/location-picker` (fork de `develop`).

---

## Task 1: Dependencias y dev client

**Files:**
- Modify: `package.json`
- Modify: `app.config.js`
- Modify: `eas.json`

**Interfaces:**
- Produces: paquetes `@maplibre/maplibre-react-native`, `maplibre-gl`, `expo-dev-client` instalados y resolubles; perfil `development` en `eas.json`; plugin `@maplibre/maplibre-react-native` registrado en `app.config.js`. Ningún archivo de código consume esto todavía — lo usan las Tasks 4 y 5.

- [ ] **Step 1: Instalar las dependencias**

```bash
npm install @maplibre/maplibre-react-native@11.3.10 maplibre-gl@6.10.0
npx expo install expo-dev-client
```

- [ ] **Step 2: Registrar el config plugin de MapLibre en `app.config.js`**

En el array `plugins` (después de `'expo-notifications'`, último elemento actual):

```js
    plugins: [
      ['expo-router', { sitemap: false }],
      ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Allow Paceron to use your location for tracking runs.' }],
      ['expo-image-picker', { photosPermission: 'Allow Paceron to access your photos to set a team profile picture.' }],
      'expo-font',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      'expo-notifications',
      '@maplibre/maplibre-react-native',
    ],
```

- [ ] **Step 3: Agregar el perfil `development` en `eas.json`**

En el objeto `build`, junto a `preview`/`production` ya existentes:

```json
    "development": {
      "distribution": "internal",
      "developmentClient": true,
      "android": {
        "buildType": "apk"
      },
      "env": {
        "APP_VARIANT": "development"
      }
    },
```

- [ ] **Step 4: Agregar scripts en `package.json`**

Junto a los `eas:*` ya existentes:

```json
    "eas:build:development": "npx eas-cli build --platform android --profile development",
    "eas:build:android:development:local": "mkdir -p builds && npx eas-cli build --platform android --profile development --local --output ./builds/paceron-development-v$npm_package_version.apk",
    "android:run": "npx expo run:android",
```

- [ ] **Step 5: Verificar que la config de Expo resuelve sin errores**

Run: `npx expo config --type public > /dev/null && echo OK`
Expected: `OK` (si el plugin tuviera un typo o el paquete no resolviera, este comando falla con el error del config plugin).

- [ ] **Step 6: Lint y test (no debería haber cambios de código todavía, solo config)**

Run: `npm run lint && npm test`
Expected: ambos en verde, igual que antes de este task (no se tocó ningún `.jsx`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.config.js eas.json
git commit -m "chore(maps): add MapLibre deps and development dev-client profile"
```

---

## Task 2: Config de mapas + servicio de geocoding

**Files:**
- Create: `config/maps.js`
- Create: `services/geocoding.js`
- Test: `__tests__/geocoding.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores (standalone).
- Produces: `OPENFREEMAP_STYLE_URL` (string), `NOMINATIM_BASE_URL` (string), `NOMINATIM_USER_AGENT` (string) desde `config/maps.js`. `reverseGeocode(lat: number, lng: number): Promise<string | null>` y `searchAddress(query: string): Promise<{lat: number, lng: number, label: string} | null>` desde `services/geocoding.js` — los consumen `hooks/use-location-picker.js` en la Task 3.

- [ ] **Step 1: Crear `config/maps.js`**

```js
export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
// Nominatim pide identificar la app (User-Agent en nativo, Referer alcanza
// en web) y no pasar de ~1 request/segundo — se cumple de sobra acá,
// son consultas puntuales disparadas por una acción del usuario, no bulk.
export const NOMINATIM_USER_AGENT = 'Paceron/1.0 (+https://paceron-frontend.vercel.app)';
```

- [ ] **Step 2: Escribir el test de `services/geocoding.js` (falla primero, el archivo no existe)**

```js
// __tests__/geocoding.test.js
import { isWeb } from '../utils/platform.js';
import { reverseGeocode, searchAddress } from '../services/geocoding.js';

jest.mock('../utils/platform.js', () => ({ isWeb: false }));

describe('geocoding service', () => {
  afterEach(() => { global.fetch = undefined; jest.clearAllMocks(); });

  test('reverseGeocode returns display_name on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: 'Av. Corrientes 1234, CABA' }),
    });

    await expect(reverseGeocode(-34.6037, -58.3816)).resolves.toBe('Av. Corrientes 1234, CABA');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reverse?format=jsonv2&lat=-34.6037&lon=-58.3816'),
      expect.objectContaining({ headers: { 'User-Agent': expect.stringContaining('Paceron') } }),
    );
  });

  test('reverseGeocode returns null when response has no display_name', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
  });

  test('reverseGeocode throws when Nominatim responds with an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(reverseGeocode(0, 0)).rejects.toThrow('Nominatim respondió 503');
  });

  test('searchAddress returns first result normalized to lat/lng/label', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ lat: '-34.6037', lon: '-58.3816', display_name: 'Buenos Aires, Argentina' }]),
    });

    await expect(searchAddress('Buenos Aires')).resolves.toEqual({
      lat: -34.6037,
      lng: -58.3816,
      label: 'Buenos Aires, Argentina',
    });
  });

  test('searchAddress returns null when there are no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ([]) });
    await expect(searchAddress('lugar inexistente')).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx jest geocoding.test.js`
Expected: FAIL — `Cannot find module '../services/geocoding.js'`.

- [ ] **Step 4: Implementar `services/geocoding.js`**

```js
import { NOMINATIM_BASE_URL, NOMINATIM_USER_AGENT } from '../config/maps.js';
import { isWeb } from '../utils/platform.js';

async function nominatimFetch(path) {
  const response = await fetch(`${NOMINATIM_BASE_URL}${path}`, {
    // En web, los navegadores bloquean sobreescribir el header User-Agent
    // (el Referer que mandan solo ya identifica el origen) — en nativo sí
    // se puede setear, así que se manda explícito.
    headers: isWeb ? undefined : { 'User-Agent': NOMINATIM_USER_AGENT },
  });
  if (!response.ok) throw new Error(`Nominatim respondió ${response.status}`);
  return response.json();
}

export async function reverseGeocode(lat, lng) {
  const data = await nominatimFetch(`/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
  return data?.display_name ?? null;
}

export async function searchAddress(query) {
  const data = await nominatimFetch(`/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
  const first = data?.[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name };
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx jest geocoding.test.js`
Expected: PASS, 5/5.

- [ ] **Step 6: Lint completo**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add config/maps.js services/geocoding.js __tests__/geocoding.test.js
git commit -m "feat(maps): add OpenFreeMap config and Nominatim geocoding service"
```

---

## Task 3: Hook compartido `use-location-picker`

**Files:**
- Create: `hooks/use-location-picker.js`

**Interfaces:**
- Consumes: `reverseGeocode`, `searchAddress` de `services/geocoding.js` (Task 2); `expo-location` (`requestForegroundPermissionsAsync`, `getCurrentPositionAsync`).
- Produces: `useLocationPicker({ value, onChange })` devuelve `{ visible, open, close, pin, selectPoint, label, setLabel, resolving, searchQuery, setSearchQuery, searching, runSearch, error, useMyLocation, confirm, defaultCenter }`. `pin` es `{ lat, lng } | null`. `defaultCenter` es `{ lat: -34.6037, lng: -58.3816 }`. Lo consumen `location-picker.jsx` y `location-picker.web.jsx` (Tasks 4 y 5) — sin nada de rendering acá, es puro estado/lógica.

Sin test dedicado — es un hook de estado de UI (mismo criterio ya aplicado a `hooks/use-session-form.js`, `hooks/use-form-dirty.js`: no llevan test propio, se verifican a través de los componentes que los usan, que en este caso se verifican manualmente en dispositivo por ser nativo).

- [ ] **Step 1: Implementar `hooks/use-location-picker.js`**

```js
import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { reverseGeocode, searchAddress } from '../services/geocoding.js';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

export function useLocationPicker({ value, onChange }) {
  const [visible, setVisible] = useState(false);
  const [pin, setPin] = useState(null);
  const [label, setLabel] = useState('');
  const [resolving, setResolving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const open = useCallback(() => {
    setPin(value ? { lat: value.lat, lng: value.lng } : null);
    setLabel(value?.label ?? '');
    setSearchQuery('');
    setError(null);
    setVisible(true);
  }, [value]);

  const close = useCallback(() => setVisible(false), []);

  const selectPoint = useCallback(async (lat, lng) => {
    setPin({ lat, lng });
    setError(null);
    setResolving(true);
    try {
      const address = await reverseGeocode(lat, lng);
      setLabel(address ?? '');
    } catch {
      setError('No pudimos resolver la dirección, podés escribirla a mano.');
    } finally {
      setResolving(false);
    }
  }, []);

  const useMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Necesitamos permiso de ubicación para esto.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    await selectPoint(position.coords.latitude, position.coords.longitude);
  }, [selectPoint]);

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await searchAddress(searchQuery.trim());
      if (!result) {
        setError('No encontramos esa dirección.');
        return;
      }
      await selectPoint(result.lat, result.lng);
    } catch {
      setError('No pudimos buscar esa dirección.');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectPoint]);

  const confirm = useCallback(() => {
    if (!pin) return;
    onChange({ lat: pin.lat, lng: pin.lng, label: label.trim() || null });
    setVisible(false);
  }, [pin, label, onChange]);

  return {
    visible, open, close,
    pin, selectPoint,
    label, setLabel,
    resolving,
    searchQuery, setSearchQuery, searching, runSearch,
    error,
    useMyLocation,
    confirm,
    defaultCenter: DEFAULT_CENTER,
  };
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores (archivo sin JSX, la regla `require-native-id` no aplica acá).

- [ ] **Step 3: Test suite completa (nada debería romperse)**

Run: `npm test`
Expected: mismo resultado que antes de este task.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-location-picker.js
git commit -m "feat(maps): add shared state hook for LocationPicker"
```

---

## Task 4: `LocationPicker` nativo

**Files:**
- Create: `components/shared/location-picker.jsx`

**Interfaces:**
- Consumes: `useLocationPicker` (Task 3); `Map`, `Camera`, `Marker` de `@maplibre/maplibre-react-native`; `OPENFREEMAP_STYLE_URL` de `config/maps.js`; `useThemeColors` de `theme/colors.js`.
- Produces: `LocationPicker({ value, onChange })` — export nombrado. `value` es `{ lat, lng, label } | null|undefined`. `onChange(next: { lat, lng, label })` se llama al confirmar. Firma que `location-picker.web.jsx` (Task 5) debe replicar exacto.

- [ ] **Step 1: Implementar `components/shared/location-picker.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useLocationPicker } from '../../hooks/use-location-picker.js';

export function LocationPicker({ value, onChange }) {
  const colors = useThemeColors();
  const cameraRef = useRef(null);
  const picker = useLocationPicker({ value, onChange });

  useEffect(() => {
    if (!picker.visible || !picker.pin || !cameraRef.current) return;
    cameraRef.current.flyTo({ center: [picker.pin.lng, picker.pin.lat] });
  }, [picker.visible, picker.pin]);

  const handleMapPress = (event) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    picker.selectPoint(lat, lng);
  };

  const initialCenter = value
    ? [value.lng, value.lat]
    : [picker.defaultCenter.lng, picker.defaultCenter.lat];

  return (
    <>
      {value ? (
        <Pressable
          className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
          nativeID="location-picker-preview"
          onPress={picker.open}
          testID="location-picker-preview"
        >
          <View
            className="h-16 w-16 overflow-hidden rounded-lg"
            nativeID="location-picker-preview-map"
            pointerEvents="none"
            testID="location-picker-preview-map"
          >
            <Map
              attribution={false}
              compass={false}
              dragPan={false}
              doubleTapHoldZoom={false}
              doubleTapZoom={false}
              logo={false}
              mapStyle={OPENFREEMAP_STYLE_URL}
              nativeID="location-picker-preview-map-instance"
              scaleBar={false}
              style={{ flex: 1 }}
              testID="location-picker-preview-map-instance"
              touchPitch={false}
              touchRotate={false}
              touchZoom={false}
            >
              <Camera initialViewState={{ center: [value.lng, value.lat], zoom: 14 }} />
              <Marker anchor="bottom" lngLat={[value.lng, value.lat]}>
                <MaterialCommunityIcons color="#8cc63e" name="map-marker" size={22} />
              </Marker>
            </Map>
          </View>
          <View className="flex-1" nativeID="location-picker-preview-info" testID="location-picker-preview-info">
            <Text
              className="text-sm text-slate-900 dark:text-white"
              nativeID="location-picker-preview-label"
              numberOfLines={2}
              testID="location-picker-preview-label"
            >
              {value.label || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
            </Text>
            <Text className="text-xs font-semibold text-primary" nativeID="location-picker-preview-change" testID="location-picker-preview-change">
              Cambiar
            </Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          className="h-12 flex-row items-center justify-center gap-2 rounded-full border border-slate-300 dark:border-slate-600"
          nativeID="location-picker-open-button"
          onPress={picker.open}
          testID="location-picker-open-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={18} />
          <Text
            className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            nativeID="location-picker-open-button-label"
            testID="location-picker-open-button-label"
          >
            Elegir ubicación
          </Text>
        </Pressable>
      )}

      <Modal
        animationType="slide"
        nativeID="location-picker-modal"
        onRequestClose={picker.close}
        testID="location-picker-modal"
        visible={picker.visible}
      >
        <View className="flex-1 bg-white dark:bg-ink" nativeID="location-picker-modal-content" testID="location-picker-modal-content">
          <View
            className="flex-row items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-700"
            nativeID="location-picker-modal-header"
            testID="location-picker-modal-header"
          >
            <Pressable nativeID="location-picker-modal-close-button" onPress={picker.close} testID="location-picker-modal-close-button">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
            </Pressable>
            <TextInput
              className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              nativeID="location-picker-search-input"
              onChangeText={picker.setSearchQuery}
              onSubmitEditing={picker.runSearch}
              placeholder="Buscar dirección"
              placeholderTextColor={colors.onSurfaceVariant}
              returnKeyType="search"
              testID="location-picker-search-input"
              value={picker.searchQuery}
            />
            <Pressable disabled={picker.searching} nativeID="location-picker-search-button" onPress={picker.runSearch} testID="location-picker-search-button">
              {picker.searching
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={22} />}
            </Pressable>
          </View>

          <View className="flex-1" nativeID="location-picker-map-wrapper" testID="location-picker-map-wrapper">
            <Map
              mapStyle={OPENFREEMAP_STYLE_URL}
              nativeID="location-picker-map"
              onPress={handleMapPress}
              style={{ flex: 1 }}
              testID="location-picker-map"
            >
              <Camera initialViewState={{ center: initialCenter, zoom: picker.pin ? 15 : 12 }} ref={cameraRef} />
              {picker.pin && (
                <Marker anchor="bottom" lngLat={[picker.pin.lng, picker.pin.lat]}>
                  <MaterialCommunityIcons color="#ef4444" name="map-marker" size={32} />
                </Marker>
              )}
            </Map>

            <Pressable
              className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
              nativeID="location-picker-my-location-button"
              onPress={picker.useMyLocation}
              testID="location-picker-my-location-button"
            >
              <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />
            </Pressable>
          </View>

          <View className="gap-2 border-t border-slate-200 p-3 dark:border-slate-700" nativeID="location-picker-footer" testID="location-picker-footer">
            {picker.error && (
              <Text className="text-xs text-red-500 dark:text-red-400" nativeID="location-picker-error" testID="location-picker-error">
                {picker.error}
              </Text>
            )}
            <TextInput
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              editable={!picker.resolving}
              nativeID="location-picker-label-input"
              onChangeText={picker.setLabel}
              placeholder={picker.resolving ? 'Resolviendo dirección...' : 'Descripción del lugar (opcional)'}
              placeholderTextColor={colors.onSurfaceVariant}
              testID="location-picker-label-input"
              value={picker.label}
            />
            <Pressable
              className={`h-12 items-center justify-center rounded-full bg-primary ${!picker.pin ? 'opacity-40' : ''}`}
              disabled={!picker.pin}
              nativeID="location-picker-confirm-button"
              onPress={picker.confirm}
              testID="location-picker-confirm-button"
            >
              <Text
                className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
                nativeID="location-picker-confirm-button-label"
                testID="location-picker-confirm-button-label"
              >
                Confirmar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
```

Nota: este `Modal` es a pantalla completa (`animationType="slide"`, sin backdrop) — mismo patrón ya usado en `components/payments/checkout-flow.jsx` (nativo). La regla de lint `local/require-modal-backdrop-close` solo revisa elementos con `nativeID` terminado en `-backdrop`; al no declarar ninguno acá (no es un diálogo centrado, es pantalla completa), no aplica.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores — confirma que todo elemento tiene `nativeID`/`testID` y que no hay ningún `-backdrop` sin `onPress`.

- [ ] **Step 3: Test suite completa**

Run: `npm test`
Expected: sin cambios respecto al estado previo (este componente no tiene test de render, por convención del proyecto).

- [ ] **Step 4: Commit**

```bash
git add components/shared/location-picker.jsx
git commit -m "feat(maps): add native LocationPicker with MapLibre"
```

---

## Task 5: `LocationPicker` web

**Files:**
- Create: `components/shared/location-picker.web.jsx`

**Interfaces:**
- Consumes: `useLocationPicker` (Task 3); `maplibre-gl` (`Map`, `Marker`); `OPENFREEMAP_STYLE_URL` de `config/maps.js`; `useThemeColors`.
- Produces: mismo `LocationPicker({ value, onChange })` que la Task 4 — firma idéntica, ningún call site futuro distingue plataforma.

- [ ] **Step 1: Implementar `components/shared/location-picker.web.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useLocationPicker } from '../../hooks/use-location-picker.js';

function MiniMap({ lat, lng }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: [lng, lat],
      zoom: 14,
      interactive: false,
      attributionControl: false,
    });
    new maplibregl.Marker({ color: '#8cc63e' }).setLngLat([lng, lat]).addTo(map);
    return () => map.remove();
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

export function LocationPicker({ value, onChange }) {
  const colors = useThemeColors();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const picker = useLocationPicker({ value, onChange });

  useEffect(() => {
    if (!picker.visible || mapRef.current) return;
    const initialCenter = value ? [value.lng, value.lat] : [picker.defaultCenter.lng, picker.defaultCenter.lat];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: initialCenter,
      zoom: value ? 15 : 12,
    });
    map.on('click', (e) => picker.selectPoint(e.lngLat.lat, e.lngLat.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.visible]);

  useEffect(() => {
    if (!mapRef.current || !picker.pin) return;
    const map = mapRef.current;
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#ef4444' }).setLngLat([picker.pin.lng, picker.pin.lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([picker.pin.lng, picker.pin.lat]);
    }
    map.flyTo({ center: [picker.pin.lng, picker.pin.lat] });
  }, [picker.pin]);

  return (
    <>
      {value ? (
        <Pressable
          className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          nativeID="location-picker-preview"
          onPress={picker.open}
          testID="location-picker-preview"
        >
          <View className="h-16 w-16 overflow-hidden rounded-lg" nativeID="location-picker-preview-map" testID="location-picker-preview-map">
            <MiniMap lat={value.lat} lng={value.lng} />
          </View>
          <View className="flex-1" nativeID="location-picker-preview-info" testID="location-picker-preview-info">
            <Text
              className="text-sm text-slate-900 dark:text-white"
              nativeID="location-picker-preview-label"
              numberOfLines={2}
              testID="location-picker-preview-label"
            >
              {value.label || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
            </Text>
            <Text className="text-xs font-semibold text-primary" nativeID="location-picker-preview-change" testID="location-picker-preview-change">
              Cambiar
            </Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          className="h-12 flex-row items-center justify-center gap-2 rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          nativeID="location-picker-open-button"
          onPress={picker.open}
          testID="location-picker-open-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={18} />
          <Text
            className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            nativeID="location-picker-open-button-label"
            testID="location-picker-open-button-label"
          >
            Elegir ubicación
          </Text>
        </Pressable>
      )}

      <Modal animationType="fade" nativeID="location-picker-modal" onRequestClose={picker.close} testID="location-picker-modal" transparent visible={picker.visible}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="location-picker-modal-backdrop"
          onPress={picker.close}
          testID="location-picker-modal-backdrop"
        >
          <Pressable
            className="w-full max-w-2xl gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="location-picker-modal-card"
            onPress={() => {}}
            testID="location-picker-modal-card"
          >
            <View className="flex-row items-center gap-2" nativeID="location-picker-modal-header" testID="location-picker-modal-header">
              <TextInput
                className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                nativeID="location-picker-search-input"
                onChangeText={picker.setSearchQuery}
                onSubmitEditing={picker.runSearch}
                placeholder="Buscar dirección"
                placeholderTextColor={colors.onSurfaceVariant}
                returnKeyType="search"
                testID="location-picker-search-input"
                value={picker.searchQuery}
              />
              <Pressable disabled={picker.searching} nativeID="location-picker-search-button" onPress={picker.runSearch} testID="location-picker-search-button">
                {picker.searching
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={22} />}
              </Pressable>
              <Pressable nativeID="location-picker-modal-close-button" onPress={picker.close} testID="location-picker-modal-close-button">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>

            <View className="h-[420px] overflow-hidden rounded-xl" nativeID="location-picker-map-wrapper" testID="location-picker-map-wrapper">
              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
              <Pressable
                className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
                nativeID="location-picker-my-location-button"
                onPress={picker.useMyLocation}
                testID="location-picker-my-location-button"
              >
                <MaterialCommunityIcons color={colors.primary} name="crosshairs-gps" size={22} />
              </Pressable>
            </View>

            {picker.error && (
              <Text className="text-xs text-red-500 dark:text-red-400" nativeID="location-picker-error" testID="location-picker-error">
                {picker.error}
              </Text>
            )}
            <TextInput
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              editable={!picker.resolving}
              nativeID="location-picker-label-input"
              onChangeText={picker.setLabel}
              placeholder={picker.resolving ? 'Resolviendo dirección...' : 'Descripción del lugar (opcional)'}
              placeholderTextColor={colors.onSurfaceVariant}
              testID="location-picker-label-input"
              value={picker.label}
            />
            <Pressable
              className={`h-12 items-center justify-center rounded-full bg-primary hover:opacity-90 ${!picker.pin ? 'opacity-40' : ''}`}
              disabled={!picker.pin}
              nativeID="location-picker-confirm-button"
              onPress={picker.confirm}
              testID="location-picker-confirm-button"
            >
              <Text
                className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
                nativeID="location-picker-confirm-button-label"
                testID="location-picker-confirm-button-label"
              >
                Confirmar
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
```

Acá sí hay backdrop (`location-picker-modal-backdrop`, `onPress={picker.close}`) — modal centrado, no pantalla completa, mismo patrón que `create-session-modal.jsx`/`checkout-flow.web.jsx`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Test suite completa**

Run: `npm test`
Expected: sin cambios.

- [ ] **Step 4: Commit**

```bash
git add components/shared/location-picker.web.jsx
git commit -m "feat(maps): add web LocationPicker with maplibre-gl"
```

---

## Task 6: Pantalla testbed

**Files:**
- Create: `components/dev/location-picker-testbed-screen.jsx`
- Create: `app/(tabs)/profile/location-picker-testbed.jsx`

**Interfaces:**
- Consumes: `LocationPicker` (Tasks 4/5, importado sin extensión); `RequireAuth` de `components/guards/require-auth.jsx`.
- Produces: ruta `/profile/location-picker-testbed`, sin entrada en ningún menú (mismo criterio que `payments-testbed-screen.jsx` — alcanzable solo tipeando la URL/ruta).

- [ ] **Step 1: Implementar `components/dev/location-picker-testbed-screen.jsx`**

```jsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { RequireAuth } from '../guards/require-auth.jsx';
// Sin extensión a propósito: Metro resuelve .web.jsx vs .jsx por esto.
import { LocationPicker } from '../shared/location-picker';

// Pantalla interna sin entrada en ningún menú — solo alcanzable
// tipeando /profile/location-picker-testbed. Prueba LocationPicker en
// dispositivo real antes de que exista un consumidor real (el calendario
// de asignaciones). Ver docs/superpowers/specs/2026-09-16-location-picker-design.md.
function LocationPickerTestbedScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const [value, setValue] = useState(null);

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="location-picker-testbed-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="location-picker-testbed-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="location-picker-testbed-screen-container" testID="location-picker-testbed-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="location-picker-testbed-screen-header" testID="location-picker-testbed-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="location-picker-testbed-screen-back-button"
            onPress={() => router.back()}
            testID="location-picker-testbed-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text
            className="text-xl text-slate-900 dark:text-white"
            nativeID="location-picker-testbed-screen-title"
            style={{ fontFamily: 'Orbitron_700Bold' }}
            testID="location-picker-testbed-screen-title"
          >
            Testbed de LocationPicker
          </Text>
        </View>

        <LocationPicker onChange={setValue} value={value} />

        <Text
          className="mt-4 text-xs text-slate-600 dark:text-slate-300"
          nativeID="location-picker-testbed-value"
          testID="location-picker-testbed-value"
        >
          {JSON.stringify(value, null, 2)}
        </Text>
      </View>
    </ScrollView>
  );
}

export function LocationPickerTestbedScreen() {
  return (
    <RequireAuth>
      <LocationPickerTestbedScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 2: Implementar la ruta `app/(tabs)/profile/location-picker-testbed.jsx`**

```jsx
import { LocationPickerTestbedScreen } from '../../../components/dev/location-picker-testbed-screen.jsx';

export default function ProfileLocationPickerTestbed() {
  return <LocationPickerTestbedScreen />;
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 4: Test suite completa**

Run: `npm test`
Expected: sin cambios.

- [ ] **Step 5: Commit**

```bash
git add components/dev/location-picker-testbed-screen.jsx "app/(tabs)/profile/location-picker-testbed.jsx"
git commit -m "feat(maps): add LocationPicker testbed screen"
```

---

## Task 7: Dev client — generar, documentar y verificación final

**Files:**
- Modify: `docs/WORKFLOW.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: todo lo anterior (Tasks 1-6). No produce interfaces nuevas — es documentación + verificación de cierre.

- [ ] **Step 1: Generar el dev client (local, para poder probar de una)**

Run: `npm run android:run`
Expected: compila el proyecto nativo con Gradle e instala/abre la app en el emulador o dispositivo Android conectado. La primera vez tarda varios minutos (compila todo el árbol nativo); confirma que MapLibre linkeó bien si la app abre sin crashear.

Si no hay device/emulador a mano en este momento, alternativa cloud: `npm run eas:build:development` (cola gratuita, puede tardar).

- [ ] **Step 2: Verificar manualmente en el dispositivo/emulador**

Navegar a `/profile/location-picker-testbed` (con sesión iniciada) y confirmar, en orden:
1. Aparece el botón "Elegir ubicación".
2. Al tocarlo, se abre el mapa (tiles de OpenFreeMap visibles, no en blanco).
3. Tocar un punto del mapa suelta un pin rojo y el campo de texto de abajo se autocompleta con una dirección (o al menos no queda en blanco/error si hay red).
4. El botón de GPS (ícono de mira) pide permiso la primera vez y centra el mapa en la ubicación real.
5. Buscar una dirección en la barra de arriba mueve el mapa y el pin ahí.
6. "Confirmar" cierra el modal y el bloque de texto de abajo (`JSON.stringify(value)`) muestra `{lat, lng, label}` con valores reales.
7. Volver a tocar el botón (ahora con mini-mapa + "Cambiar") reabre el modal con el pin/label ya cargados.

Si algo de esto falla, no seguir a los próximos pasos — diagnosticar antes (ver systematic-debugging).

- [ ] **Step 3: Documentar el dev client en `docs/WORKFLOW.md`**

Agregar una sección nueva, junto a donde ya se documenta EAS (buscar la sección existente de EAS/deploy en ese archivo e insertar después):

```markdown
## Dev client (mapas nativos)

Desde que el proyecto usa `@maplibre/maplibre-react-native` (módulo nativo real, no soportado por Expo Go), correr la app en dispositivo/emulador requiere el dev client custom en vez de Expo Go — Expo Go no puede cargar módulos nativos fuera de su set soportado.

- **Día a día** (con Android Studio/SDK local): `npm run android:run` — compila con Gradle local e instala directo, sin cola. Después de la primera instalación, el loop normal (`npx expo start --dev-client`, hot reload) es igual que con Expo Go.
- **Generar el APK para el resto del equipo**: `npm run eas:build:development` (cloud, misma cola gratuita que ya se usa para `preview`/`production`) o `npm run eas:build:android:development:local` (mismo build corrido en tu máquina, sin cola, requiere tener el toolchain de Android alineado con el de EAS).
- **Cuándo reinstalar**: solo cuando cambia la lista de dependencias nativas (agregar/actualizar un módulo nativo) — no por cambios de código JS.
```

- [ ] **Step 4: Actualizar `CLAUDE.md` con una nota corta**

En la sección "Quirks conocidos", agregar:

```markdown
- **Desde `feature/location-picker` (2026-09-16), el proyecto tiene un módulo nativo real (`@maplibre/maplibre-react-native`) — Expo Go ya no sirve para correr la app.** Usar el dev client custom (`npm run android:run` para generarlo/correrlo local, ver `docs/WORKFLOW.md` sección "Dev client"). Cualquier nueva dependencia nativa futura requiere regenerar ese dev client (no por cambios de JS).
```

- [ ] **Step 5: Lint y test final de toda la rama**

Run: `npm run lint && npm test`
Expected: ambos en verde.

- [ ] **Step 6: Commit**

```bash
git add docs/WORKFLOW.md CLAUDE.md
git commit -m "docs(maps): document dev-client workflow for native map module"
```

---

## Self-Review

**1. Cobertura del spec:** split nativo/web (Tasks 4/5) — cubierto. OpenFreeMap + Nominatim (Task 2) — cubierto. Dev client setup (Task 1 + Task 7) — cubierto. Flujo UX completo (pin, GPS, búsqueda, reverse-geocode editable, mini-preview, "Cambiar") — cubierto en Tasks 4/5. Testbed (Task 6) — cubierto. Fuera de alcance del spec (reuso en Team/User, tracking en vivo, consumo real del calendario) — correctamente no tiene task acá.

**2. Placeholders:** ninguno — todo el código de cada step es completo y ejecutable, sin "TODO"/"implementar después".

**3. Consistencia de tipos:** `{lat, lng, label}` usado igual en `services/geocoding.js` (searchAddress), `hooks/use-location-picker.js` (selectPoint, confirm), `location-picker.jsx`/`.web.jsx` (value/onChange) y el testbed — mismos nombres de campo en todos lados. `useLocationPicker({value, onChange})` con el mismo shape de retorno consumido idéntico en ambas variantes de plataforma.

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-16-location-picker.md`. Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — despacho un subagente fresco por task, reviso entre tasks.
2. **Ejecución inline** — ejecuto las tasks en esta sesión, con checkpoints.

¿Cuál preferís?
