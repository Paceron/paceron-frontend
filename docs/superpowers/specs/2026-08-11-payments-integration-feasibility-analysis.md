# Análisis de viabilidad — Integración de pagos (Mercado Pago Checkout Bricks)

> **Naturaleza de este documento:** no es un plan de implementación — todavía no se decidió desarrollar nada. Es un análisis de viabilidad técnica + definiciones propuestas para el lado frontend, a partir de un documento de diseño ya elaborado del lado backend (Go/Gin, otro repo) y del estado real de `paceron-frontend` hoy. Es un documento **vivo**: a medida que se recorra el ciclo de decisiones (pros/contras, contextos, escenarios) previo a un spec formal, las conclusiones se van sumando acá o en un doc asociado bajo esta misma carpeta.
>
> **Punto de entrada de toda la investigación de pagos.** Documentos asociados: [spec Sub-proyecto A](./2026-08-12-subscription-tier-checkout-design.md) (checkout de tier, ya resuelto) · [decisiones Sub-proyecto B](./2026-08-12-trainer-split-payments-decisions.md) (split corredor-entrenador, decisión de arquitectura pendiente con el equipo) · [`BACKEND_PAYMENTS_REQUIREMENTS.md`](../../BACKEND_PAYMENTS_REQUIREMENTS.md) (contrato consolidado para coordinar con backend).

## Contexto

El documento de diseño backend (elaborado por/para el equipo Go/Gin) cubre la integración de Mercado Pago **Checkout Bricks**: creación de preferencia, procesamiento del pago, webhook de conciliación, modelo de datos (`payments`), y el modelo de split/marketplace para pagos con comisión. El documento **ya contempla, desde el modelo de datos inicial, dos flujos de negocio distintos** vía el campo `concept`:

| `concept` | Quién cobra | Quién paga | Corresponde a |
|---|---|---|---|
| `order` | Paceron | Usuario | (ejemplo genérico de compra, no usado hoy) |
| `subscription` | Paceron | Usuario | **Caso 1**: pago de suscripción / incremento de tier (corredor o entrenador) |
| `session` (con split) | Entrenador (Paceron retiene comisión vía `marketplace_fee`) | Usuario (corredor) | **Caso 2**: corredor paga a su entrenador por pertenecer al equipo / recibir servicios de entrenamiento |

Esto confirma que el modelo de datos y el diseño backend ya están pensados para ambos casos de uso — no hay que inventar un tercer concepto, hay que mapear frontend contra estos dos flujos ya definidos.

**Dato crítico del propio documento backend, ya señalado como pregunta abierta para "Tareas frontend":**

> "Payment Brick es un componente **web** (HTML/JS). En este repo el frontend es Expo/React Native + React Native Web, así que Bricks renderiza correctamente en la versión web de la app. Para la app nativa (iOS/Android) Bricks no aplica directamente: habría que evaluar Checkout Pro mobile (redirección) o un WebView con la versión web."

Este es el punto central de todo el análisis de viabilidad frontend: **web y nativo necesitan arquitecturas de checkout distintas**, no es un componente único portable a ambas plataformas.

## Estado actual del repo — qué existe y qué es terreno greenfield

### Ya existe (aprovechable)

