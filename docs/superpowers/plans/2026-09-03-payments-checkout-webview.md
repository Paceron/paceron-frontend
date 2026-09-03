# Checkout nativo vía WebView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el placeholder nativo "Próximamente en la app" de `CheckoutFlow` por un modal real con `WebView` que carga la misma página de checkout que ya renderiza el Payment Brick en web — con inyección de sesión mínima + tema, y hardening de seguridad estándar.

**Architecture:** Dos piezas. (1) Una página web real y pública, `app/checkout.jsx`, pensada para cargarse standalone dentro de un `WebView` — nunca se linkea desde la navegación normal de la app. Se comunica hacia afuera vía `window.ReactNativeWebView.postMessage`. (2) La rama nativa de `CheckoutFlow` (`components/payments/checkout-flow.jsx`) pasa de placeholder a un `Modal` con `WebView` apuntando a esa página, inyectando sesión+tema antes de cargar contenido y escuchando los mensajes que la página emite.

**Tech Stack:** Expo/React Native + React Native Web, `react-native-webview` (dependencia nueva, solo rama nativa), Jest.

**Spec:** `docs/superpowers/specs/2026-09-03-payments-checkout-webview-design.md`

## Global Constraints

- `EXPO_PUBLIC_WEB_ORIGIN` (nueva env var, `config/env.js`) — origen de la web deployada que el `WebView` carga. Default `https://paceron-frontend.vercel.app`.
- La sesión inyectada en el `localStorage` del `WebView` es un **subconjunto mínimo** — `{ user, token, expiresAt, activeRole }` — **nunca** `refreshToken`. Clave `paceron.auth`, mismo nombre que usa `store/auth-store.js` en web.
- El tema se inyecta bajo la clave `paceron-theme-mode` (mismo nombre que lee `providers/theme-provider.jsx`), leído del lado nativo con `useThemeMode()` al montar.
- `CheckoutFlow` nativo gana un prop `onCancel` (opcional) — dispara solo si el modal se cierra sin haber recibido `approved`/`error` por `postMessage`. No existe en la variante web (asimetría real y aceptada).
- `onApproved` recibe el **mismo shape** que la variante web le pasa a su propio `onApproved` (el `payment` normalizado completo, no un stub reducido) — viaja serializado entero por `postMessage`.
- Seguridad del `WebView`: `originWhitelist={[WEB_ORIGIN]}` + `onShouldStartLoadWithRequest` (deniega cualquier navegación fuera de ese origen) + `javaScriptCanOpenWindowsAutomatically={false}` + `setSupportMultipleWindows={false}` + `allowFileAccess={false}` + `mixedContentMode="never"` + `incognito`.
- Si no hay `token` en el store al momento de abrir el modal, el `WebView` **ni se monta** — se llama `onError` de inmediato.
- Sin store Zustand ni TanStack Query nuevos — estado local al componente, mismo criterio que el resto del módulo de pagos.
- Todo componente visual (`View`/`Text`/`Pressable`/`Modal`/etc., incluidas variantes `Animated.*`) lleva `nativeID` y `testID` únicos — regla `local/require-native-id`, sin excepción salvo spread de props. `WebView` y `ActivityIndicator` **no** están en la lista que exige la regla — no necesitan estos ids.
- Sin tests de render de componentes — convención del proyecto.
- `react-native-webview` no necesita config plugin de Expo (autolinked) — sin cambios en `app.config.js`.
- `npm test` y `npm run lint` en verde antes de cerrar cada tarea.

---

### Task 1: Página web del checkout (`app/checkout.jsx` + `WEB_ORIGIN`)

**Files:**
- Modify: `config/env.js`
- Modify: `.env.example`
- Create: `components/payments/checkout-web-page.jsx`
- Create: `app/checkout.jsx`

**Interfaces:**
- Produces: `WEB_ORIGIN` (string) desde `config/env.js`. Ruta pública `/checkout?preferenceId=&publicKey=&amount=&marketplace=` que Task 2 carga desde el `WebView`. Contrato de `postMessage` emitido: `{status: 'approved', payment: <objeto normalizado>}` o `{status: 'error', message: string}`.
- Consumes: `CheckoutFlow` de `./checkout-flow.jsx` (Task 1 se ejecuta con la variante web ya existente desde Fase 0 — Metro resuelve `.web.jsx` para el bundle web sin importar el estado de la variante nativa).

