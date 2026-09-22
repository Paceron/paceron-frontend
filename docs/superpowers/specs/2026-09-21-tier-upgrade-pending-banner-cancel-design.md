# Tier upgrade — banner de pago pendiente desde subscriptions/next + cancelación

Fecha: 2026-09-21. Rama: `feature/tier-upgrade-pending-cancel` (frontend).

## Problema

Tras un logout/login, `/profile/tier-upgrade` no mostraba el banner "Completar
pago" aunque existiera una sub `first_payment_pending` atascada. El banner (y el
bloqueo) derivaban de `useTierSubscription` → `subscriptions/current`, que solo
devuelve subs `active`: el pendiente nunca asomaba ahí, pero seguía existiendo en
el backend y `changeTier` respondía `409 SUBSCRIPTION_PENDING_FIRST_PAYMENT`.
Quedaba un estado sin salida: no se veía el pago pendiente ni se podía cambiar a
otro tier.

## Decisión

- **El banner se alimenta de `subscriptions/next`** (`GET /users/{id}/subscriptions/next?role_id=`),
  el período que el backend destina a la sub `first_payment_pending`. Se verifica
  con `subscriptionStatus === 'first_payment_pending'`; si `next` viene vacío no
  hay banner. Fallback defensivo: si `current` llegara a traer un pending, también
  se muestra.
- **El banner ahora indica el tier destino** ("Se va a activar {tier}"), tomado de
  `tier.name` de la sub pendiente.
- **Botón "Cancelar"** en el banner: abre `CancelPendingPaymentModal` (confirmación
  ámbar, patrón `DiscardChangesModal`, con `notifyWarning()` y estado de carga).
  Al confirmar, `DELETE /users/{id}/roles/{role_id}/subscriptions/pending?tier_id=`
  — el backend marca la sub `canceled` y cancela sus cuotas pendientes en
  transacción (`SetCanceled` + `CancelPendingBySubscription`), liberando el slot
  del índice único parcial. Tras el éxito se refrescan next + current y el usuario
  vuelve a poder cambiar de tier.

## Backend

**Sin cambios** — los endpoints ya existían y cumplen exactamente este contrato
(verificado live, abajo): cancelación en `cmd/api/services/tier_subscription_service.go`
(`CancelPendingSubscription`), rutas en `url_mappings.go` (`subscriptions/:period`
y `DELETE subscriptions/pending`).

## Frontend

- `services/tier-subscriptions.js`: `getNextSubscription` + `cancelPendingSubscription` (+ mocks).
- `hooks/use-tier-subscription.js`: query `['subscription-next', userId, roleId]`
  expuesta como `nextSubscription`/`refetchNextSubscription`; mutation
  `cancelPending` que invalida current+next y limpia el cache de next.
- `components/shared/cancel-pending-payment-modal.jsx` (nuevo, patrón ámbar).
- `components/profile/tier-upgrade-screen.jsx`: banner derivado de
  `pendingSubscription` (next primero), readonly de tier destino, botón cancelar
  + modal, refresh post-cancel con `notifySuccess`/`notifyError` + Toast. El
  handler de pago aprobado (`handleApproved`) refetchea **current y next** — la
  sub `first_payment_pending` pasa a `active` al pagar y `next` vuelve vacío,
  sin ese refetch el banner "completar pago" quedaba con el pendiente viejo en
  cache tras mostrar "Tier actualizado". Además el banner de pendiente se oculta
  mientras está el aviso "Confirmando pago…" (`!confirming`): si tras la espera
  de 5s el pago no quedó `active`, se muestra "Tu pago fue recibido" y `confirming`
  se mantiene con el banner oculto; a los 5s siguientes se re-consulta current+next
  y recién ahí se deja redibujar el banner — reaparece solo si el pendiente sigue
  existiendo. Mismo criterio post-cancel: `handleCancelPending` refresca current +
  next para redibujar/ocultar. Tras el éxito (pago o cancelación) se invalida
  también `['permissions', userId]`: el selector de rol del menú
  (`RoleSwitchToggle`) muestra el tier del rol con `roles[].tier` — que trae el
  nombre resuelto del backend ("premium_entrenador", "base_entrenador"). El
  label del switch se deriva de ese nombre (parte antes del sufijo de rol,
  capitalizada); antes se comparaba contra el literal `'premium'` y por eso
  daba siempre "BASE".

## Verificación

- `npm test` → 325/325. `npm run lint` → verde.
- Live contra backend local (usuario 3, role entrenador):
  1. `changeTier` a `premium_entrenador` con pending activo → `409` (el bug).
  2. `DELETE pending?tier_id=2` → `200 {subscription_id: 16, subscription_status: "canceled"}`.
  3. `next` → `{}` (banner desaparece).
  4. `changeTier` de nuevo → `200`, nueva pending (fixture id 17 dejado para
     probar la UI del banner).
  5. Permissions: entrenador → `base_entrenador` tras cancelar (fix de
     `fix-permissions-tier` intacto).