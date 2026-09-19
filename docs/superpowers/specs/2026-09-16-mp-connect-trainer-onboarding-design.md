# Conexión de Mercado Pago obligatoria en el alta de entrenador (mp-connect)

## Contexto

El backend ya tenía el OAuth de Mercado Pago completo (`GET /mercadopago/connect`,
`/connect/callback`, `/connect/status`, webhook de desautorización, tabla `seller_connections`),
pero el frontend no tenía **nada** de mp-connect: ni servicio, ni pantalla, ni forma de disparar
el flujo. Sin esa conexión el backend no tiene un `access_token` del vendedor, así que no puede
crear preferencias con split — el corredor no le puede pagar al entrenador.

Además, el callback del backend respondía JSON: después de autorizar en Mercado Pago el usuario
quedaba varado en una pestaña mostrando `{"success":true}`. Eso se resolvió del lado del backend
(`feature/mp-connect-callback-redirect`): ahora procesa el `code` y redirige acá con
`?status=success` o `?status=error&reason=<slug>`.

**Decisión de producto:** para activar el perfil de entrenador ahora hacen falta **las dos
cosas** — un alias de pagos válido (como antes) **y** la cuenta de Mercado Pago conectada.

> Esto **revierte** la decisión de
> [`2026-08-12-trainer-split-payments-decisions.md`](./2026-08-12-trainer-split-payments-decisions.md)
> ("Conviven, no se reemplazan"), que preveía mp-connect como opcional junto a `bank_alias`.
> Siguen conviviendo, pero ahora ambos son obligatorios para activar.

## Alcance

**Sí:** servicio, hook de estado, botón de conexión cross-platform, página de retorno, y el gate
en `activate-trainer-screen.jsx`.

**No:** el enforcement en el backend. `POST /users/{id}/trainer-role` sigue aceptando la
activación sin conexión de MP — decisión explícita, el gate es solo de UI por ahora. Implica que
un cliente viejo (hay APKs distribuidos) o una llamada directa a la API pueden saltearlo.

## Mecánica: por qué web y nativo van distinto

### Nativo — Custom Tabs, no WebView

Mercado Pago
[deprecó el login dentro de WebView embebida](https://www.mercadopago.com.ar/developers/es/news/2023/11/30/WebView-integrations-have-been-deprecated)
(discontinuado el 10/12/2024) y recomienda Chrome Custom Tabs / Safari View Controller. Por eso
**no se reusa el patrón de `checkout-flow.jsx`**: ese WebView es legítimo porque carga *nuestra*
página del Brick, sin login de MP adentro; este flujo sí tiene login.

Va por `expo-web-browser` + `openAuthSessionAsync`, que en Android es exactamente una Custom Tab.
**Es un módulo nativo nuevo → cambia el fingerprint de `runtimeVersion` → hace falta un APK
nuevo, un OTA no alcanza.**

### Web — ventana emergente, no redirect de página completa

Un redirect de página completa perdería el alias que el usuario ya tipeó, y al volver fuerza un
boot completo del bundle (`vercel.json` reescribe todo a la SPA) más el cold start de Render. La
ventana emergente deja el árbol de React montado. Iframe no es opción: MP manda `X-Frame-Options`.

**El detalle que hace o rompe esto:** `window.open` tiene que ser **sincrónico dentro del
handler del click**, antes de cualquier `await`. Abierto después del fetch, ya se perdió el gesto
del usuario y el navegador lo bloquea.

### Cómo sabe el backend a dónde volver

El `redirect_uri` registrado en Mercado Pago es fijo y tiene que coincidir exacto, así que no
puede variar por request. El frontend declara la plataforma con
`GET /mercadopago/connect?platform=web|app` y el backend codifica ese target en el tercer
segmento del `state` (`"<userID>-<timestamp>-<target>"`), que es el único parámetro que MP
devuelve tal cual. Al procesar el callback lo lee para elegir entre `MP_OAUTH_WEB_RETURN_URL` y
`MP_OAUTH_APP_RETURN_URL`.

## Principio: `/connect/status` es la fuente de verdad

Lo que llega por el canal de retorno (postMessage o deep link) sirve **solo para el mensaje
inmediato**. El estado real se confirma siempre con un refetch de `GET /connect/status`, en las
**cuatro** salidas: éxito, error, cancelación y cierre inesperado.

Esto es lo que hace que ningún fallo del canal rompa la feature — solo la degrada:

| Falla | Qué pasa |
|---|---|
| Ventana emergente bloqueada | Toast explícito; `window.open` devuelve `null` |
| Usuario cierra a mitad | Polling de `popup.closed` → `onCancel` → refetch |
| COOP deja `window.opener` en `null` | El postMessage no llega, pero el polling sí |
| `MP_OAUTH_WEB_RETURN_URL` con otro origen | `event.origin` no matchea y el mensaje se descarta; cae al polling |
| Deep link que no resuelve en Android | `openAuthSessionAsync` devuelve `dismiss` → refetch |

## Archivos

| Archivo | Rol |
|---|---|
| `services/mp-connect.js` | `getMpConnectAuthUrl(platform)`, `getMpConnectStatus()` |
| `services/__mocks__/mp-connect-mock.js` | Estado en memoria + `mockCompleteMpConnect()` |
| `hooks/use-mp-connect.js` | `useMpConnectStatus()` — `staleTime: 0` + `refetchOnWindowFocus` |
| `components/payments/mp-connect-button-view.jsx` | Parte visual, compartida por las dos plataformas |
| `components/payments/mp-connect-button.web.jsx` | Ventana emergente + `postMessage` + polling |
| `components/payments/mp-connect-button.jsx` | `expo-web-browser` + deep link |
| `components/payments/mp-connect-callback-page.jsx` | Página de retorno; avisa al opener y se cierra |
| `app/mp-connect/callback.jsx` | Ruta, fuera de `(tabs)` — mismo criterio que `app/checkout.jsx` |
| `utils/mp-connect-messages.js` | Slug del backend → texto en español |
| `components/profile/activate-trainer-screen.jsx` | Tarjeta nueva + `canSubmit = aliasOk && mpConnected` |

Los `reason` (`invalid_state`, `expired_state`, `exchange_failed`, …) son un contrato estable del
backend; **nunca mostrar el slug crudo**, siempre el mapeo de `mp-connect-messages.js`. El backend
los manda justamente para no filtrar el texto del error a una URL que termina en el historial del
navegador y en los logs de Vercel.

## Riesgo conocido, no resuelto

El `state` del backend no está firmado, no se persiste y no es single-use (solo expiry de 10 min),
y el callback es público. Alguien puede autorizar su propia cuenta de MP y reenviar su `code` con
un `state` forjado con el `user_id` de otro (son secuenciales), quedándose con los cobros de ese
entrenador. Decidido dejarlo documentado por ahora; ver
`openspec/changes/redirect-callback-mp-connect-al-frontend/design.md` en el repo del backend.
**Revisar antes de cualquier uso con dinero real.**
