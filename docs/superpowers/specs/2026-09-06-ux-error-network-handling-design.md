# UX Error & Network Handling — Subproyecto C (diseño)

> Tercera y última tanda del batch de mejoras UX/calidad de vida.
> Subproyecto A (pull-to-refresh + skeleton loaders) shippeado como PR
> #107; Subproyecto B (guard de cambios sin guardar + haptics +
> auto-focus) shippeado como PR #108. Este documento cubre el
> Subproyecto C: `ErrorBoundary`, timeout/`AbortController` en
> `services/api.js`, y mapeo de mensajes de error de red/timeout/5xx.

## Alcance

Tres piezas independientes entre sí, agrupadas porque las tres tocan el
mismo problema de fondo — "¿qué ve el usuario cuando algo falla a nivel
de red o de render, no a nivel de negocio?":

1. **Timeout + `AbortController`** en `services/api.js` — hoy ningún
   request tiene límite de tiempo; un servidor colgado deja el spinner
   girando indefinidamente.
2. **Mapeo de mensajes de error de red/timeout/servidor** — hoy un
   error de red o un timeout propaga un `TypeError` crudo del navegador
   ("Failed to fetch"/"Network request failed") sin traducir, mostrado
   tal cual en el `Toast` de cada pantalla.
3. **`ErrorBoundary`** — hoy no existe ninguno en el repo; un error de
   render en cualquier componente tira abajo toda la app (pantalla en
   blanco o crash nativo), sin ninguna recuperación posible salvo forzar
   el cierre de la app a mano.

## Fuera de alcance (exclusión deliberada)

- **No se toca ningún call site existente** de `Toast.show({ text2:
  error.message })` (~15 pantallas, ver `team-detail-screen.jsx`,
  `tier-upgrade-screen.jsx`, `team-search-screen.jsx`, etc.) — al
  centralizar el mapeo en `services/api.js`, todos se benefician sin
  cambios propios.
- **No hay retry automático.** El timeout solo corta la espera cuando
  el servidor no responde; el usuario reintenta manualmente (mismo
  patrón ya establecido: cada pantalla ya maneja su propio estado de
  loading/error).
- **No hay crash-reporting externo** (Sentry, Bugsnag, etc.) — el
  `componentDidCatch` del `ErrorBoundary` solo loguea a consola. Agregar
  un servicio de terceros es una decisión de infraestructura aparte, no
  parte de este batch de UX.
- **No se re-mapean mensajes de error 4xx con `body.message` propio**
  (validaciones de negocio, ej. "Ya existe un usuario con ese email") —
  ya son legibles tal cual llegan del backend, no hace falta traducirlos.

## 1. Timeout + `AbortController` (`services/api.js`)

Constante fija, sin overrides por request: **30 segundos**. El valor
tiene que ser mayor al cold-start de Render (~20-25s en la primera
request tras inactividad, documentado en `CLAUDE.md`) para no disparar
un timeout espurio justo cuando el backend recién está arrancando.

```js
const REQUEST_TIMEOUT_MS = 30000;
```

`request()` hoy no envuelve el `await fetch(...)` en ningún `try/catch`
— un network drop propaga el `TypeError` del navegador/RN sin pasar por
ningún punto de traducción. Nuevo flujo:

```js
async function request(path, { _isRetry, skipAuthRefresh, ...fetchOptions } = {}) {
  const { token } = useAuthStore.getState();
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(buildUrl(path), { ...fetchOptions, headers, signal: controller.signal });
  } catch (err) {
    throw mapNetworkError(err);
  } finally {
    clearTimeout(timeoutId);
  }

  // ...el bloque de retry por 401 sigue igual, ahora recibe `response`
  // ya resuelto en vez de re-derivarlo del `await fetch` original...
}
```

El bloque de refresh-por-401 existente no cambia de lógica — sigue
llamando a `request()` recursivamente para el retry, que atraviesa el
mismo `try/catch` de arriba en su propia invocación (si el retry
también sufre timeout/network error, se mapea igual).

## 2. Mapeo de mensajes (`utils/network-errors.js`, nuevo)

Módulo de funciones puras, sin dependencia de React ni de `fetch` —
testeable en aislamiento.

```js
// utils/network-errors.js

export function mapNetworkError(err) {
  if (err?.name === 'AbortError') {
    return new Error('La conexión tardó demasiado. Probá de nuevo.');
  }
  return new Error('No pudimos conectarnos. Revisá tu conexión a internet.');
}

export function mapHttpErrorMessage(status, backendMessage) {
  if (backendMessage) return backendMessage;
  if (status >= 500) return 'Hubo un problema en el servidor. Probá de nuevo en unos minutos.';
  return `Request failed with status ${status}`;
}
```

Uso en `services/api.js`, reemplazando el bloque `if (!response.ok)`
actual:

```js
if (!response.ok) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // sin cuerpo JSON — se usa el mensaje por defecto
  }
  const error = new Error(mapHttpErrorMessage(response.status, body?.message));
  error.status = response.status;
  throw error;
}
```

Tabla de comportamiento resultante:

