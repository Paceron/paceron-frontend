# Split marketplace corredor-entrenador (Sub-proyecto B) — Decisiones y lineamientos

> A diferencia del spec de [Sub-proyecto A](./2026-08-12-subscription-tier-checkout-design.md), este documento **no es un spec paso a paso** — es un mapa de decisiones y lineamientos, pensado como material de discusión con el equipo (backend, producto, y donde corresponda, alguien que pueda opinar sobre implicancias legales/regulatorias de retener y redistribuir dinero de terceros). Varias decisiones acá dependen de definiciones de negocio que no le corresponden al frontend, y se marcan explícitamente como tales.

## Contexto y alcance

Cubre el Caso 2 del [análisis de viabilidad](./2026-08-11-payments-integration-feasibility-analysis.md): el corredor paga al entrenador por pertenecer a su equipo/recibir entrenamiento, con Paceron reteniendo una comisión (`marketplace_fee`). A diferencia de Sub-proyecto A (pago único, un solo vendedor), acá aparecen tres elementos nuevos que A no tiene: **un tercero cobrando** (el entrenador, no Paceron), **una relación de negocio recurrente** (membership de equipo, no una compra puntual), y **estados de mora** (`SUBSCRIPTION_STATUSES` ya existe en `store/team-store.js`, hoy cosmético).

## El fork arquitectónico central: recurrencia vs. split, no se combinan nativo en MP

Verificado contra la documentación oficial de Mercado Pago (no es una suposición): el split (`marketplace_fee`/`application_fee`) es una capacidad de los **pagos puntuales** (Checkout API/Pro/Bricks — familia "Split Payments"). El cobro **recurrente automático** (tarjeta guardada, se cobra solo) es un producto distinto, **Suscripciones** (`/preapproval`) — el body completo de creación de una suscripción no tiene ningún campo de comisión/split. No hay una única llamada a MP que dé "cobro automático mensual" + "reparto automático al entrenador" a la vez.

Esto obliga a elegir entre dos arquitecturas de fondo, con trade-offs distintos — **decisión pendiente, a discutir con el equipo**, ya que cambia el diseño de backend, no solo el de frontend:

### Camino 1 — Recurrencia gestionada por Paceron, split real de MP en cada cobro

Cada período (ej. mensual), se genera un pago puntual normal — el mismo mecanismo ya diseñado para Sub-proyecto A, con `marketplace_fee` en la preferencia. MP nunca sabe que es una suscripción; "recurrente" es un concepto que vive enteramente en el backend de Paceron (qué corresponde cobrar, cuándo, a quién). Morosidad = el backend detecta que pasó la ventana esperada sin un nuevo pago.

- **A favor:** reutiliza 100% el mecanismo ya diseñado y documentado para A (`checkout-brick.jsx`, `WebView`+`postMessage`, `services/payments.js`). Split funciona exactamente como ya está probado/documentado en el diseño backend original.
- **En contra:** salvo que el backend implemente re-cobro automático guardando el método de pago (tokenización de tarjeta reutilizable, más superficie de PCI/seguridad a manejar), el corredor probablemente tiene que confirmar/pagar cada período manualmente — no es "suscripción" en el sentido estricto que probablemente espera el usuario final.
- **Requiere `mp-connect`** (OAuth del entrenador) tal como estaba previsto desde el documento backend original.

### Camino 2 — Suscripción real de MP a nombre de Paceron, payout al entrenador aparte

Se usa `/preapproval` de verdad: cobro automático sin reingreso de datos cada mes, pero el dinero completo entra a la cuenta de **Paceron** (el `access_token` que crea la suscripción es el propio de Paceron, no hay forma documentada de dirigir el cobro recurrente a una cuenta de tercero vía OAuth). La comisión no se resuelve vía MP — se resuelve **internamente**: Paceron le paga al entrenador su parte en un proceso propio (liquidación periódica).

- **A favor:** cobro automático real (mejor experiencia para el corredor, no tiene que volver a pagar cada mes). Reutiliza **`bank_alias`**, un campo que ya existe en este repo específicamente para que el entrenador reciba transferencias de Paceron — encaja naturalmente con este modelo.
- **En contra:** convierte a Paceron en quien retiene y redistribuye dinero de terceros — job de liquidación nuevo en el backend (no es "un pago más", es un proceso de reparto periódico), y probablemente amerita una revisión legal/regulatoria (custodia de fondos de terceros) que **no corresponde decidir desde el frontend**. No requiere `mp-connect` en absoluto — Paceron es el único merchant ante MP en este camino.
- **Dato de UI importante** (verificado): la pantalla de autorización de una suscripción de MP (`init_point` con forma `mercadopago.com/subscriptions/checkout?preapproval_id=...`) es, igual que Checkout Pro, una página **hosteada por MP, no embebible** — no existe una versión "Brick" de Suscripciones. Esto significa que en Camino 2 el checkout **no puede reusar** el mecanismo de `WebView` + página propia que definimos para A — sería una redirección externa en las dos plataformas (web y nativo por igual), más parecido a lo que descartamos para A por no ser "de marca Paceron". Curiosamente, esto hace que Camino 2 sea *más* homogéneo entre web y nativo en cuanto a quién controla la pantalla (ambos redirigen a MP), aunque menos "propio" que el Brick embebido de A/Camino 1.

## Qué es compartido con Sub-proyecto A (solo si se elige Camino 1)