- **`roles[].tier`** (`store/auth-store.js`): campo real, viene del backend vía `/auth/permissions`, valores `'base'` / `'premium'`. Consumido hoy en `store/team-store.js` (`TEAM_MEMBER_LIMITS`), `components/profile/role-switch-toggle.jsx` (badge de tier), `create-team-screen.jsx`/`edit-team-screen.jsx`.
- **Pantalla placeholder ya montada**: `app/(tabs)/profile/tier-upgrade.jsx` → `components/profile/tier-upgrade-screen.jsx`. Hoy muestra el tier actual y una pill estática "Próximamente" — **cero lógica de pago**, pero es el punto de entrada natural ya reservado en la navegación para el Caso 1.
- **Backend ya tiene, sin consumir desde frontend**: `GET /api/v1/tiers` (catálogo de tiers) y `tier_id` en el endpoint de asignación de rol (`services/roles.js:32-41`, `assignRole` omite `tier_id` a propósito hoy — usa el tier "base" por default del backend).
- **`bank_alias`** (`services/roles.js` / `activate-trainer-screen.jsx`): flujo de alias de pago ya real contra backend, pero es la dirección **opuesta** a un cobro — es para que el entrenador **reciba** transferencias, no para que se le cobre a nadie. Referencia arquitectónica útil (mismo dominio conceptual: "el entrenador tiene datos de cobro"), pero no reutilizable como código.
- **`SUBSCRIPTION_STATUSES`** (`store/team-store.js:31`, `'activo'|'vencido'|'en_prueba'`): son tags cosméticos para mostrar el estado de membership de un corredor en un equipo — hoy `subscriptionStatus` siempre es `null` desde la API real (`hooks/use-team-roster.js:64`). Es la UI que ya anticipa el Caso 2, sin backend ni lógica de pago detrás todavía.
- **Patrón de servicio + manejo de error 401 de negocio**: `services/roles.js` (`activateTrainerRole`) y `services/user.js` (`changePassword`) establecen el patrón exacto a seguir: `api.patch/post(path, body, { skipAuthRefresh: true })` cuando un 401 significa "credencial de negocio inválida", no "sesión vencida". Un pago rechazado por Mercado Pago casi seguro cae en esta misma categoría conceptual (aunque probablemente el rechazo llegue como 200 con `status: rejected` en el body, no como 401 — a confirmar contra el contrato real del backend cuando exista).
- **Patrón de pantalla con submit + loading + Toast**: `ChangePasswordSection` en `components/profile/edit-profile-screen.jsx:425-535` es la plantilla más reciente y más cercana a lo que necesitaría un checkout: estado propio, `setLoading`/`try/catch/finally`, `Toast.show` de éxito/error, botón con `ActivityIndicator`.
- **`SectionCard`** (`components/forms/section-card.jsx`) y **`Row`/`Col`** (`components/forms/fields.jsx`): wrappers temáticos y de layout responsive ya establecidos, reutilizables para envolver el Brick con el chrome visual del resto de la app.
- **`isWeb`/`isMobile`** (`utils/platform.js`) + precedente de split por archivo (`app/(tabs)/index.jsx` vs `index.web.jsx`, único caso hoy en el repo): mecanismo ya validado para bifurcar comportamiento nativo/web a nivel de archivo, no solo de rama en runtime.
- **`scheme` de deep link ya configurado** (`app.config.js`): `paceron-dev` / `paceron`, diferenciado por variante — no hay que dar de alta un scheme nuevo para soportar un flujo de redirección con vuelta a la app.
- **Convención `.env.example` + `config/env.js`**: agregar una env var pública nueva (ej. `EXPO_PUBLIC_MP_PUBLIC_KEY`) es mecánico y ya tiene patrón claro.

### Greenfield total (nada existe hoy)

- Cualquier código de integración con Mercado Pago, Stripe o cualquier pasarela de pago — **cero referencias en todo el repo**.
- `react-native-webview`: no instalado (ni siquiera como dependencia resuelta — solo aparece como peer-dependency opcional de otro paquete en el lockfile, sin materializarse en `node_modules`).
- `expo-web-browser`, `expo-auth-session`: no instalados.
- Cualquier uso de `Linking` (API de React Native) o de un flujo de redirección OAuth-like: **cero precedente en el repo**. Esto importa porque tanto el Caso 2 (split, vía `mp-connect` OAuth para el entrenador) como el pago nativo mobile (Checkout Pro por redirección) necesitan exactamente este patrón, y hoy no existe ninguna base de la que partir.
- `services/payments.js`, cualquier store o hook de pagos: no existen.
- Contrato de API específico del lado frontend para pagos: el documento backend describe el diseño, pero no hay swagger/gap doc todavía documentando esto como disponible para consumir desde este repo (a diferencia de Teams, que sí pasó por ese proceso de confirmación antes de integrarse).

## Viabilidad — Web (React Native Web)

**Viable, con una decisión de arquitectura de componente a tomar, no de librería.**

