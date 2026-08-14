# Requerimientos de backend — integración de pagos (Mercado Pago)

Doc de coordinación, mismo espíritu que [`BACKEND_API_GAPS.md`](./BACKEND_API_GAPS.md) pero para el dominio de pagos: a diferencia de ese doc (gaps encontrados integrando contra un backend que ya existe parcialmente), acá **no hay nada implementado del lado backend todavía** — solo el documento de propuesta original y el análisis de viabilidad frontend. Esto es un pedido/contrato para coordinar el arranque del trabajo, no un hallazgo posterior. Se actualiza a medida que el backend confirme, implemente o ajuste cada punto (mismo criterio de mantenimiento que `BACKEND_API_GAPS.md`).

**Contexto completo:** [análisis de viabilidad](./superpowers/specs/2026-08-11-payments-integration-feasibility-analysis.md) · [spec Sub-proyecto A](./superpowers/specs/2026-08-12-subscription-tier-checkout-design.md) · [decisiones Sub-proyecto B](./superpowers/specs/2026-08-12-trainer-split-payments-decisions.md).

## Sub-proyecto A (checkout de tier) — requerido para poder arrancar frontend

| Necesidad | Detalle | Por qué |
|---|---|---|
| `GET /api/v1/tiers` | Catálogo de tiers con precio/moneda, **filtrable/segmentado por rol** (corredor vs. entrenador) | `tier-upgrade-screen.jsx` necesita reemplazar el hardcode "Próximamente" por datos reales. Se asume que un tier premium de corredor y uno de entrenador desbloquean cosas distintas — a confirmar si el mismo endpoint acepta un parámetro de rol o si son catálogos separados |
| `POST /api/v1/payments/preference` | Según documento de propuesta: `{ preference_id, public_key }` | Primer paso del checkout, ya spec-eado en el diseño backend original |
| `POST /api/v1/payments` | Recibe `formData` del Brick + `preference_id` | Segundo paso, dispara el cobro |
| `GET /api/v1/payments/:id` | Estado del pago | Refresh en background post-pago, fuente de verdad final |
| **`status_detail` expuesto tal cual lo devuelve MP** (no solo `status`) en `POST /api/v1/payments` y `GET /api/v1/payments/:id` | Ej. `cc_rejected_insufficient_amount`, `cc_rejected_bad_filled_card_number`, etc. | Sin esto el frontend solo puede mostrar "rechazado" genérico, no un mensaje específico y accionable para el usuario (recién detectado en el spec de A, no estaba en el documento de propuesta original) |
| Confirmar: ¿el rechazo de pago llega como `200` con `status: rejected` en el body, o como error HTTP? | — | Determina si `services/payments.js#createPayment` necesita `skipAuthRefresh: true` (patrón ya usado en `changePassword`/`activateTrainerRole` para 401 de negocio) o si el manejo es puramente de datos |
| Confirmar: ¿el precio de cada tier viaja en la misma respuesta de `GET /api/v1/tiers`, o hace falta una segunda consulta (`platform_settings`)? | — | Afecta si `getTiers()` alcanza con una sola llamada |
| Fecha de vencimiento/próxima renovación por tier y por rol | No existe hoy ningún campo así (`/auth/permissions` solo expone `tier: 'base'|'premium'`, sin fecha) | El tier **no es una compra única** — es mensual con pago manual, igual que B (confirmado por el usuario). Sin fecha de vencimiento, el frontend no puede mostrar "vence en 3 días" ni el estado de renovación |
| Job programado de baja automática a `base` si no se renueva dentro del plazo de gracia | Backend, sin contraparte de endpoint — el frontend solo necesita ver reflejado el resultado (`tier: 'base'`) | Mismo tipo de mecanismo que la expulsión automática de equipo en B |
| Duración del plazo de gracia antes de la baja automática | Valor de negocio sin definir | Mismo tipo de dato que comisión/precio mínimo de B — existe, no está decidido |
| **Estado "equipo congelado"** expuesto por equipo (no por membership individual) | Resuelto: cuando el entrenador baja de tier y el equipo excede el nuevo límite de miembros (`TEAM_MEMBER_LIMITS`, `store/team-store.js`), el equipo queda bloqueado — sin plazo, hasta que el entrenador recupere el tier o reduzca miembros. No se expulsa a nadie automáticamente | El frontend no debe calcular esto localmente comparando conteo de miembros contra `TEAM_MEMBER_LIMITS` — necesita un campo/estado expuesto por el backend, mismo criterio que el resto de estados del proyecto. Afecta `teams-list-screen.jsx` (indicador visual) y `team-detail-screen.jsx` (bloqueo al entrar), no solo `tier-upgrade-screen.jsx` |

## Sub-proyecto B (split corredor-entrenador) — arquitectura resuelta, quedan valores por decidir

