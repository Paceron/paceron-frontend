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

## Sub-proyecto B (split corredor-entrenador) — bloqueado por una decisión de arquitectura

**No puede arrancar** hasta que el equipo resuelva el fork documentado en [decisiones Sub-proyecto B](./superpowers/specs/2026-08-12-trainer-split-payments-decisions.md): Mercado Pago no combina split (`marketplace_fee`) y cobro recurrente automático (`/preapproval`) en un solo mecanismo, así que hay que elegir entre "recurrencia simulada por Paceron con split real por cobro" (reutiliza A, necesita `mp-connect` OAuth) o "suscripción real de MP a nombre de Paceron + payout aparte al entrenador" (necesita un proceso de liquidación nuevo en backend, y probablemente revisión legal/regulatoria antes de comprometerse). Esa decisión define qué endpoints hacen falta — no tiene sentido pedir un contrato concreto todavía.

Lo que sí aplica **sin importar qué camino se elija**:

| Necesidad | Detalle | Por qué |
|---|---|---|
| Estado real de membership en el roster | `subscriptionStatus` en la respuesta de `GET /teams/{id}/users` (u equivalente) — hoy siempre `null` | `store/team-store.js` ya tiene el enum `SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba']` esperando datos reales, y `hooks/use-team-roster.js:64` ya lo hardcodea en `null` a falta de esto — **este ítem ya era un hueco conocido antes de este análisis de pagos**, no es nuevo |
| Semántica exacta de cada estado | ¿Quién decide el corte a `vencido`? ¿Hay período de gracia? ¿Qué dispara `en_prueba`? | El frontend no debe inferir estos criterios localmente — necesita que el backend sea la fuente de verdad explícita (mismo criterio que el resto del proyecto) |
| ¿Quién fija el precio base? | Cada entrenador individualmente, o un valor fijo de plataforma | No discutido hasta ahora en ningún doc — si es libre por entrenador, hace falta una pantalla de configuración de precio del lado del entrenador, no contemplada todavía |
| Efecto de expulsar/salir de un equipo sobre el cobro asociado | `RunnerActionsMenu` (expulsar, mover, salir) **ya existe y está en producción** hoy sin ningún efecto sobre pagos | Cuando B se implemente, esas acciones necesitan disparar la baja del cobro/suscripción asociado — inmediato o al cierre del período pagado, a definir |
| ¿Un corredor puede pagar a varios entrenadores a la vez? | Ya soportado a nivel de membership de equipo (multi-equipo) | Si sí, el cobro necesita identificarse por `teamId` además de por usuario, no solo por `tierId`/usuario como en A |

## Env vars nuevas del lado frontend (para que backend sepa qué credenciales exponer)

| Variable | Valor | Uso |
|---|---|---|
| `EXPO_PUBLIC_MP_PUBLIC_KEY` | Public key de Mercado Pago (segura de exponer client-side) | Inicializa `@mercadopago/sdk-react` — solo se usa en el bundle web (ver spec de A) |
| `EXPO_PUBLIC_WEB_APP_URL` | URL del despliegue web (`https://paceron-frontend.vercel.app` por default) | El `WebView` nativo la usa para cargar la ruta `/checkout` |

Ninguna de las dos reemplaza nada de lo que el documento de propuesta backend ya define de su lado (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, etc. — esas quedan 100% server-side, no hay solapamiento).

## Orden sugerido de coordinación

1. **Backend puede arrancar Sub-proyecto A ya** — es lo más spec-eado y menos ambiguo de los dos, el documento de propuesta original ya lo cubre casi por completo (salvo `status_detail`, marcado arriba).
2. **Sub-proyecto B espera la decisión de arquitectura** — no tiene sentido que backend arranque nada de split/`mp-connect` hasta que el equipo elija entre los dos caminos documentados. Buen momento para esa conversación: mientras A ya está en desarrollo.
