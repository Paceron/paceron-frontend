# Checkout de suscripción/tier (Sub-proyecto A) — Diseño

> Spec del Sub-proyecto A definido en [`2026-08-11-payments-integration-feasibility-analysis.md`](./2026-08-11-payments-integration-feasibility-analysis.md): pago sin split (`concept: subscription`), un solo vendedor (Paceron), sin OAuth de nadie. Cubre el flujo completo de upgrade de tier en `tier-upgrade-screen.jsx`, para web y nativo (iOS/Android). El Sub-proyecto B (split/marketplace corredor-entrenador) queda fuera de este spec.
>
> **El backend de pagos todavía no existe** — solo el documento de propuesta backend citado en el análisis de viabilidad. Este spec se diseña contra ese contrato propuesto, aceptando que puede necesitar ajustes cuando el backend se confirme (mismo criterio ya usado para Teams).

## Objetivo

Que un usuario pueda pagar el upgrade **y la renovación mensual** de su tier (corredor o entrenador) desde `tier-upgrade-screen.jsx`, con **una experiencia visual equivalente en web, iOS y Android** — la misma pantalla de pago (Mercado Pago Checkout Bricks) en las tres plataformas, en vez de una UI de pago distinta por plataforma. El tier es una cuota mensual con pago manual (sin débito automático), no una compra única — ver "Vencimiento y renovación del tier" más abajo.

## Decisión central: un solo checkout web, reutilizado en las tres plataformas

Mercado Pago no ofrece un Brick nativo — está confirmado tanto en el documento de diseño backend como en la documentación oficial de MP, que para integraciones Expo/React Native recomienda directamente redirección externa (Checkout Pro + `expo-web-browser`), no un componente embebible nativo. Los SDKs nativos no oficiales que existen (`react-native-checkout-mercadopago` y similares) envuelven una API de MP más vieja, no están mantenidos por Mercado Pago, y requieren salir del workflow managed de Expo — se descartan por riesgo de mantenimiento en un flujo crítico de pagos.

Dado que el objetivo explícito es homogeneidad entre plataformas, la decisión es: **construir un único checkout web (`@mercadopago/sdk-react`, Payment Brick) y reutilizarlo en las tres plataformas**, con dos formas de montarlo:

- **Web:** el componente del Brick se monta **inline**, directamente dentro de `tier-upgrade-screen.jsx` — no hace falta navegar a ninguna URL nueva, es la misma instancia de la app.
- **Nativo (iOS/Android):** un `WebView` (`react-native-webview`, primera dependencia de este tipo en el repo) carga esa misma pantalla de checkout, pero como una **URL real** del despliegue web de Paceron (`https://paceron-frontend.vercel.app/checkout`, mismo dominio ya usado como `back_url` en el documento de diseño backend) — porque un `WebView` no puede montar un componente React Native en memoria, necesita cargar una página real por HTTP. Es el mismo bundle web, la misma UI, servido como página independiente.

Esto reemplaza la alternativa evaluada inicialmente (Checkout Pro/`expo-web-browser`, redirección a una página 100% de Mercado Pago) — descartada porque no cumple el objetivo de homogeneidad: ahí el usuario ve la marca de MP, no la de Paceron, y es una UI de pago completamente distinta a la de web.

## Arquitectura

### Ruta web dedicada — `/checkout`

Ruta nueva (Expo Router), ej. `app/checkout.jsx`, que renderiza únicamente el Brick + su chrome (`SectionCard`), recibiendo `tierId`/`preferenceId` por query param. Es una página angosta y autocontenida — no hereda el shell completo de la app (sin tabs, sin navegación), porque su único consumidor real en nativo es el `WebView`, que la ve como una página aislada.

En **desktop web**, esta misma ruta no hace falta navegarla — `tier-upgrade-screen.jsx` importa y monta el mismo componente (`components/payments/checkout-brick.jsx`, ver abajo) directamente dentro de sí misma. La ruta `/checkout` existe principalmente para tener una URL real que cargar desde el `WebView` nativo, aunque también sirve como fallback funcional si se navega ahí directo en un browser de escritorio.

### `components/payments/checkout-brick.jsx` (nuevo, no requiere variante `.web.jsx`)

A diferencia de lo planteado originalmente en el análisis de viabilidad, **este componente no necesita split por archivo** — corre exclusivamente dentro de contextos web (la app web de escritorio, o la página `/checkout` cargada dentro del `WebView` nativo, que también es "web" desde la perspectiva de React). Nunca se monta directamente en un árbol de React Native puro, así que `@mercadopago/sdk-react` no necesita aislarse de un bundle nativo — Metro solo lo resuelve al compilar la salida web del proyecto (`web.output`), que es lo único que consume tanto el desktop web como el `WebView` nativo.

