# Pago de membresía al unirse a un equipo (split al entrenador) — Design

**Fecha:** 2026-09-26
**Estado:** Aprobado, en desarrollo

## Contexto

Unirse a un equipo es gratis hoy: el corredor pide unirse desde la búsqueda
pública (`POST /teams/{id}/join-requests`) y espera aprobación, o acepta una
invitación (`POST /invitations/{id}/accept`) y entra directo. No se cobra nada.

El negocio necesita que el corredor **pague la mensualidad del equipo al
entrenador**, con comisión para Paceron, reusando el brick de Mercado Pago que
ya se usa para que el entrenador pague su propio tier (Fase 1,
`docs/superpowers/specs/2026-09-03-payments-fase1-tier-upgrade-design.md`).

Este es el **Sub-proyecto B** anticipado en
`docs/superpowers/specs/2026-08-12-trainer-split-payments-decisions.md`, y el
"próximo caller real de `CheckoutFlow`" para el que se hizo el refactor de
`docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md`.

**El backend ya está implementado entero** (change `suscripcion-teams-split` en
`paceron-backend`, paso a paso en su `docs/CU/02-pago-participacion-equipo.md`),
verificado el 2026-09-26 contra el código de `develop` y contra el schema vivo
de un backend local. Lo que falta es 100% frontend: `membership_fee` no aparece
en ningún normalizer, no hay service de suscripción de equipo, y `CheckoutFlow`
ya tiene la prop `marketplace` que **ningún caller usa todavía**.

### No hay "elegir plan": hay un precio por equipo

El pedido original incluía una pantalla para *elegir un plan* de suscripción al
equipo. **Eso no existe en el backend y no se agrega acá.** Verificado por tres
vías independientes:

- El schema vivo (auto-migrado por GORM) tiene 33 tablas y **ninguna** de
  team-tiers/team-plans. El precio es una sola columna, `teams.membership_fee`.
- `tiers.role_id` — los tiers cuelgan de un **rol** (corredor/entrenador), no de
  un equipo. Ningún modelo tiene `TeamID` y `TierID` a la vez.
- OpenSpec no tiene spec (ni activa ni archivada) de planes por equipo.

Lo único que cruza "tier" con "team" es `team_configuration.go`: el tier **del
entrenador** define cuántos integrantes puede tener (`max_members`) y cuál es el
piso que puede cobrar (`minimum_fee`), no qué planes ofrece.

Construir `team_tiers` (con gateo de contenido por plan, que fue la variante
pedida) duplicaría casi 1:1 `tiers` + `tier_permissions` —un plan con precio que
otorga permisos ya es exactamente esa estructura— más el motor de cuotas que ya
es compartido. Se descartó por eso. Si el multi-plan se retoma, el camino es
reusar `tiers`/`tier_permissions`, no una tabla paralela, y es una conversación
con quien mantiene el backend (su `AGENTS.md` §8 reserva ese repo para OpenCode).

## Alcance de esta spec

**Nuevo:** `services/team-subscriptions.js` y `services/team-configuration.js`
(+ sus mocks), `hooks/use-team-subscription.js`,
`hooks/use-team-configuration.js`,
`components/team/team-subscription-screen.jsx` + ruta
`app/(tabs)/teams/[teamId]/subscription.jsx`,
`components/team/join-team-confirm-modal.jsx`,
`components/team/team-subscription-pending-banner.jsx`.

**Modificado:** `services/normalizers.js` (`toTeamModel`,
`toCreateTeamPayload`/`toUpdateTeamPayload`, `toProcessPaymentPayload`, y dos
normalizers nuevos), los 4 archivos de `components/payments/` que threadean
`concept`, `team-search-screen.jsx`, `notifications-screen.jsx`,
`create-team-screen.jsx`, `edit-team-screen.jsx`, `team-detail-screen.jsx`.

