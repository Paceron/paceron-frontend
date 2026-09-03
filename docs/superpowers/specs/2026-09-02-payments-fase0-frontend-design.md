# Fase 0 de pagos — catálogo de tiers + plomería de checkout — Design

**Fecha:** 2026-09-02
**Estado:** Aprobado, en desarrollo

## Contexto

El backend confirmó estado real de pagos vía `paceron-backend/docs/PAYMENTS_FRONTEND_ROADMAP.md`
(verificado contra `develop@2ca3f08`): **Fase 0** (pago genérico
Checkout Bricks, sin split) está implementada y estable —
`POST /payments/preference`, `POST /payments`, `GET /payments/:id`,
`GET /payments/mp/:id`, `POST /payments/test-card-token`. **Fase 1**
(suscripción de tier con cuotas) y **Fase 2** (suscripción de equipo +
split al entrenador) son solo spec del lado backend
(`openspec/changes/cambio-tier-suscripciones`,
`openspec/changes/suscripcion-teams-split`), 0% de código — contratos
propuestos, sujetos a cambio.

Esto reemplaza/corrige al spec anterior de Sub-proyecto A
(`docs/superpowers/specs/2026-08-12-subscription-tier-checkout-design.md`),
escrito antes de que este roadmap existiera — ver Decisión de corrección
más abajo.

Sin caso de uso real terminado todavía (activar/gatear un tier pago
necesita Fase 1, que no existe). El objetivo de esta entrega es avanzar
en paralelo al backend sin construir nada que haya que rehacer cuando
Fase 1/2 aterricen — siguiendo los lineamientos que el propio roadmap del
backend ya sugiere (service module único, componente de checkout
parametrizable, no asumir que `concept` dispara lógica).

## Alcance de esta spec

Dos piezas independientes, cada una completa y útil por sí sola —
ninguna depende de que la otra esté "terminada":

1. **Catálogo real de tiers** (`services/tiers.js`, reescritura de
   `tier-upgrade-screen.jsx`, ajuste de `role-switch-toggle.jsx`) — usa
   `GET /api/v1/tiers`, que ya es real y no depende de pagos.
2. **Plomería de checkout Fase 0** (`services/payments.js`,
   `components/payments/checkout-flow.{web,}.jsx`, pantalla-testbed sin
   entrada de nav) — sin verificación en vivo contra sandbox todavía
   (el backend no tiene credenciales de sandbox cargadas en el deploy de
   desarrollo aún); esta ronda queda en "compila, tests unitarios en
   verde", no en "probado contra Mercado Pago real".

`docs/BACKEND_API_GAPS.md` (gap nuevo, ver más abajo).

## Decisiones

### Corrección sobre el spec de 2026-08-12: `public_key` es dinámico, no una env var

El spec anterior (Sub-proyecto A) asumía una env var pública
`EXPO_PUBLIC_MP_PUBLIC_KEY`. El contrato real de
`POST /payments/preference` devuelve `{ preference_id, public_key }` —
`public_key` viaja en cada respuesta de preferencia, no hace falta
ninguna env var nueva. `initMercadoPago()` se llama con el valor que
devuelve cada preferencia, no con una constante global.

### Una sola entrada "Mejorar tier", no una por rol

`role-switch-toggle.jsx#TierUpgradeLink` pasa de
`"Mejorar tier de {roleLabel}"` a `"Mejorar tier"` fijo — mismo
`onPress`/ruta (`/profile/tier-upgrade`). La pantalla de destino ya sabe
mostrar los tiers del rol activo, no hace falta que el link lo anticipe
en el texto.

### `services/tiers.js` — catálogo real, sin campo de jerarquía todavía

`listTiers()` pega a `GET /tiers` (sin filtro de rol en el backend —
devuelve todos los tiers de todos los roles, se filtra client-side por
`roleName` contra el rol activo). Normalizer nuevo en
`services/normalizers.js`: `toTierModel(dto)` →
`{id, name, roleId, roleName, description, tierAmount, paymentRequired}`.

Sin campo `hierarchy` en el backend hoy (eso es parte de la spec de Fase
1, `tiers.hierarchy`, no implementado) — el orden de las cards se decide
por `tierAmount` ascendente como criterio provisorio y honesto. Cuando
Fase 1 agregue `hierarchy`, se reemplaza el criterio de orden sin tocar
el resto de la pantalla.

### `tier-upgrade-screen.jsx` — cards reales, botón "Próximamente"

Reescritura completa del placeholder actual. Fetch de `listTiers()`,
filtro por rol activo, una card por tier: nombre, precio (`tierAmount`
formateado, o "Gratis" si `!paymentRequired`), `description` como texto
de beneficios. El tier que coincide con `roles[].tier` (ya viene de
`/auth/permissions`, ver `store/auth-store.js`) muestra badge "Tier
actual" en vez de botón; el resto muestra el mismo pill
"Próximamente" (`clock-outline`, `bg-slate-100`) que ya usa
`training-plans-screen.jsx`/`my-plans-screen.jsx` — **sin acción de
pago conectada todavía**, decisión explícita para no dejar un botón que
cobra pero no gatea nada (Fase 1 no existe).

`description` es la única fuente de "beneficios" disponible — no hay
forma de listar los permisos de un tier ajeno (ver gap nuevo abajo). Si
`description` viene vacía, la card muestra el precio y el nombre nomás,
sin sección de beneficios (no se inventa contenido).

### `services/payments.js` — mismo patrón `USE_MOCKS` que el resto del repo