- [ ] **Step 1: Agregar `WEB_ORIGIN` a `config/env.js`**

```js
// config/env.js
const REMOTE_URL = 'https://paceron-backend-as9c.onrender.com/api/v1';
const REMOTE_WEB_ORIGIN = 'https://paceron-frontend.vercel.app';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || REMOTE_URL;
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
// Origen de la web deployada — el checkout nativo (WebView, ver
// components/payments/checkout-flow.jsx) carga /checkout desde acá.
export const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN || REMOTE_WEB_ORIGIN;
```

- [ ] **Step 2: Documentar la env var en `.env.example`**

Agregar al final del archivo:

```
# Origen de la web deployada (Vercel) — usado por el checkout nativo
# (WebView) para saber qué URL cargar. Sin esta var, cae a producción real.
# Para apuntar a un dev server local (dispositivo físico en la misma red
# WiFi que la máquina que corre `npm run web`):
# EXPO_PUBLIC_WEB_ORIGIN=http://192.168.1.23:8082
```

- [ ] **Step 3: Crear `components/payments/checkout-web-page.jsx`**

```jsx
// components/payments/checkout-web-page.jsx
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { CheckoutFlow } from './checkout-flow.jsx';

// Página real de la web (deployada en Vercel), pensada para cargarse
// standalone dentro de un WebView nativo (ver checkout-flow.jsx, rama
// nativa de CheckoutFlow) — no se linkea desde ningún lado de la
// navegación nativa ni de la web normal. Ver
// docs/superpowers/specs/2026-09-03-payments-checkout-webview-design.md.
//
// La sesión y el tema llegan inyectados en localStorage ANTES de que
// este componente monte (injectedJavaScriptBeforeContentLoaded, del
// lado nativo) — para cuando useAuthStore hidrata acá, token/user ya
// están. Sin RequireAuth: su redirect a '/' mostraría el shell completo
// de la app adentro del WebView, sin sentido en este contexto aislado —
// si la inyección falló por algún motivo, se muestra un mensaje corto
// en su lugar, sin navegar a ningún lado.
export function CheckoutWebPage() {
  const params = useLocalSearchParams();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postToNative = (payload) => {
    window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  };

  if (!hydrated) return null;

  if (!token) {
    return (
      <View className="flex-1 items-center justify-center bg-paper p-6 dark:bg-ink" nativeID="checkout-page-no-session" testID="checkout-page-no-session">
        <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="checkout-page-no-session-label" testID="checkout-page-no-session-label">
          No pudimos validar tu sesión. Cerrá esta ventana e intentá de nuevo.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper p-4 dark:bg-ink" nativeID="checkout-page-root" testID="checkout-page-root">
      <CheckoutFlow
        amount={Number(params.amount)}
        marketplace={params.marketplace === 'true'}
        onApproved={(payment) => postToNative({ status: 'approved', payment })}
        onError={(error) => postToNative({ status: 'error', message: error?.message ?? 'Error desconocido' })}
        preferenceId={params.preferenceId}
        publicKey={params.publicKey}
      />
    </View>
  );
}
```

- [ ] **Step 4: Crear la ruta `app/checkout.jsx`**

```jsx
// app/checkout.jsx
import { CheckoutWebPage } from '../components/payments/checkout-web-page.jsx';

export default function Checkout() {
  return <CheckoutWebPage />;
}
```

Ruta a nivel raíz (fuera de `app/(tabs)/`), mismo patrón que `app/login.jsx` — sin el shell (`AppWebShell`/tabs), que solo envuelve rutas dentro de `(tabs)`.

- [ ] **Step 5: Lint**

Run: `npx eslint components/payments/checkout-web-page.jsx app/checkout.jsx`
Expected: sin errores.

- [ ] **Step 6: Verificación manual en preview web**

