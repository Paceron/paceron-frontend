# Fase 1 de pagos — flujo real de cambio de tier — Design

**Fecha:** 2026-09-03
**Estado:** Aprobado, en desarrollo

## Contexto

Fase 0 (`docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md`)
dejó `tier-upgrade-screen.jsx` con un pill "Próximamente" a propósito —
no había backend de suscripciones todavía. El compañero de backend
entregó el caso de uso completo (`01-cambio-de-tier.md`, pegado en
chat) contra una rama sin mergear a `develop`
(`feature/suscripciones-tier-equipos`, corriendo local). **Contrato
verificado contra el swagger real de esa rama**
(`http://localhost:8080/swagger/doc.json`, 2026-09-03) — coincide
exactamente con el documento del compañero, sin sorpresas. Sigue siendo
provisorio: la rama puede cambiar antes de mergear a `develop`.

Reemplaza el placeholder "Próximamente" por el flujo real de upgrade de
tier (subir de un tier base/gratis a uno pago), reusando la plomería de
checkout de Fase 0 (`CheckoutFlow`, `services/payments.js`) tal cual —
lo nuevo es el dominio de suscripción con cuotas.

## Alcance de esta spec

**Nuevo:** `services/tier-subscriptions.js` (+ mock),
`hooks/use-tier-subscription.js`.

**Modificado:** `components/profile/tier-upgrade-screen.jsx`
(reescritura del flujo de compra, tiers list pasa de
`useState`/`useEffect` a `useQuery` de paso, mismo archivo),
`services/normalizers.js` (`toSubscriptionModel` nuevo,
`toCreatePreferencePayload`/`toProcessPaymentPayload` suman
`installmentId` opcional).