## Contrato de backend (verificado en código, `develop`, 2026-09-26)

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/teams/{id}` | ya usado — **sí trae `membership_fee`**, cualquier autenticado puede leerlo. |
| GET | `/api/v1/team-configuration` | nuevo consumidor. `{max_members, minimum_fee}` derivados del tier del entrenador (hoy 10/25/50 y 20000 para los tres). Self-only, sin params. |
| POST/PUT | `/api/v1/teams`, `/api/v1/teams/{id}` | ya usados — aceptan `membership_fee` (`*float64`, opcional, `>= 0`). El cambio **no es retroactivo**: `init_amount` se congela por membresía. |
| GET | `/api/v1/users/{id}/teams/{team_id}/subscription` | nuevo. `{team, membership, next_installment?, has_debt, mercadopago?}`. El `:id` del path lo **ignora** (usa el JWT), así que es self-only por construcción. 404 si no sos miembro. |
| POST | `/api/v1/payments/preference` | ya usado — suma `concept: "team_subscription"` + `installment_id`. Responde 201 con `{preference_id, public_key}`. |
| POST | `/api/v1/payments` | ya usado — **suma `concept`**, que hoy el frontend no manda (ver decisión abajo). |

`membership.subscription_status` es `first_payment_pending` | `active` (el enum
completo del backend suma `ended`/`canceled`). **No** son los valores de
`SUBSCRIPTION_STATUSES` de `store/team-store.js` (`activo`/`vencido`/
`en_prueba`), que quedaron de un diseño previo — ver Fuera de alcance.

`TeamSearchResult` e `InvitationResponse` **no traen `membership_fee`**
(confirmado en sus structs Go) — de ahí el fan-out descripto abajo.

## Decisiones

### `concept` tiene que llegar hasta `POST /payments`, o la plata va a Paceron

`toProcessPaymentPayload` (`services/normalizers.js`) hoy manda `token`,
`transaction_amount`, `payment_method_id`, `installments`, `payer_email`,
`preference_id?` e `installment_id?` — **no manda `concept`**. Y `CheckoutBrick`,
que es quien arma ese payload desde el `formData` del brick, no acepta un
`concept`.

El backend usa ese campo para disparar `resolveTeamSplitConfig`
(`payment_service.go`), que es lo que resuelve el access token OAuth del
entrenador. **Sin `concept: "team_subscription"`, el pago se cobra con el token
de Paceron y el dinero no le llega al entrenador.** El monto es correcto y el
pago se aprueba igual, así que el bug es invisible salvo mirando en qué cuenta
de MP entró la plata — nunca se detectaría contra mocks.

Por eso `concept` se threadea por toda la cadena, igual que ya está threadeado
`marketplace`: caller → `CheckoutFlow` (las dos variantes) → `CheckoutBrick` →
`toProcessPaymentPayload`, y en nativo además como query param de `/checkout` →
`checkout-web-page.jsx`. Es opcional en toda la cadena: los callers existentes
(tier, testbed) no lo pasan y siguen funcionando igual.

### La `public_key` del brick sale de la preferencia, no de `/subscription`

`GET .../subscription` devuelve un bloque `mercadopago.public_key`, pero es la
key de **integrador de Paceron** (`team_subscription_service.go`), no la del
vendedor. Mezclar esa key con el access token del vendedor es exactamente lo que
produce el error `2034 Invalid users involved` de MP, diagnosticado del lado
backend en su `plan_fix_pagos.md`.

Se usa la `public_key` que devuelve `POST /payments/preference` (que sí es la
del vendedor en el camino de split). De `/subscription` se leen solo
`mercadopago.concept` y `mercadopago.marketplace` como señal de que el equipo
cobra y de que hay que armar el brick marketplace.

### Se une primero, paga después — no hay otro orden posible

La cuota #1 la crea `ApplyTeamMembershipGate` **en el momento en que se crea la
membresía** (los 3 caminos: `AddUser`, aceptar invitación, aceptar solicitud).
Antes de eso no existe ningún `installment_id` que pagar, así que no hay forma de
cobrar antes de entrar. El corredor queda `first_payment_pending` y pasa a
`active` cuando el webhook de MP confirma el pago.

Consecuencia por camino:

- **Invitación:** el corredor acepta → la membresía y la cuota existen en ese
  mismo momento → se lo lleva derecho a la pantalla de pago.
- **Búsqueda pública:** el corredor solo crea una *solicitud*; la membresía la
  crea el entrenador al aceptar, días después, **cuando el corredor no está
  presente**. No se puede cobrar en el momento de pedir. El modal de
  confirmación deja claro que se paga al ser aceptado, y el cobro se ofrece
  después vía el banner de pago pendiente.

Equipo gratis (`membership_fee === 0`): **todo idéntico a hoy** — sin modal, sin
banner, sin pantalla de pago. El backend lo deja `active` directo.

### Mientras no paga: banner, no bloqueo

El backend no bloquea nada por `first_payment_pending` (lo único que impide es
irse del equipo con deuda, `TEAM_DEBT_BLOCKS_OPERATION`), así que bloquear el
contenido del equipo sería enforcement puramente de UI — el mismo tipo de
enforcement solo-de-UI que ya existe en mp-connect y que se sabe que un cliente
viejo o una llamada directa a la API esquivan. Se muestra el banner y no se
bloquea nada, que además es lo que ya había fijado la spec de decisiones de
2026-08-12 para el período de gracia.

### El precio se muestra donde el corredor decide, con fan-out por equipo

Requisito explícito: la cuota tiene que verse en la tarjeta de la búsqueda
pública (al lado del botón de unirse) y en la invitación in-app, no recién en
una pantalla posterior.

Ni `TeamSearchResult` ni `InvitationResponse` traen `membership_fee`, así que el
precio sale de `GET /teams/{id}` por equipo, con `useQueries` de TanStack Query
sobre la key `['team', teamId]` que ya se usa en el repo (así el fetch se comparte
con cualquier otra pantalla que ya haya pedido ese equipo). Son hasta 20 requests
cacheados en una página de búsqueda; el pedido de agregar el campo a esos dos
DTOs queda anotado en `docs/BACKEND_API_GAPS.md` para poder sacar el fan-out
después. Mientras el precio de un equipo esté cargando, la tarjeta no muestra
precio en vez de mostrar "gratis" (un precio equivocado es peor que ninguno).

### Confirmación post-pago: se copia el patrón de Fase 1 tal cual

Mismo mecanismo que `tier-upgrade-screen.jsx`, que ya resolvió esto: cerrar el
modal, mostrar "Confirmando pago…", esperar 5s, refetchear la suscripción, y si
no quedó `active` mostrar "tu pago fue recibido, puede tardar unos minutos" +
un segundo chequeo. No es polling en loop: el webhook de MP es asíncrono y en un
backend local puede no llegar nunca, así que la UI no puede quedar colgada
esperándolo.

### El error de "entrenador sin Mercado Pago conectado" se muestra genérico

Si el entrenador no conectó MP, `POST /payments/preference` falla — pero el
controller del backend colapsa **todo** error a 500 con un mensaje genérico, así
que `SELLER_NOT_CONNECTED` no se puede distinguir de una caída real. Tampoco hay
forma de saberlo antes: `/mercadopago/connect/status` es self-only, no acepta un
`user_id` ajeno.

Se muestra un Toast honesto de que no se pudo iniciar el pago y que el equipo
puede no estar listo para cobrar, sin afirmar una causa que no podemos
verificar. Los dos pedidos al backend quedan anotados en
`docs/BACKEND_API_GAPS.md`.

### Capa de datos

`services/team-subscriptions.js` y `services/team-configuration.js` siguen el
formato del resto: 1:1 con el endpoint, `if (USE_MOCKS) return await mock…()` en
la primera línea, comentario nombrando el endpoint y el struct Go. Los hooks
devuelven campos con nombre de dominio + `refetch`, nunca el query object crudo.

El mock de suscripción de equipo **no auto-activa** la membresía (no hay webhook
que simular) y expone `__mockActivateTeamSubscription(userId, teamId)` como
helper manual — mismo criterio, y por la misma razón, que
`services/__mocks__/tier-subscriptions-mock.js`.

## Fuera de alcance

- **Cualquier cambio en `paceron-backend`** (su `AGENTS.md` §8 reserva ese repo
  para OpenCode).
- **Multi-plan / tiers por equipo** y el gateo de contenido por plan (ver
  Contexto).
- **Renovación mensual proactiva y expulsión automática** por no renovar. El
  backend ya genera la cuota siguiente al confirmarse la anterior, y la pantalla
  de pago sirve tal cual para pagarla; lo que falta es el disparo/los avisos, que
  es trabajo propio.
- **Período de prueba por equipo** (1/2/4 semanas, de la spec de decisiones de
  2026-08-12): el backend **no tiene ningún campo de trial**, verificado.
- **Sección de ganancias/comisión del entrenador.**
- **`subscriptionStatus` real en el roster.** `hooks/use-team-roster.js` lo
  hardcodea `null` y el `SUBSCRIPTION_META` de `team-detail-screen.jsx` usa
  valores de otro diseño (`activo`/`vencido`/`en_prueba`) que no son los del
  backend. Reconciliar eso es un trabajo aparte.

## Verificación

1. `npm test` y `npm run lint` en verde.
2. Contra mocks (`EXPO_PUBLIC_USE_MOCKS=true`): los dos caminos de unirse, y
   confirmar que un equipo con `membership_fee === 0` se comporta exactamente
   como antes de esta rama. `mockProcessPayment` **siempre aprueba** y no simula
   el webhook → la activación se fuerza con `__mockActivateTeamSubscription`.
3. Contra el backend local (`EXPO_PUBLIC_USE_MOCKS=false`): crear un equipo con
   cuota, invitar a un segundo usuario, aceptar, y confirmar que
   `GET /users/{id}/teams/{team_id}/subscription` devuelve `first_payment_pending`
   con la cuota #1. Valida todo el flujo **menos el cobro**.
4. **Cobro real (2026-09-27, contra `paceron-backend-as9c.onrender.com`, `develop`, con
   credenciales reales de sandbox provistas por el equipo):**
   - OAuth mp-connect real, de punta a punta: `GET /mercadopago/connect` → login+consentimiento
     en el navegador con un test user vendedor (creado vía la API de test users de MP,
     `POST https://api.mercadopago.com/users/test_user`, sin necesitar el panel) →
     `GET /mercadopago/connect/status` → `connected: true`. Confirmó además que el `state`
     CSRF vence rápido y que hay que completar el consentimiento sin demora.
   - Equipo con cuota → invitación → aceptar → `GET .../subscription` devuelve
     `first_payment_pending` + cuota #1, igual que documentado.
   - `POST /payments/preference` con `concept: "team_subscription"` devuelve la **public key
     del vendedor** (`TEST-82b19115-...`), distinta de la del integrador
     (`TEST-9a1e5d38-...`) — confirma que el fix de `plan_fix_pagos.md` (tokenizar con la PK
     del vendedor en split) **ya está aplicado** en `develop`.
   - **Pago sin split: `approved` de punta a punta**, con tarjeta de sandbox real. Requiere
     `payer_email` **arbitrario** (no `@testuser.com`) — con un email de test user real da
     `400 Invalid users involved (2034)`.
   - **Pago con split: bloqueado por una limitación de cuentas de sandbox de MP, no por
     código.** `payer_email` arbitrario da `400 Invalid test user email (2198)` (el vendedor
     sandbox exige un comprador real); un comprador test user real da `2034 Invalid users
     involved` — porque el comprador y el vendedor son test users creados bajo la misma
     app/cuenta de desarrollador (`client_id 2636114621042686`), y MP los trata como el mismo
     árbol de identidad. Mismo límite que ya había hecho tropezar al equipo de backend
     (`plan_fix_pagos.md` menciona haber tenido que descartar un vendedor y usar un comprador
     de otra app para esquivarlo). **No es un bug de esta rama** — el contrato
     frontend↔backend (payload, `concept`, fuente de la `public_key`, `marketplace`) quedó
     validado con datos reales; falta únicamente separar el comprador y el vendedor de sandbox
     en apps de MP distintas para probar el cobro efectivo.

