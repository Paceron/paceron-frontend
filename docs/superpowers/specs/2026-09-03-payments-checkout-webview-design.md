# Checkout nativo vía WebView — Design

**Fecha:** 2026-09-03
**Estado:** Aprobado, en desarrollo

## Contexto

`docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md`
(Fase 0 de pagos, PR #88 mergeada) dejó `components/payments/checkout-flow.jsx`
(variante nativa de `CheckoutFlow`) como un placeholder "Próximamente en
la app" — la decisión WebView vs. Checkout Pro había quedado
deliberadamente pendiente. Esta spec la resuelve: WebView, cargando la
misma página web real que ya renderiza el Payment Brick
(`components/payments/checkout-flow.web.jsx`), en vez de duplicar UI de
checkout nativo o salir a un navegador externo (Checkout Pro).

Sigue sin haber verificación en vivo contra Mercado Pago (el backend no
tiene credenciales de sandbox cargadas) — este trabajo es plomería,
igual que Fase 0. No depende del backend para avanzar.

## Alcance de esta spec

`app/checkout.jsx` (nuevo, ruta pública fuera de `(tabs)/`),
`components/payments/checkout-web-page.jsx` (nuevo),
`components/payments/checkout-flow.jsx` (reescribe el placeholder
nativo), `config/env.js`/`.env.example` (nueva env var
`EXPO_PUBLIC_WEB_ORIGIN`), `package.json` (nueva dependencia
`react-native-webview`).

## Decisiones

### Arquitectura: WebView cargando `/checkout`, no Checkout Pro ni brick nativo duplicado

Mismo criterio que ya había quedado sentado en el spec original de
pagos (2026-08-12): reusar la misma pantalla web (`CheckoutFlow.web.jsx`)
en vez de mantener dos implementaciones de checkout. `app/checkout.jsx`
es una ruta real de la app web (deployada en Vercel, mismo origen que el
resto de la web), sin chrome (`AppWebShell`/tabs) — solo existe para ser
cargada como documento standalone dentro del `WebView` nativo. Nadie
navega ahí desde dentro de la app nativa; en web normal (browser real)
tampoco se linkea a esa ruta — `CheckoutFlow.web.jsx` se sigue montando
inline donde haga falta (testbed, futuro flujo de tier).

### Sesión inyectada: mínima, no la sesión completa

`app/checkout.jsx` necesita autenticarse contra el backend
(`processPayment` pega con `Authorization: Bearer`) pero el `WebView` es
un contexto de storage aislado (su propio `localStorage`, vacío al
arrancar). Se inyecta vía `injectedJavaScriptBeforeContentLoaded`, antes
de cargar contenido:

- `paceron.auth` en `localStorage` — pero **no** el objeto completo que
  persiste `store/auth-store.js` (que incluye `refreshToken`). Se inyecta
  un subconjunto `{ user, token, expiresAt, activeRole }` —
  `useAuthStore#hydrate()` ya tolera campos ausentes (`?? null` /
  `Array.isArray` checks), así que esto hidrata sin romper nada. Si el
  access token vence a mitad del pago (poco probable, flujo de segundos),
  el refresh silenciosamente falla en vez de exponer el refresh token en
  un contexto de menor confianza que la sesión real de la app (guardada
  en `expo-secure-store`, nunca tocada por esto) — recuperable
  reabriendo el checkout.
- `paceron-theme-mode` en `localStorage` — mismo mecanismo, resuelve el
  problema de tema (ver abajo).

Todos los valores interpolados en el script inyectado van con
`JSON.stringify` (nunca concatenación cruda de strings).

### Tema: se inyecta, no se puede leer del sistema

`providers/theme-provider.jsx#readInitialThemeMode()` en web lee
`window.localStorage.getItem('paceron-theme-mode')`, default `'dark'`
sin esa clave. Como el `WebView` arranca con `localStorage` vacío,
`/checkout` siempre caería a `'dark'` sin importar el tema real de la
app nativa — se resuelve inyectando esa misma clave junto con la sesión
(ver arriba). El componente nativo que abre el modal lee el tema actual
con `useThemeMode()` al montar (leer acá no pega contra el árbol de
navegación raíz — ese cuidado en `ThemeProvider` es solo para el
provider mismo, no para un consumidor hoja).

### Seguridad del WebView

- `originWhitelist={[WEB_ORIGIN]}` + `onShouldStartLoadWithRequest` que
  deniega en silencio cualquier navegación top-level fuera de ese
  origen — defensa en profundidad, algunas versiones de Android WebView
  no respetan `originWhitelist` de forma estricta para todos los casos.
- `javaScriptCanOpenWindowsAutomatically={false}`,
  `setSupportMultipleWindows={false}` (sin popups), `allowFileAccess={false}`,
  `mixedContentMode="never"` (fuerza HTTPS).
- `incognito={true}` (Android) — sin cache/cookies persistentes entre
  aperturas, cada checkout arranca limpio.
- `onMessage` valida el shape del mensaje (`JSON.parse` en try/catch,
  `status` contra un enum esperado) antes de confiar en él — nunca se
  asume que un postMessage recibido es válido solo porque llegó del
  origen esperado.
- Fail-fast: si `useAuthStore.getState().token` es falsy al momento de
  abrir el modal, ni se monta el `WebView` — error inmediato del lado
  nativo.

### Eficiencia

`WebView` se monta solo al abrir el modal, se desmonta completo al
cerrar — nunca queda instanciado de fondo. Sin polling: el resultado
llega por `postMessage` desde `checkout-web-page.jsx`
(`window.ReactNativeWebView?.postMessage(JSON.stringify({status,
paymentId | error}))` — el `?.` porque ese global no existe en un
browser normal, solo dentro de un `WebView` de React Native).

### Sin piezas nuevas de estado global

No hace falta Zustand ni TanStack Query nuevos — el estado del modal
(visible/loading/error) es local al componente `CheckoutFlow.jsx`,
mismo criterio que ya usa la variante web. La única dependencia nueva es
`react-native-webview` (sin config plugin de Expo, autolinked).

### Contrato de `CheckoutFlow`: nuevo prop `onCancel`

`{ preferenceId, publicKey, amount, marketplace, onApproved, onError,
onCancel }` — `onCancel` (opcional) dispara cuando el usuario cierra el
modal manualmente sin haber recibido `approved`/`error` por postMessage.
Es una asimetría real y aceptada con la variante web (el brick inline no
tiene concepto de "cerrar" propio) — el caller decide qué hacer con la
cancelación (probablemente nada, o un aviso suave, nunca un error).

### Manejo de errores

- **Falla de carga del WebView** (`onError`/`onHttpError`): overlay
  propio dentro del modal — "No pudimos cargar el checkout" + botón
  "Reintentar" (`webViewRef.current.reload()`) + "Cerrar". No es un
  Toast, es estado del modal mismo.
- **Navegación bloqueada** (`onShouldStartLoadWithRequest` deniega): sin
  UI, se deniega en silencio — no es un caso de usuario legítimo.
- **Mensaje malformado** (`JSON.parse` falla o `status` fuera del enum
  esperado): se ignora, no dispara `onApproved` ni `onError`.
- **`nativeID`/`testID`:** `WebView` no es un primitivo de la lista que
  exige la regla `local/require-native-id`
  (`View`/`Text`/`Pressable`/`Modal`/etc. + `Animated.*`) — es un
  componente nativo de terceros, mismo criterio ya confirmado para
  `ActivityIndicator`. El `Modal`/overlays que lo envuelven sí necesitan
  los ids como siempre.

### Nueva env var

`EXPO_PUBLIC_WEB_ORIGIN` en `config/env.js` (+ `.env.example`), default
`https://paceron-frontend.vercel.app` — mismo patrón que
`EXPO_PUBLIC_API_URL`. Para iterar sin depender de un deploy en Vercel
por cada cambio, puede apuntar a la IP LAN del dev server local durante
desarrollo — mismo condicionante de red que ya aplica a Expo Go
(dispositivo y dev server en la misma WiFi).

## Fuera de alcance

Verificación en vivo de un pago completo contra Mercado Pago (sigue sin
sandbox del lado backend). Checkout Pro como alternativa (WebView ya
decidido). Cualquier lógica de Fase 1/2 (gating de tier, split al
entrenador) — este trabajo es exclusivamente la plomería de presentación
nativa del checkout ya existente de Fase 0.

## Verificación

`react-native-webview` es módulo nativo — no funciona en Expo Go,
necesita build (`eas build --local`, mismo camino que se usó para
`expo-notifications`). Alcance realista sin sandbox de MP: confirmar que
el modal abre, carga `/checkout` real, inyecta sesión y tema
correctamente (inspeccionable), y que las props de seguridad están bien
puestas — el pago de punta a punta sigue sin poder cerrarse.

`npm test` y `npm run lint` en verde antes de abrir la PR.