Checkout Bricks tiene SDK oficial de React: `@mercadopago/sdk-react`, que expone componentes React DOM (`Payment`, `StatusScreen`, `Wallet`, `CardPayment`, `Brand`) + `initMercadoPago(publicKey)`. Como este repo corre sobre React Native Web, en la plataforma web el renderer real es `ReactDOM` (no hay nada nativo debajo) — un árbol de componentes React DOM de un paquete de terceros puede montarse dentro de una app RNW sin conflicto de renderer, siempre que quede aislado de la plataforma nativa.

Puntos a resolver, no bloqueantes:

1. **Aislar el import a nivel de archivo, no solo de rama `isWeb`.** El único precedente hoy en el repo (`index.jsx`/`index.web.jsx`) es a nivel de ruta completa. Para el Brick conviene extender ese mismo patrón a nivel de componente (`checkout-brick.jsx` / `checkout-brick.web.jsx`) en lugar de un `if (isWeb)` en runtime dentro del mismo archivo (como hace `SelectField` en `fields.jsx`) — así Metro nunca intenta resolver `@mercadopago/sdk-react` para el bundle nativo, evitando que un paquete que asume `window`/`document` rompa el bundling nativo aunque la rama nunca se ejecute ahí en runtime.
2. **Theming del Brick vs. `STYLE_CONTRACT.md`.** El Brick controla su propio contenido interno (Mercado Pago expone una API de `customization`/theme propia para colores y radios, separada de Tailwind/NativeWind) — no se puede aplicar `nativeID`/clases NativeWind adentro del Brick. La integración visual realista es: envolver el Brick en un `SectionCard` (chrome consistente con el resto de la app) y configurar el theme nativo del Brick por separado para que combine razonablemente, sin buscar paridad pixel-perfect.
3. **`web.output: 'static'` (Expo static export).** El Brick se carga client-side (inyecta su propio script), montado dentro de un `useEffect` — no hay problema de SSR/hidratación real porque no depende de contenido pre-renderizado en el HTML estático, es un widget que se monta después del mount de React como cualquier otro.
4. **Regla obligatoria de `nativeID`/`testID`** (CLAUDE.md) aplica al wrapper (`SectionCard`, botones, textos propios), no al contenido interno del Brick — el Brick no es un componente RN de este árbol, cae bajo la excepción de contenido de terceros.

## Viabilidad — Nativo (iOS/Android vía Expo)

**No viable usar el Brick directamente — requiere una de las dos alternativas que el propio documento backend ya nombra.** Evaluación de cada una contra el estado real del repo:

### Opción A — Checkout Pro mobile (redirección externa) — recomendada como punto de partida

Flujo: se abre el `init_point` (URL de checkout hosteada por Mercado Pago) devuelto por la misma preferencia que ya crea el backend para Bricks — **no hace falta un endpoint backend distinto**, Checkout Pro y Bricks comparten el mismo objeto de preferencia. En Expo, el mecanismo estándar para esto es `expo-web-browser` con `openAuthSessionAsync(url, redirectUri)` — abre un navegador in-app (`SFSafariViewController` en iOS / Chrome Custom Tabs en Android) y devuelve el control a la app cuando el navegador redirige a la `redirectUri` (usando el `scheme` ya configurado, ej. `paceron://payment-result`).

- **Costo de dependencia:** una sola librería nueva (`expo-web-browser`), sin config plugin, sin ningún cambio en `app.config.js` más allá de lo que ya existe. Es parte del set de módulos que trae Expo Go por default, así que se puede probar en desarrollo sin un dev build custom (a confirmar al momento de implementar, pero es el comportamiento típico de este paquete).
- **Costo de rebuild:** al ser un módulo nativo nuevo (aunque mínimo), requiere un build nuevo vía EAS antes de poder probarlo en dispositivo/build de producción — no alcanza con una OTA update de solo JS (mismo criterio que ya aplica el proyecto para cualquier dependencia nativa nueva, documentado en `docs/WORKFLOW.md`).
- **Sinergia arquitectónica importante:** el documento backend describe el flujo `mp-connect` (OAuth del entrenador para habilitar split) con la misma forma exacta — redirigir afuera, autorizar, volver con un `code` vía `redirect_uri`. Resolver el patrón de "salir con `WebBrowser`, volver por deep link, capturar el resultado" para el pago nativo del Caso 1 deja resuelto el mismo problema estructural que va a hacer falta para el Caso 2 (vinculación OAuth del entrenador), aun cuando esa vinculación sea un flujo de autorización y no de pago.
- **Contra:** el usuario sale visualmente de la app (aunque sea un navegador embebido, no es tan "in-app" como el Brick embebido en web) — probablemente perceptible como una experiencia distinta entre plataformas, algo a validar con el usuario/diseño si eso es aceptable, no solo una decisión técnica.