## Nota para el equipo de backend (no es trabajo de esta rama)

El `marketplace_fee` se calcula y se persiste en `payments.marketplace_fee`,
pero **nunca se envía a Mercado Pago**: `mercadopagoclient/client.go` recibe el
parámetro y no lo asigna ni en `preference.Request` ni en `payment.Request`. Como
el pago se hace con el access token del entrenador y sin fee, **hoy el 100% del
dinero queda en la cuenta del entrenador y Paceron no retiene nada**. Ya está
anotado como gap conocido en su propio `docs/CU/02-pago-participacion-equipo.md`
y su `design.md` D9 lo especifica como pendiente. Vale avisarlo explícitamente
antes de cualquier uso con dinero real.

**Actualización sobre `plan_fix_pagos.md` (2026-09-27):** el fix descripto ahí
(tokenizar el card token con la public key del **vendedor**, no la del
integrador, cuando el pago es `team_subscription`) **ya está aplicado** —
confirmado empíricamente: `POST /payments/preference` con split devuelve
`TEST-82b19115-...` (la del vendedor conectado), distinta de la del integrador.
Ese documento puede marcarse resuelto en ese punto puntual.

Lo que **sigue bloqueando el pago con split en sandbox** es otra cosa, no
cubierta por ese fix: el comprador y el vendedor de prueba usados (ambos
creados vía la API de test users de MP con las credenciales de la app
`paceron`, `client_id 2636114621042686`) son tratados por MP como la misma
identidad — `400 Invalid users involved (2034)`. Un `payer_email` arbitrario
tampoco sirve (`400 Invalid test user email`, código 2198 — el vendedor
sandbox exige un comprador test user real). El propio `plan_fix_pagos.md` ya
había topado con esto antes (mencionan haber descartado un vendedor y usado un
comprador de "otra app" para esquivarlo) — para retomarlo, el comprador de
prueba tiene que salir de una app de Mercado Pago **distinta** a la del
vendedor conectado.