Con `EXPO_PUBLIC_USE_MOCKS=true` y una sesión iniciada (localStorage ya tiene `paceron.auth` real del login normal — no hace falta simular la inyección para probar esta página sola): navegar a `/checkout?preferenceId=1&publicKey=TEST&amount=1000` directo en el browser. Debe renderizar el mismo brick que ya se ve en `/profile/payments-testbed`, sin el shell de la app (sin sidebar/header). Sin sesión (logout primero): mensaje "No pudimos validar tu sesión."

- [ ] **Step 7: Commit**

```bash
git add config/env.js .env.example components/payments/checkout-web-page.jsx app/checkout.jsx
git commit -m "feat(payments): add standalone /checkout page for the native WebView"
```

---

### Task 2: Modal nativo con WebView (`checkout-flow.jsx` + dependencia)

**Files:**
- Modify: `package.json`, `package-lock.json` (nueva dependencia)
- Modify: `components/payments/checkout-flow.jsx` (reescritura completa del placeholder)

**Interfaces:**
- Consumes: `WEB_ORIGIN` de `config/env.js` (Task 1). `useAuthStore.getState()` (ya existente). `useThemeMode()` de `providers/theme-provider.jsx` (ya existente). Contrato de `postMessage` de Task 1 (`{status: 'approved', payment}` / `{status: 'error', message}`).
- Produces: `CheckoutFlow({ preferenceId, publicKey, amount, marketplace, onApproved, onError, onCancel })` — mismo nombre y forma de props que la variante web, más `onCancel`.

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install react-native-webview@^14.0.1 --legacy-peer-deps`

Verificar: `git diff --stat package.json package-lock.json` — debe mostrar 1 línea nueva en `package.json` y, en `package-lock.json`, solo la entrada de `react-native-webview` y sus dependencias transitivas propias — ningún otro paquete existente debería cambiar de versión. Si aparece un diff más grande o versiones de paquetes no relacionados cambiando, no seguir — reportar el detalle exacto en vez de forzarlo.

- [ ] **Step 2: Reescribir `components/payments/checkout-flow.jsx`**

```jsx
// components/payments/checkout-flow.jsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { useAuthStore } from '../../store/auth-store.js';
import { WEB_ORIGIN } from '../../config/env.js';