## Contrato de backend (verificado contra swagger real, rama sin mergear)

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/auth/permissions?user_id=` | ya usado hoy (`auth-store.js`) — `roles[].id` es el `role_id` que este flujo necesita, sin cambios de store. |
| GET | `/api/v1/tiers` | ya usado — sigue sin `hierarchy` (ver nota abajo). |
| PUT | `/api/v1/users/{id}/roles/{role_id}/tier` | body `{tier_id}` → `ChangeTierResponse` (`installment_id`, `installment_amount`, `installment_number`, `subscription_status`, `mercadopago.public_key`, `tier`, `role`). |
| GET | `/api/v1/users/{id}/subscriptions/current?role_id=` | mismo shape que `ChangeTierResponse` (`CurrentSubscriptionResponse`, idéntica). Tier gratis devuelve solo `tier`/`role`, sin cuota. |
| POST | `/api/v1/payments/preference` | ya usado — suma `installment_id` opcional (`CreatePreferenceRequest`, confirmado en swagger). |
| POST | `/api/v1/payments` | ya usado — suma `installment_id` opcional (`ProcessPaymentRequest`, confirmado). |

**Nota:** `GET /tiers` (catálogo general) no trae `hierarchy` — ese
campo solo existe en el `tier` embebido de `ChangeTierResponse`/
`CurrentSubscriptionResponse`. El orden de las cards del catálogo sigue
por `tierAmount` ascendente (criterio ya usado en Fase 0), sin cambios.

`POST /payments/test-card-token` no se integra en la UI — es una
herramienta de testing del compañero (curl/Bruno), no un paso que el
frontend orqueste (el token real sale del Brick de Mercado Pago,
sandbox o producción).

## Decisiones

### Al entrar a la pantalla: detectar pago pendiente antes de ofrecer "Mejorar"

Además de `listTiers()`, se suma `getCurrentSubscription(userId,
roleId)` para el rol activo. Si `subscription_status ===
'first_payment_pending'`, un banner arriba de las cards ("Tenés un pago
pendiente de $X — Completar pago") lleva directo al checkout reusando
`installment_id`/`installment_amount`/`public_key` de esa misma
respuesta — sin volver a llamar `PUT tier`. Esto evita en la práctica
el 409 `SUBSCRIPTION_PENDING_FIRST_PAYMENT` (la UI ya redirige a pagar
la cuota pendiente en vez de dejar reintentar el cambio).

Si el cambio de tier falla por deuda (409
`DEBT_BLOCKS_OPERATION`) — Toast con el mensaje del backend, mismo
patrón que el resto del repo, sin pantalla de deuda dedicada.

### Click en "Mejorar" — 3 pasos, sin modal de confirmación propio

Reemplaza el pill "Próximamente" en `TierCard`: para un tier no-actual
con `paymentRequired: true`, botón "Mejorar". `onPress`:

1. `PUT /users/{id}/roles/{role_id}/tier` con `tier_id` → `installment_id`,
   `installment_amount`, `public_key`.
2. `POST /payments/preference` con `installment_id`, `concept:
   'subscription'`, `items` con el monto de la cuota → `preference_id`.
3. Abre `CheckoutFlow` (ya existente, sin cambios de firma) con esos
   datos — Brick inline en web, modal WebView en nativo.

Sin modal de confirmación propio antes de esto — el Brick ya muestra el
monto y pide los datos de tarjeta, es su propio paso de confirmación
(mismo criterio que Fase 0).

### Confirmación post-pago: un solo check a los 5 segundos, no polling en loop

`onApproved` de `CheckoutFlow` → cierra el checkout, loading
("Confirmando pago…") 5 segundos, después **un solo**
`getCurrentSubscription` (no polling repetido — el pago se confirma por
webhook async, que en local puede no llegar nunca sin túnel):

- `subscription_status === 'active'` y `tier.id` coincide con el
  pedido → Toast de éxito, `fetchPermissions()` (acción ya existente en
  `auth-store.js`) para refrescar `roles`/tier en toda la app sin
  recargar.
- Si no → fallback, no error: "Tu pago fue recibido, puede tardar unos
  minutos en reflejarse". El usuario puede volver a la pantalla más
  tarde y ve el estado real.

### Capa de datos — `tier-subscriptions.js` + Query

`services/tier-subscriptions.js` (nuevo, mismo molde `USE_MOCKS` que el
resto): `changeTier(userId, roleId, tierId)`,
`getCurrentSubscription(userId, roleId)`. Mock en
`services/__mocks__/tier-subscriptions-mock.js` — igual que el resto de
mocks del repo, "hace como que" cambia de tier y devuelve una
suscripción coherente, no un no-op.

`services/normalizers.js`: `toSubscriptionModel(dto)` nuevo (camelCase:
`subscriptionId`, `subscriptionStatus`, `installmentId`,
`installmentAmount`, `installmentNumber`, `nextDueDate`, `blockedDate`,
`paidInstallments`, `tier: {id, name, hierarchy, paymentRequired}`,
`role: {id, name}`, `mercadopago: {publicKey}`).
`toCreatePreferencePayload`/`toProcessPaymentPayload` suman
`installmentId` opcional → `installment_id` (mismo patrón condicional
que ya usan para `preferenceId`).

`hooks/use-tier-subscription.js` (nuevo, TanStack Query — estado de
servidor, mismo criterio que `use-team-roster.js`): `useQuery` para
`subscription-current` (`queryKey: ['subscription-current', userId,
roleId]`), `useMutation` para `changeTier` que invalida esa query al
resolver. Como `tier-upgrade-screen.jsx` se reescribe entera igual, el
fetch de `listTiers()` (hoy `useState`/`useEffect` plano) pasa a
`useQuery` de paso — mismo archivo, mismo criterio, no conviene mezclar
dos patrones en un componente que se está tocando entero.

## Fuera de alcance

Downgrade de tier (bajar de un tier pago a uno inferior) — no
contemplado en el caso de uso entregado, ni hay UI para eso hoy.
Pantalla de gestión de deuda/cuotas vencidas — el 409
`DEBT_BLOCKS_OPERATION` solo muestra Toast por ahora. Fase 2 (split de
suscripción de equipo, `GET
/users/{id}/teams/{team_id}/subscription` ya existe en el swagger de
esta rama pero es un caso de uso aparte) — no se toca acá.

## Verificación

Con el backend local del compañero corriendo
(`EXPO_PUBLIC_API_URL=http://192.168.1.4:8080/api/v1`, `.env`, sin
`USE_MOCKS`): setear tier base al usuario de prueba vía endpoint (según
indicó el compañero), entrar a "Mejorar tier", click en el tier pago,
completar el Brick con la tarjeta de sandbox
(`5031755734530604`/`11/2030`/`123`, aprueba), esperar el loading de
confirmación. Si el webhook no llega solo en local, usar el request
opcional de Bruno ("Simular webhook MP") para completar la activación
y volver a probar el check post-pago.

Con `EXPO_PUBLIC_USE_MOCKS=true`: mismo flujo de punta a punta contra
el mock, sin backend real — confirma que la UI se comporta bien sin
depender de si el webhook llegó o no.

`npm test` y `npm run lint` en verde antes de abrir la PR.