**Ya no está bloqueado por una decisión de arquitectura** — el fork documentado en versiones anteriores de [decisiones Sub-proyecto B](./superpowers/specs/2026-08-12-trainer-split-payments-decisions.md) quedó resuelto: como el producto **no contempla débito automático** (confirmado por el usuario), se descarta el camino de suscripción real de MP (`/preapproval`) y se confirma "recurrencia simulada por Paceron con split real por cobro" — reutiliza directamente los endpoints de A (`/payments/preference`, `/payments`, `/payments/:id`) con `marketplace_fee` y el `access_token` del entrenador conectado vía `mp-connect`, más lo siguiente:

| Necesidad | Detalle | Por qué |
|---|---|---|
| `mp-connect`: `GET /api/v1/mercadopago/connect`, `GET /api/v1/mercadopago/connect/callback`, `GET /api/v1/mercadopago/connect/status` | Ya descriptos en el documento de propuesta backend original. Convive con `bank_alias` existente, no lo reemplaza | Vinculación OAuth del entrenador, condición previa para poder crear cualquier preferencia con split |
| Estado real de membership en el roster | `subscriptionStatus` en la respuesta de `GET /teams/{id}/users` (u equivalente) — hoy siempre `null` | `store/team-store.js` ya tiene el enum `SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba']` esperando datos reales, y `hooks/use-team-roster.js:64` ya lo hardcodea en `null` a falta de esto — **este ítem ya era un hueco conocido antes de este análisis de pagos**, no es nuevo |
| Fecha de vencimiento/próxima renovación por membership de equipo | No existe hoy | Necesaria para mostrar "vence en 3 días" y el banner de aviso durante el plazo de gracia |
| Job programado de expulsión automática si no se renueva dentro del plazo de gracia | Reutiliza la misma acción de dominio que la expulsión manual ya existente (`RunnerActionsMenu`) | Confirmado: pago manual, válido 1 mes, plazo de gracia, expulsión automática si no se renueva |
| Campo de **precio de mensualidad por equipo**, configurable por el entrenador al crear/editar (`POST`/`PUT /teams`) | Nuevo campo en el payload existente de crear/editar equipo, no un endpoint aparte | Confirmado: lo fija el entrenador por equipo, no un valor único de plataforma |
| Campo de **período de prueba por equipo** (`No`/`1`/`2`/`4` semanas), mismo payload que el precio | Nuevo campo, mismo lugar que el anterior | Confirmado: determina cuándo empieza a exigirse el pago para un corredor nuevo |
| **Precio mínimo de mensualidad vigente**, consultable (ej. incluido en `GET /api/v1/tiers` o `platform_settings`, o endpoint dedicado) | El entrenador fija el precio, pero no puede ser menor a este mínimo — motivo explícito confirmado: evitar que el entrenador cobre por fuera en efectivo para eludir la comisión | Frontend necesita **mostrárselo al entrenador** al configurar el precio (no solo rechazar después), y validar contra él antes de guardar |
| Endpoint/dato de **historial de cobros con desglose neto/comisión, por entrenador** | No existe hoy | Confirmado: el desglose de comisión lo ve el entrenador (no el corredor) — nueva superficie de UI (vista de historial/resumen de cobros), sin definir ubicación ni nivel de detalle todavía |
| Valores numéricos sin definir: % de comisión, precio mínimo, duración del plazo de gracia | Existen como mecanismo, no como valor — confirmado por el usuario | Necesarios antes de poder implementar validaciones/mensajes concretos en frontend |
| ¿Un corredor puede pagar a varios entrenadores a la vez? | Ya soportado a nivel de membership de equipo (multi-equipo) | Si sí, el cobro necesita identificarse por `teamId` además de por usuario, no solo por `tierId`/usuario como en A |

## Env vars nuevas del lado frontend (para que backend sepa qué credenciales exponer)

| Variable | Valor | Uso |
|---|---|---|
| `EXPO_PUBLIC_MP_PUBLIC_KEY` | Public key de Mercado Pago (segura de exponer client-side) | Inicializa `@mercadopago/sdk-react` — solo se usa en el bundle web (ver spec de A) |
| `EXPO_PUBLIC_WEB_APP_URL` | URL del despliegue web (`https://paceron-frontend.vercel.app` por default) | El `WebView` nativo la usa para cargar la ruta `/checkout` |

Ninguna de las dos reemplaza nada de lo que el documento de propuesta backend ya define de su lado (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, etc. — esas quedan 100% server-side, no hay solapamiento).

## Orden sugerido de coordinación

1. **Backend puede arrancar Sub-proyecto A ya** — es lo más spec-eado y menos ambiguo de los dos, el documento de propuesta original ya lo cubre casi por completo (salvo `status_detail`, vencimiento/renovación de tier y "equipo congelado", marcados arriba).
2. **Sub-proyecto B puede arrancar en paralelo, no está bloqueado por arquitectura ni por la mayoría de las decisiones de UX** — quedaron resueltas en esta ronda. Lo único genuinamente pendiente son los tres valores numéricos (comisión, precio mínimo, plazo de gracia).