### Opción B — WebView con la versión web del checkout

Flujo: `react-native-webview` cargando la ruta web propia del checkout (la misma pantalla que ya renderiza el Brick en la versión web de esta misma app) dentro de un `WebView` embebido, o directamente apuntando al `init_point` de Mercado Pago.

- **Costo de dependencia:** requiere agregar `react-native-webview` (no instalado, ni siquiera resuelto en el lockfile hoy) — rebuild vía EAS también necesario.
- **Costo de lógica adicional:** hay que escuchar cambios de navegación del `WebView` (`onNavigationStateChange`) para detectar cuándo el pago terminó (llegada a la URL de resultado) — más código propio que la Opción A, que delega esa detección al sistema operativo vía deep link.
- **A favor:** experiencia más "dentro de la app" (no abre un navegador separado), y si se apunta a la propia ruta web de este repo, se reutiliza el mismo componente Brick ya construido para web en vez de duplicar UI de checkout — un único punto de mantenimiento visual para el formulario de pago en sí.
- **Sin precedente en el repo** — sería la primera vez que se usa un `WebView` en todo el proyecto.

### Opción C — SDK nativo de Mercado Pago (no mencionada en el documento backend, incluida para completar el panorama)

Mercado Pago ofrece SDKs nativos (Android/iOS) con checkout nativo real (no HTML). Fuera de alcance real para este proyecto salvo que el equipo esté dispuesto a salir del workflow managed de Expo (requeriría un módulo nativo custom o un plugin de Expo community, con mantenimiento propio) — no se recomienda evaluarlo más a fondo a menos que las opciones A/B resulten insuficientes en la práctica.

**Recomendación:** arrancar con la Opción A (Checkout Pro + `expo-web-browser`) por menor costo de dependencias, reutilización directa del mismo `preference_id`/`init_point` que ya genera el backend para web, y por resolver de paso el patrón de redirección que también hace falta para `mp-connect`. Dejar la Opción B como mejora posterior si la experiencia de "salir de la app" resulta un problema real medido con usuarios, no una hipótesis de partida.

## Definiciones propuestas (arquitectura frontend, sin implementar todavía)

Mapeado 1:1 contra las convenciones ya establecidas en `CLAUDE.md` y los patrones reales encontrados en el repo:

- **`services/payments.js`** (nuevo): siguiendo el patrón de `services/user.js`/`services/roles.js` — `createPreference(items, concept)`, `createPayment(formData, preferenceId)`, `getPayment(id)`. Mock correspondiente en `services/__mocks__/payments-mock.js` para `EXPO_PUBLIC_USE_MOCKS=true`, con tests en `__tests__/` (servicio + mock, no de render — consistente con la convención de testing del proyecto).
- **Estado: TanStack Query, no Zustand.** Por convención ya escrita en `CLAUDE.md` (estado de servidor → Query), y porque un pago es una operación de una sola vez más que un recurso cacheado — el ajuste natural es `useMutation` para crear preferencia/procesar pago, y opcionalmente `useQuery` con `refetchInterval` para el caso nativo, donde hay que consultar el estado del pago al volver del navegador externo (no hay webhook directo al cliente, hay que preguntarle al backend).
- **Componente Brick — split por archivo:** `components/payments/checkout-brick.web.jsx` (usa `@mercadopago/sdk-react`) + `components/payments/checkout-brick.jsx` (nativo: dispara Checkout Pro vía `expo-web-browser` en vez de renderizar nada embebido).
- **Dos puntos de entrada, no uno**, alineados a los dos conceptos del documento backend:
  - **Caso 1 (`subscription`, sin split):** reemplaza el placeholder de `components/profile/tier-upgrade-screen.jsx` — ya tiene la ruta, el auth-guard y el badge de tier actual montados, solo falta la lógica real de cobro.
  - **Caso 2 (`session`, con split):** entrada nueva, probablemente desde el flujo de equipo (`team-detail-screen.jsx` o un paso del onboarding del corredor a un equipo) — no hay ruta reservada hoy, hay que definirla cuando se llegue a esa etapa.