- Usa `initMercadoPago(publicKey)` + `<Payment>` (env var `EXPO_PUBLIC_MP_PUBLIC_KEY`, ver más abajo).
- `onSubmit` llama a `createPayment` (`services/payments.js`).
- Al resolver el pago (`approved`/`rejected`/pendiente no resuelto), llama a una función `reportResult(result)` recibida por prop — la pantalla que lo monta decide qué hacer con el resultado.

### Cómo se entera nativo del resultado — `postMessage`, no navegación

Como el `WebView` nativo carga la ruta `/checkout` (no Checkout Pro de MP), no hay redirección de MP de la cual depender para detectar que el pago terminó — el propio Brick ya sabe el resultado apenas se resuelve `onSubmit`. La página `/checkout`, al detectar que corre embebida (`typeof window.ReactNativeWebView !== 'undefined'`, patrón estándar de `react-native-webview`), llama `window.ReactNativeWebView.postMessage(JSON.stringify({ status, paymentId }))` en el mismo punto donde en desktop web llamaría directamente `reportResult(result)`. El componente nativo que hostea el `WebView` escucha `onMessage`, parsea el resultado, cierra el `WebView`, y sigue el mismo flujo de UI que ya se define en desktop web (Toast + actualización optimista del tier, ver sección de UX).

Esta es la única rama condicional que introduce la página `/checkout` — sigue funcionando como página normal si se abre directo en un browser (el `if` simplemente no dispara), no es un componente separado por plataforma.

### Autenticación dentro del `WebView`

La ruta `/checkout` necesita saber quién es el usuario (para crear/consultar el pago autenticado). El `WebView` es un contexto de storage aislado — no comparte el `expo-secure-store` de la app nativa. Solución: antes de que cargue el contenido, se inyecta el token (y demás datos mínimos de sesión) directamente en el `localStorage` del `WebView`, bajo la misma clave que ya usa el store persistido de auth en la versión web de la app (`paceron.auth`), vía la prop `injectedJavaScriptBeforeContentLoaded` de `react-native-webview`. Cuando React monta `/checkout` dentro del `WebView`, el store de auth hidrata exactamente igual que en cualquier sesión web normal — **no hace falta lógica especial en la página `/checkout` para reconocer que está en un `WebView`, solo para el paso de `postMessage` del resultado**.

Se prefiere este mecanismo (inyección a `localStorage` antes de cargar) por sobre pasar el token como query param en la URL — evita que el token quede en logs de acceso del servidor web o en cualquier registro de la URL cargada.

### Nueva env var — URL del despliegue web

`config/env.js` necesita saber a qué URL apunta el `WebView` nativo. Mismo patrón que `API_BASE_URL`:

```js
const WEB_APP_URL = 'https://paceron-frontend.vercel.app';
export const CHECKOUT_URL = process.env.EXPO_PUBLIC_WEB_APP_URL || WEB_APP_URL;
```

Documentar en `.env.example` igual que las demás.

### `EXPO_PUBLIC_MP_PUBLIC_KEY` — solo se usa del lado web

Se define una vez (`config/env.js` + `.env.example`), pero **solo la consume el bundle web** (`checkout-brick.jsx`, vía `initMercadoPago`). El shell nativo que hostea el `WebView` no necesita ninguna credencial de Mercado Pago — no ejecuta código de MP directamente, solo carga una URL que ya la trae resuelta.

## Capa de servicio — `services/payments.js` (nuevo)

Sigue el patrón de `services/user.js`/`services/roles.js`:

- `getTiers(activeRole)` → `GET /api/v1/tiers?role=...` (o el parámetro que confirme backend) — catálogo real, reemplaza el hardcode actual de `tier-upgrade-screen.jsx`. **Se asume catálogo distinto por rol** (un tier premium de corredor y uno de entrenador probablemente desbloquean cosas distintas — límite de equipos vs. límite de miembros, por ejemplo) — a confirmar contra backend, ver `docs/BACKEND_PAYMENTS_REQUIREMENTS.md`.
- `createPreference({ tierId })` → `POST /api/v1/payments/preference` → `{ preference_id, public_key }`.
- `createPayment({ preferenceId, formData })` → `POST /api/v1/payments` — lo llama el `onSubmit` del Brick.
- `getPayment(id)` → `GET /api/v1/payments/:id` — usado para el refresh en background post-pago.

Mock correspondiente en `services/__mocks__/payments-mock.js` (activable con `EXPO_PUBLIC_USE_MOCKS=true`), con tests en `__tests__/` — servicio y mock, no de render, consistente con la convención de testing del proyecto.

## Estado — TanStack Query