| Caso | Mensaje mostrado |
|---|---|
| Timeout (30s sin respuesta) | "La conexión tardó demasiado. Probá de nuevo." |
| Sin conexión / DNS falla / servidor inalcanzable | "No pudimos conectarnos. Revisá tu conexión a internet." |
| HTTP 5xx, backend sin `body.message` | "Hubo un problema en el servidor. Probá de nuevo en unos minutos." |
| HTTP 4xx con `body.message` (ej. validación) | El mensaje del backend, sin cambios |
| HTTP 4xx sin `body.message` | `Request failed with status <código>` (sin cambios respecto a hoy) |

`error.status` se sigue seteando en `services/api.js` (no dentro de
`mapHttpErrorMessage`, que solo calcula el string) — mismo
comportamiento que hoy para cualquier caller que inspeccione
`error.status` (ninguno lo hace hoy en `components/`, confirmado por
grep, pero el campo se mantiene por si el backend en el futuro requiere
distinguir códigos específicos).

## 3. `ErrorBoundary` (`components/shared/error-boundary.jsx`, nuevo)

Uno solo, montado en la raíz (`app/_layout.jsx`), envolviendo todo el
árbol de la app — incluyendo `AppProviders` (`QueryClientProvider`,
etc.) — para cubrir también un error de render que ocurra dentro de un
provider, no solo dentro de una pantalla:

```jsx
// app/_layout.jsx (fragmento relevante)
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  usePushNotifications();
  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProviders>
          <StackNavigator />
          <RoleSwitchOverlay />
          <Toast config={toastConfig} topOffset={56} />
        </AppProviders>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
```

Class component (única forma de capturar errores de render en React —
`getDerivedStateFromError`/`componentDidCatch` no tienen equivalente en
hooks):

```jsx
// components/shared/error-boundary.jsx
import { Component } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Updates from 'expo-updates';

async function reloadApp() {
  if (Platform.OS === 'web') {
    window.location.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // Expo Go / dev build sin runtime de updates activo — no hay más
    // acción posible, el usuario cierra y reabre la app a mano.
  }
}

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        nativeID="error-boundary-fallback"
        testID="error-boundary-fallback"
        className="flex-1 items-center justify-center bg-white dark:bg-surface px-8"
      >
        <Text
          nativeID="error-boundary-title"
          testID="error-boundary-title"
          className="text-lg font-semibold text-slate-900 dark:text-white text-center mb-2"
        >
          Algo salió mal
        </Text>
        <Text
          nativeID="error-boundary-description"
          testID="error-boundary-description"
          className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6"
        >
          Tuvimos un problema inesperado. Probá recargar la app.
        </Text>
        <Pressable
          nativeID="error-boundary-reload-button"
          testID="error-boundary-reload-button"
          onPress={reloadApp}
          className="bg-primary px-6 py-3 rounded-xl"
        >
          <Text
            nativeID="error-boundary-reload-button-text"
            testID="error-boundary-reload-button-text"
            className="text-white font-semibold"
          >
            Recargar
          </Text>
        </Pressable>
      </View>
    );
  }
}
```

Colores (`bg-primary`, `bg-surface`) ya existen en
`tailwind.config.js:theme.extend.colors` — sin tokens nuevos.

`reloadApp()` intenta `Updates.reloadAsync()` en nativo (ya es
dependencia, `expo-updates` en `package.json`); en Expo Go/dev build sin
runtime de updates activo, la llamada rechaza y el `catch` la absorbe en
silencio (no hay alternativa real dentro de esos entornos — es
aceptable, `ErrorBoundary` es un mecanismo de producción, no algo que se
dispare seguido en desarrollo).

## Testing

`utils/network-errors.js` es lógica pura → tests en `__tests__/`:
- `mapNetworkError` con `err.name === 'AbortError'` → mensaje de timeout.
- `mapNetworkError` con un error genérico (sin `name` o `name` distinto) → mensaje de conexión.
- `mapHttpErrorMessage(404, 'Ya existe un usuario con ese email')` → devuelve el mensaje del backend sin cambios.
- `mapHttpErrorMessage(500, undefined)` → mensaje genérico de servidor.
- `mapHttpErrorMessage(404, undefined)` → `'Request failed with status 404'` (sin cambios respecto al comportamiento actual).

`ErrorBoundary` es un componente visual → sin test de render (convención
del proyecto, ver `CLAUDE.md` sección Testing). Verificación manual en
preview: forzar un `throw` temporal en un componente hijo, confirmar que
aparece el fallback y que "Recargar" dispara `window.location.reload()`
en web.

El timeout de 30s en `services/api.js` no se testea con un temporizador
real de 30 segundos — se verifica con un test que usa fake timers de
Jest (`jest.useFakeTimers()`) para adelantar el reloj y confirmar que
`controller.abort()` se invoca, sin depender de tiempo real de
ejecución.

## Archivos nuevos

- `utils/network-errors.js`
- `components/shared/error-boundary.jsx`
- `__tests__/network-errors.test.js`

## Archivos modificados

- `services/api.js` (timeout + `AbortController` + uso de `mapNetworkError`/`mapHttpErrorMessage`)
- `app/_layout.jsx` (monta `ErrorBoundary` en la raíz)
- `package.json` / `package-lock.json` (bump de versión, sin dependencia nueva — `expo-updates` ya está instalado)