// Rama nativa de CheckoutFlow — WebView cargando la misma página web del
// checkout (app/checkout.jsx), en vez de duplicar UI nativa o salir a un
// navegador externo (Checkout Pro). Firma idéntica a la variante web más
// un `onCancel` opcional — asimetría real y aceptada: el brick inline en
// web no tiene concepto de "cerrar", el modal nativo sí. Ver
// docs/superpowers/specs/2026-09-03-payments-checkout-webview-design.md.
export function CheckoutFlow({ preferenceId, publicKey, amount, marketplace, onApproved, onError, onCancel }) {
  const colors = useThemeColors();
  const { themeMode } = useThemeMode();
  const webViewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);

  // Sesión mínima, NO el objeto completo que persiste auth-store.js — sin
  // refreshToken. Si el access token vence a mitad del pago, el refresh
  // silenciosamente falla en un contexto de menor confianza en vez de
  // exponer el refresh token ahí — recuperable reabriendo el checkout, la
  // sesión real de la app (expo-secure-store) no se toca.
  const [session] = useState(() => {
    const { user, token, expiresAt, activeRole } = useAuthStore.getState();
    return { user, token, expiresAt, activeRole };
  });

  // Sin sesión, ni se monta el WebView. onError se llama en un efecto, no
  // durante el render (llamar un callback del padre en medio del render
  // es un anti-patrón de React — puede disparar el warning "Cannot
  // update a component while rendering a different component").
  useEffect(() => {
    if (!session.token) onError?.(new Error('Sesión inválida — no se pudo abrir el checkout.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session.token) return null;

  const injectedJavaScriptBeforeContentLoaded = `
    window.localStorage.setItem('paceron.auth', ${JSON.stringify(JSON.stringify(session))});
    window.localStorage.setItem('paceron-theme-mode', ${JSON.stringify(themeMode)});
    true;
  `;

  const queryParams = new URLSearchParams({
    preferenceId,
    publicKey,
    amount: String(amount),
    ...(marketplace ? { marketplace: 'true' } : {}),
  });
  const checkoutUrl = `${WEB_ORIGIN}/checkout?${queryParams.toString()}`;

  const handleMessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (payload.status === 'approved' && payload.payment) {
      setResolved(true);
      onApproved?.(payload.payment);
    } else if (payload.status === 'error') {
      setResolved(true);
      onError?.(new Error(payload.message ?? 'Error en el checkout'));
    }
  };

  const handleClose = () => {
    if (!resolved) onCancel?.();
  };

  const handleShouldStartLoadWithRequest = (request) => request.url.startsWith(WEB_ORIGIN);

  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <Modal animationType="slide" nativeID="checkout-flow-modal" onRequestClose={handleClose} testID="checkout-flow-modal" visible>
      <View className="flex-1 bg-paper dark:bg-ink" nativeID="checkout-flow-modal-root" testID="checkout-flow-modal-root">
        <View className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700" nativeID="checkout-flow-modal-header" testID="checkout-flow-modal-header">
          <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="checkout-flow-modal-title" testID="checkout-flow-modal-title">Checkout</Text>
          <Pressable
            accessibilityLabel="Cerrar"
            className="p-1 hover:opacity-70 active:opacity-70"
            nativeID="checkout-flow-modal-close-button"
            onPress={handleClose}
            testID="checkout-flow-modal-close-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
          </Pressable>
        </View>

        {loadError ? (
          <View className="flex-1 items-center justify-center gap-4 px-6" nativeID="checkout-flow-modal-error" testID="checkout-flow-modal-error">
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="checkout-flow-modal-error-label" testID="checkout-flow-modal-error-label">
              No pudimos cargar el checkout.
            </Text>
            <Pressable
              className="rounded-full bg-primary px-6 py-2.5 hover:opacity-90 active:opacity-80"
              nativeID="checkout-flow-modal-retry-button"
              onPress={handleRetry}
              testID="checkout-flow-modal-retry-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="checkout-flow-modal-retry-button-label" testID="checkout-flow-modal-retry-button-label">
                Reintentar
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1" nativeID="checkout-flow-modal-webview-wrap" testID="checkout-flow-modal-webview-wrap">
            <WebView
              allowFileAccess={false}
              incognito
              injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
              javaScriptCanOpenWindowsAutomatically={false}
              mixedContentMode="never"
              onError={() => { setLoadError(true); setLoading(false); }}
              onHttpError={() => { setLoadError(true); setLoading(false); }}
              onLoadEnd={() => setLoading(false)}
              onMessage={handleMessage}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              originWhitelist={[WEB_ORIGIN]}
              ref={webViewRef}
              setSupportMultipleWindows={false}
              source={{ uri: checkoutUrl }}
              style={{ flex: 1 }}
            />
            {loading && (
              <View className="absolute inset-0 items-center justify-center bg-paper dark:bg-ink" nativeID="checkout-flow-modal-loading" testID="checkout-flow-modal-loading">
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint components/payments/checkout-flow.jsx`
Expected: sin errores (`local/require-native-id` en verde — `WebView`/`ActivityIndicator` no están en la lista que la regla exige, todo lo demás sí tiene `nativeID`/`testID`).

- [ ] **Step 4: `npm test` — confirmar que el resto de la suite sigue verde**

Run: `npm test`
Expected: sin regresiones (este cambio no agrega tests nuevos — sin tests de render de componentes, convención del proyecto — pero la reescritura no debe romper nada existente).

- [ ] **Step 5: Nota de verificación manual (requiere build, fuera de esta tarea)**

`react-native-webview` es módulo nativo — no funciona en Expo Go. Verificación real (¿abre el modal? ¿carga `/checkout`? ¿tema y sesión se inyectan bien?) necesita un build (`eas build --local`, mismo camino que se usó para `expo-notifications`) — no se hace en esta tarea, el controller lo coordina aparte si corresponde.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/payments/checkout-flow.jsx
git commit -m "feat(payments): open real WebView checkout modal on native"
```