Estado de servidor → TanStack Query, no Zustand (convención ya escrita en `CLAUDE.md`). `useMutation` para `createPreference`/`createPayment`. Sin `useQuery` con `refetchInterval` — al no depender de que el usuario vuelva de un redirect externo (ya no hay Checkout Pro en el flujo principal), el resultado llega directo por el `onSubmit` del Brick o por el `postMessage` del `WebView`, no hace falta polling.

## Flujo de UX — `tier-upgrade-screen.jsx`

1. Al montar: `useQuery(getTiers(activeRole))` — reemplaza la pill estática "Próximamente". **Alcance: solo upgrade** — el tier actual del usuario se muestra pero no es seleccionable, y no se listan tiers inferiores al actual. Downgrade queda explícitamente fuera de alcance de este spec (implica definir reembolso/prorrateo del período ya pagado, decisión de producto no tomada).
2. Usuario selecciona tier destino → botón "Actualizar" (deshabilitado mientras la mutation está en curso, mismo patrón `disabled={loading}` de `ChangePasswordSection` — evita doble submit) → `useMutation(createPreference)`.
3. Con la preferencia creada:
   - **Web:** se monta `checkout-brick.jsx` inline, dentro de la misma pantalla (reemplaza el bloque de selección, envuelto en `SectionCard`).
   - **Nativo:** se abre un modal de pantalla completa (`Modal` de RN) con el `WebView` apuntando a `${CHECKOUT_URL}/checkout?tierId=...`, token inyectado como se describió arriba.
4. Resultado `approved` (ambas plataformas, vía `reportResult`/`onMessage`): actualización **optimista** del tier en la UI + `Toast.show({type:'success'})` — mismo patrón que `ChangePasswordSection`. En paralelo, invalida la query de `/auth/permissions` en background para que el store termine reflejando el valor real, sin bloquear al usuario mientras tanto.
5. Resultado `rejected` o cierre manual del checkout (nativo: botón de cerrar el modal): `Toast.show({type:'error'})`, la pantalla vuelve al estado de selección sin cambios — no redirige, mismo criterio que `ChangePasswordSection`.
6. Estado `pending` (3DS/offline): delegado al `<StatusScreen>` del propio Brick — igual en las tres plataformas, porque las tres corren el mismo componente.
7. Si `createPreference` falla (red, cold-start de Render, etc.): `Toast.show({type:'error'})` antes de intentar abrir cualquier checkout — nunca se monta el Brick/`WebView` sin un `preference_id` válido.

## Vencimiento y renovación del tier

Confirmado por el usuario: el tier **no es una compra única** — es mensual, pago manual (sin débito automático, igual que Sub-proyecto B), con vencimiento y un plazo de gracia para renovar. Esto amplía el alcance de este spec respecto a lo planteado inicialmente (que trataba el tier como un upgrade permanente):

- **Renovar es pagar de nuevo** — mismo `checkout-brick.jsx`/`WebView` que el upgrade inicial, sin pantalla nueva. Puede dispararse proactivamente (antes de vencer) o reactivamente (ya vencido, dentro del plazo de gracia) desde el mismo `tier-upgrade-screen.jsx`.
- **Si no se renueva dentro del plazo de gracia, el tier baja automáticamente a `base`** — mismo tipo de mecanismo que la expulsión automática de equipo en Sub-proyecto B (lo dispara el backend, el frontend solo refleja el resultado). La duración del plazo de gracia es un valor sin definir todavía (mismo tipo de dato que `marketplace_fee`/precio mínimo en B — existe, no está decidido).
- **Necesita del backend:** una fecha de vencimiento por tier/rol, no solo el string `tier: 'base'|'premium'` que expone hoy `/auth/permissions` — sin eso, `tier-upgrade-screen.jsx` no puede mostrar "vence en 3 días" ni decidir cuándo pasar de estado normal a estado de renovación urgente.
- **Solo el tier pago vence — `base` es gratis y permanente**, confirmado por el usuario. No necesita fecha de vencimiento ni renovación; la mecánica de esta sección aplica únicamente a tiers superiores a `base`.
- Un usuario tiene **tiers independientes por rol** (ya confirmado: puede ser entrenador premium y corredor base a la vez, o cualquier combinación) — el vencimiento/renovación es por rol, no un estado único de cuenta.

### Equipo congelado — caso borde resuelto, alcance nuevo

Caso borde detectado en el código (`store/team-store.js` define `TEAM_MEMBER_LIMITS` por tier — `base: 10, pro: 50, premium: 300` — para el límite de miembros de un equipo), y ya resuelto conceptualmente por el usuario: si un entrenador premium con, por ejemplo, 50 miembros no renueva y baja a `base` (límite 10), el equipo entra en un estado nuevo, **"congelado"** — no hay plazo, dura hasta que el entrenador regularice.

