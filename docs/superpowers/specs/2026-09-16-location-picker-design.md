# LocationPicker genérico — diseño

**Estado:** aprobado, pendiente de plan de implementación.

**Sub-proyecto 1 de 2** del bloque "calendario de asignaciones" — ver `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md`. El sub-proyecto 2 (calendario en sí, drag de planes, vista de entrenador por grupo) tiene su propia spec futura y consume el componente de este documento para el flag "presencial" de cada día. Nada de este documento depende del calendario — es standalone.

## 1. Contexto y motivación

El backend ya define el shape de ubicación (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.2, y `PlanDay.default_location` en `docs/BACKEND_TRAINING_PLANS_SPEC.md` §3.5): `{lat, lng, label?}`, sin geocoding de backend — "el frontend resuelve la posición inicial vía GPS del dispositivo y el pin final vía el picker de mapa (OpenFreeMap/MapLibre, resuelto 100% en el cliente)". Este documento diseña ese picker.

Hoy no existe ninguna librería de mapa en el proyecto (`expo-location` está instalado solo para el permiso de GPS del tracking de carrera, sin relación). Ubicación de equipo/usuario es hoy texto plano (país/provincia/ciudad) — reusar este componente ahí queda **fuera de alcance** (la propia spec de calendario ya lo aclara en su §7), no se tocan `Team`/`User` en este trabajo.