- **Nueva env var pública:** `EXPO_PUBLIC_MP_PUBLIC_KEY` en `config/env.js` + `.env.example`, siguiendo el patrón existente. La `public_key` es segura de exponer client-side (confirmado en el documento backend); el `access_token` nunca sale del backend.
- **Deep link de retorno:** una ruta nueva (primera de su tipo en el repo) que capture la vuelta del navegador externo en nativo, ej. `paceron://payment-result`, y en Expo Router probablemente una ruta dedicada bajo `app/` que lea los query params de retorno y dispare la consulta de estado final contra el backend.

## Decisión de alcance recomendada — dividir en dos sub-proyectos

Siguiendo el mismo criterio que ya se usó para Teams (etapas 1/2/3 documentadas en `CLAUDE.md`), y porque el propio documento backend separa claramente "pago simple" de "split — iteración 2":

1. **Sub-proyecto A — Pagos sin split (`order`/`subscription`).** Cubre el Caso 1 completo: checkout web (Brick) + checkout nativo (Checkout Pro/`expo-web-browser`) + wiring de `tier-upgrade-screen.jsx`. No requiere OAuth de nadie, un solo vendedor (Paceron). Es la base técnica (servicio, componente Brick, deep link de retorno) que el Sub-proyecto B reutiliza.
2. **Sub-proyecto B — Split/marketplace (`session`).** Cubre el Caso 2: pantalla de vinculación OAuth del entrenador (`mp-connect`), y el checkout del corredor con `marketplace: true` apuntando al `access_token` del entrenador. Depende de que A ya exista (mismo componente Brick, mismo patrón de redirección nativa, mismo `services/payments.js` extendido).

Esto es coherente con la guía de `CLAUDE.md` sobre cuándo usar spec/plan: ambos sub-proyectos son "features con flujo real, tocan 5+ archivos, con decisiones de diseño reales" → cada uno amerita su propio spec (`docs/superpowers/specs/`) y su propio plan cuando se decida arrancar, no un plan único gigante.

## Preguntas abiertas para cuando se decida avanzar

- ¿La experiencia nativa de "salir a un navegador externo" (Opción A) es aceptable para el producto, o vale la pena pagar el costo extra de WebView (Opción B) desde el arranque?
- ¿El contrato de backend para `POST /payments/preference` / `POST /payments` ya está disponible para consumir (swagger actualizado), o hace falta el mismo proceso de confirmación que se hizo para Teams antes de integrar?
- ¿Quién es dueño de decidir el `marketplace_fee`/porcentaje (el documento backend dice que es configuración de owner vía backoffice, tabla `platform_settings`) — el frontend necesita alguna pantalla de administración para esto, o es 100% backend/backoffice sin UI en este repo?
- Para el Caso 2, ¿el pago es un cobro recurrente (mensual, ligado a la membership del equipo) o un cobro puntual por sesión? El documento backend nombra `session` como concepto pero no define periodicidad — esto afecta si hace falta lógica de recordatorio/vencimiento en el frontend o si es 100% manual cada vez.

## Próximo paso

Este documento es el insumo de contexto para el ciclo de decisiones (pros/contras, contextos, escenarios) que arranca a continuación, previo a un spec formal (`brainstorming` → `writing-plans`) del Sub-proyecto A. Las conclusiones de ese ciclo se suman a este documento o a uno asociado en esta misma carpeta.