- **No se expulsa a nadie automáticamente.** Ni entrenador ni corredores son removidos por esto — el equipo queda bloqueado tal cual está.
- **Bloqueo amplio, no solo "no podés sumar gente":** al entrar al equipo (entrenador o corredor), se muestra una pantalla/aviso indicando que hace falta recuperar el tier o reducir la cantidad de miembros para poder seguir gestionándolo/usándolo con normalidad. El alcance exacto de qué queda bloqueado para los corredores (¿ven el equipo en modo solo lectura? ¿no pueden ver el plan de entrenamiento?) es un detalle fino que falta terminar de definir — no bloqueante para el resto del diseño, pero pendiente.
- **Indicador visual en la lista de equipos:** los equipos congelados necesitan un color/estado distintivo en `teams-list-screen.jsx` (y sus variantes web/mobile shell), visible tanto para el entrenador dueño como para los corredores miembros.
- **Alcance más allá de este spec:** esto es un estado nuevo a nivel **equipo** (no de membership individual como `SUBSCRIPTION_STATUSES`), disparado por el tier del entrenador — toca `store/team-store.js`, `teams-list-screen.jsx`, `team-detail-screen.jsx`, más allá de `tier-upgrade-screen.jsx`. Necesita del backend: un criterio de detección (miembros actuales vs. límite del tier vigente del entrenador) expuesto como un campo/estado del equipo, no algo que el frontend calcule localmente comparando `TEAM_MEMBER_LIMITS` contra el conteo de miembros (mismo criterio del resto del proyecto: el backend es la fuente de verdad de estos estados).

## Testing

- `services/payments.js` + `services/__mocks__/payments-mock.js`: cobertura Jest completa (creación de preferencia, pago exitoso, pago rechazado, mismatch de mock).
- Sin tests de render — ni del Brick ni de `tier-upgrade-screen.jsx` — verificación manual en preview web (Brick inline) y en device/emulador Android (flujo `WebView` completo), consistente con la convención del proyecto.
- El flujo de `postMessage`/inyección de `localStorage` en el `WebView` **no es verificable en el preview web** (`react-native-web` no simula un `WebView` real) — queda como verificación manual obligatoria en Android/iOS antes de mergear ese tramo.

## Preguntas que siguen abiertas (dependen del backend real)

- Formato exacto de `formData`/respuesta que espera `POST /api/v1/payments` — el documento de propuesta lo describe, pero puede cambiar al implementarse de verdad.
- Si el rechazo de pago llega como `200` con `status: rejected` en el body (lo más probable, según el documento) o si algún caso cae como error HTTP — afecta si `createPayment` necesita `skipAuthRefresh` como `changePassword`/`activateTrainerRole`, o si el manejo de rechazo es puramente de datos, sin tocar el interceptor de 401.
- Si `platform_settings`/precio de cada tier viene expresado en la misma llamada `GET /api/v1/tiers`, o si hace falta una segunda consulta.
- Si `GET /api/v1/payments/:id` (y la respuesta de `POST /api/v1/payments`) expone `status_detail` tal cual lo devuelve Mercado Pago, no solo `status` — sin eso, el frontend no puede diferenciar "rechazado por fondos insuficientes" de "rechazado por dato mal cargado" para mostrar un mensaje específico al usuario en vez de un error genérico. Ver `docs/BACKEND_PAYMENTS_REQUIREMENTS.md`.
- Fecha de vencimiento/próxima renovación por tier — no existe hoy ningún campo así en `/auth/permissions`, imprescindible para la sección "Vencimiento y renovación del tier" de arriba.
- Duración del plazo de gracia antes de la baja automática a `base` — valor de negocio sin definir, mismo tipo de dato que el porcentaje de comisión de B.

## Fuera de alcance de este spec

- Sub-proyecto B (split/marketplace, OAuth `mp-connect` del entrenador) — spec propio cuando se decida arrancar, reutilizando `checkout-brick.jsx` y el mecanismo de `WebView`+`postMessage` ya definidos acá.
- Cualquier pantalla de administración de `marketplace_fee`/porcentaje — según el documento de propuesta backend, es 100% configuración de owner vía backoffice, sin UI en este repo.
- **Downgrade de tier** — decisión explícita (ver "Flujo de UX"), no se contempla en esta iteración.
- Cancelación de una preferencia creada pero nunca pagada (usuario cierra el modal/navega afuera sin pagar) — no requiere ninguna acción del frontend: la preferencia queda simplemente sin usar del lado de Mercado Pago, no genera cobro ni efecto colateral.