**Motivación de fondo para ir con mapa nativo** (no WebView): el proyecto va a necesitar, en algún momento futuro no planificado todavía, monitoreo en tiempo real de ubicación durante una sesión presencial + graficado del recorrido (mencionado como fuera de alcance en `BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §7, pero dado como "seguro que lo vamos a necesitar" por el usuario). Un módulo de mapa nativo da mejor piso para eso (renderizado fluido con updates frecuentes, rotación por rumbo, dibujo en segundo plano) que un mapa dentro de un WebView — aunque la funcionalidad de tracking en sí (GPS + polyline) técnicamente también sería posible sobre WebView. Se decide invertir el costo ahora (dev client) en vez de migrar más adelante.

## 2. Alcance

**Incluido:**
- Componente `LocationPicker` reusable, con implementación nativa (mapa real, MapLibre) y web (MapLibre GL JS) detrás de la misma interfaz.
- Modal de selección: mapa interactivo, pin, botón de "usar mi ubicación" (GPS), barra de búsqueda de dirección (forward-geocode), reverse-geocode automático al soltar el pin con campo de texto editable (label).
- Vista de mini-preview (mapa chico no interactivo + label) para mostrar una ubicación ya elegida, sin volver a abrir el modal.
- Setup de dev client (EAS + local) necesario para poder correr mapas nativos en dispositivo — Expo Go deja de servir para todo el proyecto desde este punto.
- Pantalla testbed aislada para verificar el picker antes de que exista un consumidor real (el calendario).

**Fuera de alcance (diferido, no se toca en esta spec):**
- Reuso del picker para ubicación de equipo/usuario (perfil, búsqueda de equipos) — requiere columnas nuevas en backend, explícitamente diferido también del lado del backend.
- Monitoreo en tiempo real / graficado de recorrido durante una sesión — feature aparte, mencionada arriba solo como motivación de la decisión nativa, no se implementa nada de esto acá.
- Consumo real desde el calendario de asignaciones — eso es el sub-proyecto 2, con su propia spec.
- Offline tile caching, clustering de puntos, mapas de iOS (el proyecto ya es Android-only para EAS, ver `CLAUDE.md` sección EAS).

## 3. Decisiones de arquitectura

### 3.1 Split nativo/web, no un componente único

`@maplibre/maplibre-react-native` (nativo) es un módulo nativo real — no corre en React Native Web. `maplibre-gl` (la librería JS/WebGL de MapLibre para navegador) es la contraparte web, misma tecnología de estilos vectoriales por debajo, pero paquete y API distintos. Se resuelve con el patrón ya establecido en el repo para este caso exacto (`components/payments/checkout-flow.jsx`/`.web.jsx`, ver Quirks de `CLAUDE.md` sobre el split `.web.jsx`/`.jsx` a nivel de componente — import sin extensión, obligatorio para que Metro resuelva bien): misma firma de props en ambas variantes, lógica de estado compartida en un hook.

### 3.2 Proveedor de tiles: OpenFreeMap

Gratis, sin API key, sin límite de requests, self-hosteable a futuro si hiciera falta. Se consume igual desde MapLibre nativo y desde `maplibre-gl` (mismo formato de estilo vectorial). Un único style URL, definido como constante de config (no hardcodeado en cada componente).

### 3.3 Geocoding: Nominatim (OpenStreetMap)

Gratis, sin API key. Dos usos:
- **Reverse** (`/reverse?lat=&lon=`) al soltar el pin, para autocompletar el campo de label.
- **Forward** (`/search?q=`) en la barra de búsqueda de dirección, para saltar el mapa a un lugar sin panear a mano.

Condición de uso de Nominatim: identificar la app y no superar ~1 request/segundo. Para este caso (consultas puntuales disparadas por una acción del usuario, no polling ni bulk) no hay conflicto. En nativo, header `User-Agent` explícito en el fetch (identifica la app, ej. `Paceron/<version>`); en web alcanza con el `Referer` que el navegador manda solo. Atribución "© OpenStreetMap contributors" visible en el mapa (mismo requisito que ya aplica por los tiles de OpenFreeMap, no es carga adicional).

### 3.4 GPS: `expo-location`, ya instalado

`watchPositionAsync`/`getCurrentPositionAsync` ya funcionan cross-platform (web incluido, vía geolocation del navegador) — no se agrega ninguna dependencia nueva para el botón "usar mi ubicación".

### 3.5 Dev client — costo aceptado a conciencia

El proyecto no tiene dev client custom hoy (se prueba todo con Expo Go). Sumar un módulo nativo (MapLibre RN) rompe Expo Go para **toda la app**, no solo para esta pantalla — es un cambio de flujo de trabajo del equipo entero, aceptado explícitamente por el costo real (bajo: setup único + rebuild solo cuando cambia la lista de dependencias nativas, no por cada cambio de código JS — el día a día sigue siendo Metro + hot reload, igual que con Expo Go).

## 4. Estructura de archivos

```
components/shared/location-picker.jsx       # nativo — @maplibre/maplibre-react-native
components/shared/location-picker.web.jsx   # web — maplibre-gl
hooks/use-location-picker.js                # estado compartido: pin, label, llamadas a Nominatim, validación — sin nada de rendering
services/geocoding.js                       # reverseGeocode(lat, lng), searchAddress(query) — wrappers fetch de Nominatim
config/maps.js                              # OPENFREEMAP_STYLE_URL, NOMINATIM_BASE_URL, USER_AGENT
components/shared/location-preview.jsx      # mini-preview no interactivo (nativo) — reusa location-picker.jsx en modo "display"
components/shared/location-preview.web.jsx  # mini-preview no interactivo (web)
components/dev/location-picker-testbed-screen.jsx
app/(tabs)/profile/location-picker-testbed.jsx   # ruta testbed, mismo patrón que payments-testbed.jsx
```

`location-preview.*` no es un componente de mapa nuevo — es el mismo `LocationPicker` renderizado con gestos deshabilitados y controles ocultos (prop `interactive={false}` o similar), para no mantener dos implementaciones de mapa.

## 5. Modelo de datos

```js
// Shape exacto que ya espera el backend (GroupCalendarDay.presencial_location, PlanDay.default_location)
{ lat: number, lng: number, label: string | null }
```

`LocationPicker` y `LocationPreview` reciben/emiten este shape tal cual — cero traducción en los call sites futuros del calendario.

## 6. Flujo UX

**Sin ubicación elegida todavía:** botón "Elegir ubicación" (`Pressable`, ícono de pin).

**Al tocar el botón**, se abre un `Modal` (mismo patrón de backdrop-cierra-al-tocar-afuera ya obligatorio en el proyecto, ver `CLAUDE.md` sección Modales) con:
1. Mapa a pantalla casi completa, centrado en GPS actual si hay permiso concedido, si no en un default (Buenos Aires, mismo criterio que otros defaults geográficos del proyecto en `data/locations.js`).
2. Barra de búsqueda arriba (`forward-geocode` vía Nominatim) — tipear una dirección y confirmar centra/zoomea el mapa ahí, sin mover el pin todavía.
3. Botón flotante "usar mi ubicación" (ícono GPS) — pide permiso si hace falta, centra el mapa en la posición actual.
4. Tap en cualquier punto del mapa suelta/mueve el pin.
5. Al soltar el pin, se dispara `reverseGeocode(lat, lng)` y el resultado autocompleta un `InputField` de label (editable) debajo del mapa — el entrenador puede aceptarlo o reemplazarlo por texto libre.
6. Botón "Confirmar" (deshabilitado hasta que haya un pin) cierra el modal y dispara `onChange({ lat, lng, label })`.

**Con ubicación ya elegida:** el mismo lugar donde estaba el botón pasa a mostrar `LocationPreview` (mapa chico no interactivo, ~120px de alto, + el texto del label al lado) con un botón "Cambiar" que reabre el modal con el pin/label actuales precargados.

## 7. Dev client — setup

**`eas.json`**, nuevo perfil (reusa `APP_VARIANT=development`, mismo que ya diferencia nombre/package id en `app.config.js`):

```json
"development": {
  "distribution": "internal",
  "developmentClient": true,
  "android": { "buildType": "apk" },
  "env": { "APP_VARIANT": "development" }
}
```

**Dependencia:** `npx expo install expo-dev-client`.

**Scripts nuevos en `package.json`** (mismo estilo que los `eas:*` ya existentes):

```json
"eas:build:development": "npx eas-cli build --platform android --profile development",
"eas:build:android:development:local": "mkdir -p builds && npx eas-cli build --platform android --profile development --local --output ./builds/paceron-development-v$npm_package_version.apk",
"android:run": "npx expo run:android"
```

- **Día a día (quien ya tiene Android Studio/SDK local, ver memoria de AVD Pixel_9):** `npm run android:run` — compila y corre local con Gradle, sin cola.
- **Generar el APK para repartir al equipo:** `npm run eas:build:development` (cloud, misma cola gratuita ya conocida) o `npm run eas:build:android:development:local` (mismo build pero corrido en tu máquina, sin cola, requiere toolchain alineado).
- **Reinstalación:** solo hace falta cuando cambia la lista de dependencias nativas (agregar/actualizar MapLibre u otro módulo nativo) — no por cambios de código JS. El loop diario sigue siendo `npx expo start --dev-client` + hot reload, igual que con Expo Go.
- Documentar en `docs/WORKFLOW.md` junto a la sección de EAS ya existente (parte del plan de implementación, no de esta spec).

## 8. Testbed

`components/dev/location-picker-testbed-screen.jsx`, ruteado en `app/(tabs)/profile/location-picker-testbed.jsx` — mismo patrón que `payments-testbed-screen.jsx`: pantalla mínima con el `LocationPicker` montado, el valor actual mostrado en crudo (JSON del `{lat,lng,label}`) para poder verificar el flujo completo (mapa, GPS, búsqueda, reverse-geocode, preview) en dispositivo real antes de que el calendario exista como consumidor.

## 9. Testing

Sin tests de render de componentes (convención del proyecto, ver `CLAUDE.md` sección Testing) — `location-picker.jsx`/`.web.jsx` y la pantalla testbed se verifican manualmente en dispositivo (obligatorio para esto — nativo, no hay preview web real para el mapa nativo). Si `services/geocoding.js` termina con lógica no trivial de parseo/normalización de la respuesta de Nominatim (más allá de un fetch + mapeo directo), eso sí lleva test unitario en `__tests__/`, mismo criterio que el resto de `services/`.

## 10. Fuera de alcance / diferido (resumen)

- Reuso en perfil de equipo/usuario — bloqueado por backend, no se agregan columnas de ubicación a `Team`/`User` acá.
- Tracking en tiempo real / recorrido — motivó la decisión de arquitectura, no se construye nada de eso en esta spec.
- Consumo real desde el calendario — sub-proyecto 2, spec propia.
- iOS — el proyecto no compila para iOS en EAS hoy (ver `CLAUDE.md`), no se considera esa plataforma acá.