Si el equipo confirma Camino 1, la infraestructura de A se extiende directamente, sin rediseño:

- `checkout-brick.jsx`, la ruta `/checkout`, el mecanismo `WebView`+`postMessage`+inyección de sesión: se reutilizan tal cual, solo cambia el `access_token` server-side que usa el backend al crear la preferencia (el del entrenador conectado, no el de Paceron) y que la preferencia lleve `marketplace_fee`.
- `services/payments.js` se extiende (no se duplica): `createPreference` ya necesitaría aceptar a qué entrenador/equipo corresponde el pago, además del tier.

Si el equipo confirma Camino 2, esto **no aplica** — la UI de checkout de B sería nueva (una pantalla que dispara la redirección a la suscripción de MP), no una extensión de A.

## `mp-connect` — vinculación OAuth del entrenador (solo Camino 1)

Mismo patrón de redirección que MP documenta oficialmente para Expo (`WebBrowser.openAuthSessionAsync` + deep link) — el mismo mecanismo que descartamos para el checkout de A por no ser "de marca Paceron" **sí aplica bien acá**, porque el propósito de esta pantalla no es simular ser parte del checkout de Paceron: es explícitamente autorizar una cuenta externa, el usuario ya espera ver la marca de MP en ese paso (es conceptualmente idéntico a "Conectar con Google").

**Ubicación sugerida:** junto a `bank_alias`, en el flujo del entrenador (`activate-trainer-screen.jsx` o una sección nueva dentro de `edit-profile-screen.jsx`) — mismo dominio conceptual ("cómo cobra el entrenador"), aunque son mecanismos distintos (alias manual vs. cuenta MP vinculada). Vale la pena decidir explícitamente si conviven ambos campos o si `mp-connect` reemplaza a `bank_alias` una vez integrado — **decisión de producto pendiente**.

## Control de pagos — pendiente / realizado / morosidad

El frontend ya tiene el modelo de estados (`SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba']`, `store/team-store.js:31`), hoy cosmético — `subscriptionStatus` siempre llega `null` de la API real. Lineamientos, independientes del camino elegido:

- **Los estados los define el backend, no el frontend** — igual que el resto del proyecto (el frontend nunca infiere `vencido`/`activo` por su cuenta comparando fechas localmente; sería divergir de la fuente de verdad si el backend cambia una regla de gracia, día de corte, etc.).
- **Dónde se muestra:** `team-detail-screen.jsx` ya tiene el hook de roster (`hooks/use-team-roster.js`) y los tags `SUBSCRIPTION_META` montados — es el lugar natural para mostrar el estado real una vez que el backend lo complete, sin pantalla nueva.
- **Qué pasa en el frontend cuando un corredor está `vencido`** — no hay una respuesta obviamente correcta, es decisión de producto. Alternativas con distinto costo de UX a proponer al equipo: (a) sin restricción visible para el corredor, solo visible para el entrenador en su roster; (b) banner de aviso para el corredor sin bloquear nada; (c) bloqueo de funcionalidades del equipo hasta regularizar. Cuanto más severa la consecuencia, más importa que el estado sea confiable (no falsos positivos) antes de exponerlo.
- **`en_prueba`** ya está en el enum pero no se discutió todavía si el producto ofrece período de prueba antes del primer cobro al unirse a un equipo — **pregunta abierta de producto**, afecta si hace falta lógica de "cuenta regresiva hasta el primer cobro" en el frontend.

## Transparencia de la comisión para el corredor

En Camino 1, el `marketplace_fee` es un valor real que viaja en la preferencia — técnicamente disponible para mostrarlo antes de pagar ("de tu pago, $X va a tu entrenador, $Y a Paceron"). En Camino 2, el corredor le paga a Paceron directamente — la comisión es interna, no hay nada nativo de MP que mostrar en ese momento del pago. Sugerido: mostrar igual el desglose en la UI (aunque en Camino 2 sea un cálculo propio, no un campo que devuelve MP), por transparencia con el corredor — pero es una decisión de producto, no puramente técnica.

## Testing

Mismo patrón que A: `services/payments.js` (extendido) + mocks + Jest, sin tests de render. La verificación manual de `mp-connect` (Camino 1) necesita una cuenta de prueba con rol vendedor en el panel de Mercado Pago (ya documentado en el material backend original) — no es simulable con `EXPO_PUBLIC_USE_MOCKS` para el tramo de OAuth en sí, solo para lo que pasa después en el frontend.

## Checklist para discutir con el equipo

1. **Camino 1 vs. Camino 2** — la decisión central de este documento. Cambia el diseño de backend, no solo el de frontend.
2. Si Camino 2: ¿quién revisa las implicancias legales/regulatorias de que Paceron retenga y redistribuya dinero de terceros?
3. Si Camino 1: ¿el re-cobro periódico es manual (el corredor vuelve a pagar cada mes) o el backend guarda el método de pago y re-dispara automáticamente? Afecta directamente la experiencia que se le puede prometer al corredor.
4. `mp-connect` y `bank_alias`: ¿conviven o el segundo queda obsoleto una vez que el primero esté integrado?
5. ¿Existe período de prueba (`en_prueba`) antes del primer cobro al unirse a un equipo?
6. Consecuencia frontend de estar `vencido` — sin restricción, aviso, o bloqueo de funcionalidades.
7. ¿Se muestra el desglose de comisión al corredor antes de pagar, o queda opaco?