```js
createPreference({ items, concept, description }) // POST /payments/preference → { preferenceId, publicKey }
processPayment({ token, transactionAmount, paymentMethodId, installments, payerEmail, preferenceId }) // POST /payments
getPayment(paymentId) // GET /payments/:id
createTestCardToken(cardData) // POST /payments/test-card-token — sandbox, sin UI propia esta ronda
```

Normalizers nuevos: `toCreatePreferencePayload`, `toPreferenceResponseModel`,
`toProcessPaymentPayload`, `toPaymentModel` — mismo criterio
snake_case↔camelCase de límite que ya usa el resto de `services/normalizers.js`.
Mock correspondiente en `services/__mocks__/payments-mock.js` (estado
in-memory, mismo patrón que `training-plans-mock.js`) para que
`EXPO_PUBLIC_USE_MOCKS=true` deje probar la plomería sin backend real ni
sandbox de MP.

`concept` se pasa tal cual lo pida el caller (`"order"`/`"subscription"`)
— el servicio no le asume ningún comportamiento especial, coherente con
que hoy el backend tampoco lo tiene.

### `CheckoutFlow` — un componente paramétrico para las 3 fases, split por archivo

`components/payments/checkout-flow.web.jsx` (usa `@mercadopago/sdk-react`,
dependencia nueva, no instalada hoy — confirmado) +
`components/payments/checkout-flow.jsx` (nativo). Mismo patrón de
aislamiento a nivel de archivo que `app/(tabs)/index.jsx`/`index.web.jsx`,
para que Metro nunca intente resolver el SDK de MP (que asume
`window`/`document`) en el bundle nativo.

Props comunes: `{ preferenceId, publicKey, amount, marketplace?, onApproved, onError }`.
`marketplace` ya está en la firma aunque hoy siempre sea `undefined`
(Fase 2 lo pasará en `true`) — evita tener que cambiar la interfaz del
componente cuando llegue split.

- **Web:** `initMercadoPago(publicKey)` + `<Payment initialization={{ amount, preferenceId, marketplace }} onSubmit={...} onReady={...} onError={...} />`. `onSubmit` llama `processPayment`, y al aprobar renderiza `<StatusScreen initialization={{ paymentId }} />`. Unmount del brick al desmontar el componente (evita el error de render reusado que documenta el propio backend).
- **Nativo:** mismo pill "Próximamente en la app" que el resto del repo usa para funcionalidad no lista — no un throw, no una pantalla en blanco. Sin WebView todavía: la decisión Checkout Pro vs WebView (ver spec 2026-08-12) sigue sin tomarse, no es parte de esta entrega.

### Pantalla-testbed, sin entrada en `routes/catalog.js`

`components/payments/payments-testbed-screen.jsx`, ruta
`app/(tabs)/profile/payments-testbed.jsx` — accesible solo tipeando la
URL, no aparece en ningún menú. Formulario mínimo (monto, `concept`,
título del item) → `createPreference` → monta `CheckoutFlow` → muestra
el `PaymentResponse` crudo devuelto por `getPayment` debajo, para poder
confirmar de un vistazo que concept/monto/estado viajan bien el día que
haya sandbox para probar en vivo. Esta ronda no se verifica en vivo
(ver Alcance) — queda armada y compilando, lista para cuando el backend
tenga credenciales de sandbox.

## Gap nuevo para `docs/BACKEND_API_GAPS.md`

**Sin endpoint para listar los permisos de un tier ajeno.**
`POST /tiers/{id}/permissions` (asignar) existe, pero no hay
`GET /tiers/{id}/permissions` — el único lugar donde se resuelven
permisos por tier es `/auth/permissions`, y solo para el tier **actual**
del usuario autenticado. Impacto: la card de un tier al que el usuario
todavía no accedió no puede mostrar su lista de permisos/beneficios
resuelta, solo el `description` de texto libre del tier. No bloqueante
para esta entrega (se usa `description`), pero relevante si más adelante
se quiere una lista de beneficios más rica que un párrafo.

Se agrega como gap nuevo en `docs/BACKEND_API_GAPS.md` (mismo doc
existente, no uno separado — sigue el patrón ya establecido ahí de un
gap por sección, actualizado con fecha).

## Fuera de alcance

Cualquier lógica de Fase 1 (cambio de tier real, gating de acceso hasta
el primer pago) o Fase 2 (split, mp-connect, suscripción de equipo) —
sus contratos son propuestas del backend sujetas a cambio, no se
integra contra nada de eso todavía. Decisión WebView vs Checkout Pro
para nativo (sigue pendiente, ver spec 2026-08-12). Verificación en vivo
contra el sandbox de Mercado Pago (bloqueada por falta de credenciales
en el deploy de desarrollo del backend). `test-card-token` sin UI propia
esta ronda. Botón de pago real en las cards de tier (queda
"Próximamente" a propósito, ver decisión arriba).

## Verificación

`npm test` y `npm run lint` en verde — cobertura vía tests de
servicio+mock+normalizers (`services/tiers.js`, `services/payments.js`,
sus mocks, normalizers nuevos), consistente con la convención del repo
de no testear render de componentes. Verificación visual manual en
preview web: `/profile/tier-upgrade` con `EXPO_PUBLIC_USE_MOCKS=true`
muestra cards reales por rol activo, tier actual con badge, resto con
"Próximamente"; `/profile/payments-testbed` monta el brick sin errores
de consola (usando mocks, no contra MP real). Sin verificación en vivo
contra Mercado Pago sandbox esta ronda (ver Alcance).
