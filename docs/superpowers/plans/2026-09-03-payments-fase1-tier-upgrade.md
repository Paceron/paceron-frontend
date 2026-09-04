# Fase 1 de pagos — flujo real de cambio de tier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el pill "Próximamente" de `tier-upgrade-screen.jsx` por el flujo real de upgrade de tier (subir de tier base/gratis a uno pago), pagando la cuota #1 a través del `CheckoutFlow` ya existente de Fase 0.

**Architecture:** Nuevo servicio `services/tier-subscriptions.js` (PUT cambio de tier, GET suscripción actual) + normalizer `toSubscriptionModel`, expuestos por un hook nuevo de TanStack Query (`hooks/use-tier-subscription.js`, primer `useMutation` del repo, mismo criterio de estado-de-servidor que `use-team-roster.js`). `tier-upgrade-screen.jsx` se reescribe para: detectar un pago pendiente al entrar, disparar el flujo de 3 pasos (cambiar tier → crear preferencia → abrir `CheckoutFlow`) al click, y esperar 5s + un solo chequeo tras la aprobación antes de confirmar el upgrade (el pago se activa por webhook async, no en la respuesta del pago).

**Tech Stack:** React Native / Expo, Zustand (`auth-store.js`, sin cambios de shape), TanStack Query (nuevo `useMutation`), `@mercadopago/sdk-react` (vía `CheckoutFlow` ya existente, sin cambios).

**Spec:** `docs/superpowers/specs/2026-09-03-payments-fase1-tier-upgrade-design.md`

## Global Constraints

- Contrato de backend verificado contra swagger real de
  `feature/suscripciones-tier-equipos` (sin mergear a `develop`,
  sujeto a cambio) — ver tabla de endpoints en la spec.
- `GET /tiers` (catálogo general) sigue sin `hierarchy` — el orden de
  las cards sigue por `tierAmount` ascendente, sin tocar ese criterio.
- `POST /payments/test-card-token` NO se integra en la UI — es
  herramienta de testing del compañero de backend, no un paso del
  frontend.
- Sin modal de confirmación propio antes de abrir el checkout — el
  Brick ya es el paso de confirmación.
- Confirmación post-pago: un solo chequeo a los 5 segundos (no
  polling en loop) con fallback a "puede tardar en reflejarse".
- `import { CheckoutFlow } from './checkout-flow';` **sin extensión**
  — Metro solo resuelve `.web.jsx` vs `.jsx` por plataforma cuando el
  specifier no trae extensión explícita (ver quirk en `CLAUDE.md`).
- Todo `View`/`Text`/`Pressable`/etc. nuevo lleva `nativeID`+`testID`
  únicos (regla `local/require-native-id`, sin excepción).
- Sin tests de render de componentes/hooks (convención del repo) — la
  pantalla se verifica manualmente, no con Jest.

---

### Task 1: Capa de datos — `tier-subscriptions.js` + normalizer

**Files:**
- Create: `services/tier-subscriptions.js`
- Create: `services/__mocks__/tier-subscriptions-mock.js`
- Modify: `services/normalizers.js` (agrega `toSubscriptionModel`, extiende `toCreatePreferencePayload`/`toProcessPaymentPayload`)
- Test: `__tests__/tier-subscriptions-mock.test.js`
- Test: `__tests__/normalizers.test.js` (agrega casos nuevos, no reemplaza los existentes)

**Interfaces:**
- Consumes: `api` default export de `services/api.js` (`api.get(path)`, `api.put(path, body)`), `USE_MOCKS` de `config/env.js` — ya existentes, sin cambios.
- Produces: `changeTier(userId, roleId, tierId): Promise<dto>`, `getCurrentSubscription(userId, roleId): Promise<dto>` (ambos en `services/tier-subscriptions.js`), `toSubscriptionModel(dto): {subscriptionId, subscriptionStatus, installmentId, installmentNumber, installmentAmount, nextDueDate, blockedDate, paidInstallments, tier: {id, name, hierarchy, paymentRequired} | null, role: {id, name} | null, mercadopago: {publicKey} | null} | null` (en `services/normalizers.js`) — Task 2 y Task 3 dependen de estas 3 funciones exactas.

- [ ] **Step 1: Escribir los tests de `toSubscriptionModel` (fallan)**

Abrir `__tests__/normalizers.test.js`. Al principio del archivo ya hay un import multilínea desde `../services/normalizers.js` (busca la línea que empieza con `toCreatePreferencePayload, toPreferenceResponseModel, toProcessPaymentPayload, toPaymentModel,`) — agregar `toSubscriptionModel` a esa lista de imports. Después del bloque `describe('toPaymentModel', ...)` existente (al final del archivo), agregar:

```javascript
describe('toSubscriptionModel', () => {
  test('maps a first_payment_pending subscription to camelCase', () => {
    const dto = {
      subscription_id: 77, subscription_status: 'first_payment_pending',
      installment_id: 501, installment_number: 1, installment_amount: 1500,
      next_due_date: null, blocked_date: null, paid_installments: 0,
      tier: { id: 11, name: 'premium', hierarchy: 2, payment_required: true },
      role: { id: 3, name: 'corredor' },
      mercadopago: { public_key: 'APP_USR-test' },
    };
    expect(toSubscriptionModel(dto)).toEqual({
      subscriptionId: 77, subscriptionStatus: 'first_payment_pending',
      installmentId: 501, installmentNumber: 1, installmentAmount: 1500,
      nextDueDate: null, blockedDate: null, paidInstallments: 0,
      tier: { id: 11, name: 'premium', hierarchy: 2, paymentRequired: true },
      role: { id: 3, name: 'corredor' },
      mercadopago: { publicKey: 'APP_USR-test' },
    });
  });

  test('maps a free-tier subscription (no installment fields) — tier/role only', () => {
    const dto = { tier: { id: 10, name: 'base', hierarchy: 1, payment_required: false }, role: { id: 3, name: 'corredor' } };
    const model = toSubscriptionModel(dto);
    expect(model.subscriptionId).toBeNull();
    expect(model.subscriptionStatus).toBeNull();
    expect(model.installmentId).toBeNull();
    expect(model.paidInstallments).toBe(0);
    expect(model.tier).toEqual({ id: 10, name: 'base', hierarchy: 1, paymentRequired: false });
  });

  test('tier and role default to null when absent', () => {
    const model = toSubscriptionModel({});
    expect(model.tier).toBeNull();
    expect(model.role).toBeNull();
    expect(model.mercadopago).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toSubscriptionModel(null)).toBeNull();
    expect(toSubscriptionModel(undefined)).toBeNull();
  });
});
```

Después, en el `describe('toCreatePreferencePayload', ...)` ya existente, agregar un test nuevo dentro (no tocar los que ya están):

```javascript
  test('incluye installment_id cuando viene', () => {
    const form = { concept: 'subscription', items: [{ title: 'Cuota', quantity: 1, unitPrice: 1500 }], installmentId: 501 };
    expect(toCreatePreferencePayload(form).installment_id).toBe(501);
  });

  test('omite installment_id si no viene', () => {
    const form = { concept: 'order', items: [{ title: 'Item', quantity: 1, unitPrice: 100 }] };
    expect(toCreatePreferencePayload(form).installment_id).toBeUndefined();
  });
```

Y en el `describe('toProcessPaymentPayload', ...)` ya existente:

```javascript
  test('incluye installment_id cuando viene', () => {
    const form = { token: 'tok', transactionAmount: 1500, paymentMethodId: 'master', installments: 1, payerEmail: 'a@b.com', installmentId: 501 };
    expect(toProcessPaymentPayload(form).installment_id).toBe(501);
  });

  test('omite installment_id si no viene', () => {
    const form = { token: 'tok', transactionAmount: 1000, paymentMethodId: 'visa', installments: 1, payerEmail: 'a@b.com' };
    expect(toProcessPaymentPayload(form).installment_id).toBeUndefined();
  });
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npm test -- normalizers.test.js`
Expected: FAIL — `toSubscriptionModel is not a function` (o `undefined`), y los nuevos casos de `installment_id` fallan porque el campo no se agrega todavía.

- [ ] **Step 3: Agregar `toSubscriptionModel` y extender los payloads en `services/normalizers.js`**

Ubicar el bloque de `toCreatePreferencePayload` (después de `toTierModel`, antes de `toPreferenceResponseModel`) y reemplazarlo por:

```javascript
export function toCreatePreferencePayload(form) {
  const payload = {
    concept: form.concept,
    items: form.items.map((item) => ({ title: item.title, quantity: item.quantity, unit_price: item.unitPrice })),
  };
  if (form.description) payload.description = form.description;
  if (form.installmentId) payload.installment_id = form.installmentId;
  return payload;
}
```

Ubicar `toProcessPaymentPayload` y reemplazarlo por:

```javascript
export function toProcessPaymentPayload(form) {
  const payload = {
    token: form.token,
    transaction_amount: form.transactionAmount,
    payment_method_id: form.paymentMethodId,
    installments: form.installments,
    payer_email: form.payerEmail,
  };
  if (form.preferenceId) payload.preference_id = form.preferenceId;
  if (form.installmentId) payload.installment_id = form.installmentId;
  return payload;
}
```

Al final del archivo (después de `toPaymentModel`), agregar:

```javascript
// Fase 1 de pagos — GET /users/{id}/subscriptions/current y la
// respuesta de PUT /users/{id}/roles/{role_id}/tier comparten
// exactamente el mismo shape (ChangeTierResponse ===
// CurrentSubscriptionResponse en el swagger), un solo normalizer sirve
// para las dos. Ver docs/superpowers/specs/2026-09-03-payments-fase1-tier-upgrade-design.md.
export function toSubscriptionModel(dto) {
  if (!dto) return null;
  return {
    subscriptionId: dto.subscription_id ?? null,
    subscriptionStatus: dto.subscription_status ?? null,
    installmentId: dto.installment_id ?? null,
    installmentNumber: dto.installment_number ?? null,
    installmentAmount: dto.installment_amount ?? null,
    nextDueDate: dto.next_due_date ?? null,
    blockedDate: dto.blocked_date ?? null,
    paidInstallments: dto.paid_installments ?? 0,
    tier: dto.tier ? {
      id: dto.tier.id,
      name: dto.tier.name,
      hierarchy: dto.tier.hierarchy ?? null,
      paymentRequired: Boolean(dto.tier.payment_required),
    } : null,
    role: dto.role ? { id: dto.role.id, name: dto.role.name } : null,
    mercadopago: dto.mercadopago ? { publicKey: dto.mercadopago.public_key } : null,
  };
}
```

- [ ] **Step 4: Correr los tests de normalizers, confirmar que pasan**

Run: `npm test -- normalizers.test.js`
Expected: PASS, todos los tests (viejos y nuevos).

- [ ] **Step 5: Crear el mock — `services/__mocks__/tier-subscriptions-mock.js`**

```javascript
// Simula el ciclo de suscripción de Fase 1 para EXPO_PUBLIC_USE_MOCKS=true.
// A diferencia del backend real, NO activa la suscripción sola tras un
// pago aprobado (no hay webhook que simular acá) — queda en
// first_payment_pending hasta que algo llame
// __mockActivateSubscription explícitamente. Esto es deliberado: deja
// que la UI de "puede tardar en reflejarse" (ver
// tier-upgrade-screen.jsx) se ejerza en modo mock sin depender de
// infraestructura de webhook, igual que en local contra el backend
// real sin túnel.
let mockSubscriptions = {};
let nextSubscriptionId = 1;
let nextInstallmentId = 1;

function key(userId, roleId) {
  return `${userId}:${roleId}`;
}

// Catálogo mínimo de tiers pagos — coincide con los ids/montos de
// services/__mocks__/tiers-mock.js (id 2 = premium corredor, id 4 =
// premium entrenador).
const MOCK_PAID_TIERS_BY_ID = {
  2: { id: 2, name: 'premium', hierarchy: 2, paymentRequired: true, amount: 4999, roleId: 1, roleName: 'corredor' },
  4: { id: 4, name: 'premium', hierarchy: 2, paymentRequired: true, amount: 9999, roleId: 2, roleName: 'entrenador' },
};

export async function mockChangeTier(userId, roleId, tierId) {
  const tier = MOCK_PAID_TIERS_BY_ID[tierId];
  if (!tier) {
    const error = new Error('Tier no encontrado.');
    error.status = 404;
    throw error;
  }
  const k = key(userId, roleId);
  const existing = mockSubscriptions[k];
  if (existing?.subscription_status === 'first_payment_pending') {
    const error = new Error('Ya hay una cuota #1 sin pagar.');
    error.status = 409;
    error.code = 'SUBSCRIPTION_PENDING_FIRST_PAYMENT';
    throw error;
  }
  const subscription = {
    subscription_id: nextSubscriptionId++,
    subscription_status: 'first_payment_pending',
    installment_id: nextInstallmentId++,
    installment_number: 1,
    installment_amount: tier.amount,
    next_due_date: null,
    blocked_date: null,
    paid_installments: 0,
    tier: { id: tier.id, name: tier.name, hierarchy: tier.hierarchy, payment_required: tier.paymentRequired },
    role: { id: roleId, name: tier.roleName },
    mercadopago: { public_key: 'TEST-mock-public-key' },
  };
  mockSubscriptions[k] = subscription;
  return subscription;
}

export async function mockGetCurrentSubscription(userId, roleId) {
  const k = key(userId, roleId);
  if (mockSubscriptions[k]) return mockSubscriptions[k];
  return { tier: { id: null, name: 'base', hierarchy: 1, payment_required: false }, role: { id: roleId, name: null } };
}

// Helper de testing manual (no lo llama la UI) — simula la activación
// que en el backend real dispara el webhook de Mercado Pago.
export function __mockActivateSubscription(userId, roleId) {
  const k = key(userId, roleId);
  const sub = mockSubscriptions[k];
  if (!sub) return;
  sub.subscription_status = 'active';
  sub.paid_installments = 1;
  sub.installment_id = nextInstallmentId++;
  sub.installment_number = 2;
  sub.next_due_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  sub.blocked_date = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString();
}

export function __resetMockSubscriptions() {
  mockSubscriptions = {};
  nextSubscriptionId = 1;
  nextInstallmentId = 1;
}
```

- [ ] **Step 6: Crear `services/tier-subscriptions.js`**

```javascript
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockChangeTier, mockGetCurrentSubscription } from './__mocks__/tier-subscriptions-mock.js';

// PUT /api/v1/users/{id}/roles/{role_id}/tier — cambia de tier; si el
// tier target es pago, el backend cierra la suscripción vigente y crea
// una nueva en first_payment_pending con su cuota #1. Ver
// docs/superpowers/specs/2026-09-03-payments-fase1-tier-upgrade-design.md.
export async function changeTier(userId, roleId, tierId) {
  if (USE_MOCKS) return await mockChangeTier(userId, roleId, tierId);
  return await api.put(`/users/${userId}/roles/${roleId}/tier`, { tier_id: tierId });
}

// GET /api/v1/users/{id}/subscriptions/current?role_id= — cuota a
// pagar (si hay) + public_key para el Bricks. Tiers gratis devuelven
// solo tier/role, sin cuota (ver toSubscriptionModel).
export async function getCurrentSubscription(userId, roleId) {
  if (USE_MOCKS) return await mockGetCurrentSubscription(userId, roleId);
  return await api.get(`/users/${userId}/subscriptions/current?role_id=${encodeURIComponent(roleId)}`);
}
```

- [ ] **Step 7: Escribir el test del mock — `__tests__/tier-subscriptions-mock.test.js`**

```javascript
import {
  mockChangeTier, mockGetCurrentSubscription, __mockActivateSubscription, __resetMockSubscriptions,
} from '../services/__mocks__/tier-subscriptions-mock.js';

beforeEach(() => {
  __resetMockSubscriptions();
});

describe('mockChangeTier', () => {
  test('crea una suscripción first_payment_pending con cuota #1', async () => {
    const sub = await mockChangeTier(42, 3, 2);
    expect(sub.subscription_status).toBe('first_payment_pending');
    expect(sub.installment_number).toBe(1);
    expect(sub.installment_amount).toBe(4999);
    expect(sub.tier.name).toBe('premium');
  });

  test('rechaza con 409 si ya hay una cuota #1 pendiente', async () => {
    await mockChangeTier(42, 3, 2);
    await expect(mockChangeTier(42, 3, 2)).rejects.toMatchObject({ status: 409, code: 'SUBSCRIPTION_PENDING_FIRST_PAYMENT' });
  });

  test('rechaza con 404 si el tier no existe', async () => {
    await expect(mockChangeTier(42, 3, 999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('mockGetCurrentSubscription', () => {
  test('sin suscripción previa, devuelve tier base sin cuota', async () => {
    const sub = await mockGetCurrentSubscription(42, 3);
    expect(sub.tier.name).toBe('base');
    expect(sub.installment_id).toBeUndefined();
  });

  test('tras mockChangeTier, refleja la suscripción pendiente', async () => {
    await mockChangeTier(42, 3, 2);
    const sub = await mockGetCurrentSubscription(42, 3);
    expect(sub.subscription_status).toBe('first_payment_pending');
  });
});

describe('__mockActivateSubscription', () => {
  test('pasa la suscripción a active y genera la cuota #2', async () => {
    await mockChangeTier(42, 3, 2);
    __mockActivateSubscription(42, 3);
    const sub = await mockGetCurrentSubscription(42, 3);
    expect(sub.subscription_status).toBe('active');
    expect(sub.paid_installments).toBe(1);
    expect(sub.installment_number).toBe(2);
  });

  test('no-op si no hay suscripción previa', () => {
    expect(() => __mockActivateSubscription(42, 3)).not.toThrow();
  });
});
```

- [ ] **Step 8: Correr todos los tests, confirmar que pasan**

Run: `npm test`
Expected: PASS, todos los test suites (incluyendo los nuevos).

- [ ] **Step 9: Commit**

```bash
git add services/tier-subscriptions.js services/__mocks__/tier-subscriptions-mock.js services/normalizers.js __tests__/tier-subscriptions-mock.test.js __tests__/normalizers.test.js
git commit -m "feat(payments): add tier-subscriptions service, mock and normalizer"
```

---

### Task 2: Hook — `use-tier-subscription.js`

**Files:**
- Create: `hooks/use-tier-subscription.js`

**Interfaces:**
- Consumes: `changeTier`, `getCurrentSubscription` de `services/tier-subscriptions.js`, `toSubscriptionModel` de `services/normalizers.js` (Task 1).
- Produces: `useTierSubscription(userId, roleId)` → `{ subscription: SubscriptionModel | null, isLoading: boolean, refetchSubscription: () => Promise<{data: SubscriptionModel | null}>, changeTier: (tierId: number) => Promise<SubscriptionModel>, isChangingTier: boolean }` — Task 3 consume esto tal cual.

Sin test dedicado (convención del repo: sin tests de render de
componentes/hooks — ver `use-team-roster.js`, tampoco tiene). Se
verifica por lectura del código y por el uso real en Task 3.

- [ ] **Step 1: Crear `hooks/use-tier-subscription.js`**

```javascript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changeTier as changeTierService, getCurrentSubscription } from '../services/tier-subscriptions.js';
import { toSubscriptionModel } from '../services/normalizers.js';

// Estado de servidor del dominio de suscripción/cuotas — TanStack
// Query, no Zustand (ver CLAUDE.md "Estado de aplicación vs. de
// servidor"), mismo criterio que hooks/use-team-roster.js. Primer
// useMutation real del repo: al cambiar de tier, el resultado ya trae
// la suscripción actualizada — se escribe directo en el cache con
// setQueryData en vez de invalidar + esperar un refetch de red.
export function useTierSubscription(userId, roleId) {
  const queryClient = useQueryClient();
  const queryKey = ['subscription-current', userId, roleId];

  const subscriptionQuery = useQuery({
    queryKey,
    queryFn: () => getCurrentSubscription(userId, roleId).then(toSubscriptionModel),
    enabled: Boolean(userId) && Boolean(roleId),
  });

  const changeTierMutation = useMutation({
    mutationFn: (tierId) => changeTierService(userId, roleId, tierId).then(toSubscriptionModel),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    subscription: subscriptionQuery.data ?? null,
    isLoading: subscriptionQuery.isLoading,
    refetchSubscription: subscriptionQuery.refetch,
    changeTier: changeTierMutation.mutateAsync,
    isChangingTier: changeTierMutation.isPending,
  };
}
```

- [ ] **Step 2: Verificar que no rompe nada existente**

Run: `npm test && npm run lint`
Expected: PASS/limpio — este archivo no tiene test propio, pero no debe romper la suite existente (import/export bien formado, sin efectos colaterales en el resto del repo).

- [ ] **Step 3: Commit**

```bash
git add hooks/use-tier-subscription.js
git commit -m "feat(payments): add useTierSubscription hook (Query + first mutation)"
```

---

### Task 3: Extender `CheckoutFlow` para llevar `installment_id`

El doc del backend muestra `installment_id` también en el body de
`POST /payments` (no solo en la preferencia) — `CheckoutFlow` (Fase 0)
no tiene forma de recibirlo hoy. Se agrega como prop opcional en las 3
piezas de la cadena — nativo, web, y la página web standalone que el
WebView nativo carga — sin romper los usos existentes de Fase 0
(`payments-testbed-screen.jsx` no pasa `installmentId`, sigue
funcionando igual, `toProcessPaymentPayload` ya lo trata como opcional
desde Task 1).

**Files:**
- Modify: `components/payments/checkout-flow.web.jsx`
- Modify: `components/payments/checkout-flow.jsx`
- Modify: `components/payments/checkout-web-page.jsx`

**Interfaces:**
- Consumes: `toProcessPaymentPayload` con `installmentId` opcional (Task 1).
- Produces: `CheckoutFlow({preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError, onCancel})` — nueva prop opcional `installmentId` en ambas variantes (nativa y web), mismo nombre en las dos. Task 4 pasa `installmentId={checkoutData.installmentId}`.

- [ ] **Step 1: `checkout-flow.web.jsx` — sumar `installmentId` al payload del pago**

En `components/payments/checkout-flow.web.jsx`, cambiar la firma de la función:

```javascript
export function CheckoutFlow({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError }) {
```

Y en `handleSubmit`, agregar `installmentId` al objeto que arma `toProcessPaymentPayload`:

```javascript
  const handleSubmit = ({ formData }) => processPayment(toProcessPaymentPayload({
    token: formData.token,
    transactionAmount: formData.transaction_amount,
    paymentMethodId: formData.payment_method_id,
    installments: formData.installments,
    payerEmail: formData.payer.email,
    preferenceId,
    installmentId,
  }))
```

También actualizar el comentario del archivo (dice hoy "la firma no
cambia entre Fase 0/1/2") — reemplazar esa frase por: "la firma se
extiende entre fases (Fase 1 suma `installmentId` opcional), nunca se
rompe — Fase 0 sigue funcionando sin pasarlo".

- [ ] **Step 2: `checkout-flow.jsx` (nativo) — sumar `installmentId` a la URL del WebView**

En `components/payments/checkout-flow.jsx`, cambiar la firma:

```javascript
export function CheckoutFlow({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError, onCancel }) {
```

Y en la construcción de `queryParams`:

```javascript
  const queryParams = new URLSearchParams({
    preferenceId,
    publicKey,
    amount: String(amount),
    ...(installmentId ? { installmentId: String(installmentId) } : {}),
    ...(marketplace ? { marketplace: 'true' } : {}),
  });
```

- [ ] **Step 3: `checkout-web-page.jsx` — leer `installmentId` del query param y pasarlo**

En `components/payments/checkout-web-page.jsx`, en el `<CheckoutFlow>` que renderiza, agregar:

```javascript
      <CheckoutFlow
        amount={Number(params.amount)}
        installmentId={params.installmentId ? Number(params.installmentId) : undefined}
        marketplace={params.marketplace === 'true'}
        onApproved={(payment) => postToNative({ status: 'approved', payment })}
        onError={(error) => postToNative({ status: 'error', message: error?.message ?? 'Error desconocido' })}
        preferenceId={params.preferenceId}
        publicKey={params.publicKey}
      />
```

- [ ] **Step 4: Correr tests y lint**

Run: `npm test && npm run lint`
Expected: PASS / limpio — ninguno de estos 3 archivos tiene test propio (son componentes, sin tests de render), pero no deben romper la suite existente.

- [ ] **Step 5: Commit**

```bash
git add components/payments/checkout-flow.web.jsx components/payments/checkout-flow.jsx components/payments/checkout-web-page.jsx
git commit -m "feat(payments): thread installment_id through CheckoutFlow"
```

---

### Task 4: Reescribir `tier-upgrade-screen.jsx` — flujo real de upgrade

**Files:**
- Modify: `components/profile/tier-upgrade-screen.jsx` (reescritura completa del archivo)

**Interfaces:**
- Consumes: `useTierSubscription(userId, roleId)` (Task 2) — `{subscription, isLoading, refetchSubscription, changeTier, isChangingTier}`; `listTiers` (`services/tiers.js`, sin cambios); `toTierModel`, `toCreatePreferencePayload`, `toPreferenceResponseModel` (`services/normalizers.js`); `createPreference` (`services/payments.js`, sin cambios); `CheckoutFlow` con prop `installmentId` (Task 3, `components/payments/checkout-flow.jsx`/`.web.jsx` — **importar sin extensión**: `from '../payments/checkout-flow'`); `useAuthStore` (`user`, `roles`, `activeRole`, `fetchPermissions` — todos ya existen, sin cambios de store).
- Produces: nada nuevo para otras tasks — es el punto final de la cadena.

Sin test dedicado (pantalla, sin tests de render — convención del
repo). Verificación manual al final del task (ver Step 6).

- [ ] **Step 1: Leer el archivo actual completo**

`components/profile/tier-upgrade-screen.jsx` tiene hoy 151 líneas —
`TierCard` (pill "Tier actual" o "Próximamente") + `TierUpgradeScreen`
(fetch de `listTiers()` con `useState`/`useEffect` plano, filtro por
rol activo). Se reescribe entero — no hay forma de hacerlo incremental
sin dejar el archivo en un estado inconsistente a mitad de camino.

- [ ] **Step 2: Reemplazar el contenido completo de `tier-upgrade-screen.jsx`**

```javascript
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTierSubscription } from '../../hooks/use-tier-subscription.js';
import { listTiers } from '../../services/tiers.js';
import { createPreference } from '../../services/payments.js';
import { toTierModel, toCreatePreferencePayload, toPreferenceResponseModel } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';
// Sin extensión a propósito: Metro solo aplica resolución por
// plataforma (.web.jsx antes que .jsx) cuando el specifier no trae
// extensión — ver quirk en CLAUDE.md.
import { CheckoutFlow } from '../payments/checkout-flow';

const ROLE_LABEL = { runner: 'Corredor', trainer: 'Entrenador' };

function formatTierPrice(tierAmount, paymentRequired) {
  if (!paymentRequired || !tierAmount) return 'Gratis';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tierAmount);
}

// Card de un tier — "Tier actual" si coincide con roles[].tier del rol
// activo; si no y es un tier pago, botón "Mejorar" que dispara el
// flujo real (ver handleUpgrade en TierUpgradeScreen). Tiers gratis
// que no son el actual (no debería pasar hoy, 1 solo tier gratis por
// rol) no muestran ninguna acción.
function TierCard({ tier, isCurrent, isDesktopWeb, loading, onUpgrade }) {
  const colors = useThemeColors();
  const idPrefix = `tier-card-${tier.id}`;
  return (
    <View
      className={`rounded-2xl border p-5 ${isCurrent ? 'border-primary bg-primary-tint dark:bg-primary/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface'} ${isDesktopWeb ? 'w-[31%]' : 'w-full'}`}
      nativeID={idPrefix}
      testID={idPrefix}
    >
      <Text className="text-base font-bold capitalize text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
        {tier.name}
      </Text>
      <View className="mt-1 flex-row items-baseline gap-1" nativeID={`${idPrefix}-price-row`} testID={`${idPrefix}-price-row`}>
        <Text className="text-lg font-bold text-primary" nativeID={`${idPrefix}-price`} testID={`${idPrefix}-price`}>
          {formatTierPrice(tier.tierAmount, tier.paymentRequired)}
        </Text>
        {tier.paymentRequired && (
          <Text className="text-xs font-medium text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-price-period`} testID={`${idPrefix}-price-period`}>
            /mes
          </Text>
        )}
      </View>
      {tier.description && (
        <Text className="mt-3 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-description`} testID={`${idPrefix}-description`}>
          {tier.description}
        </Text>
      )}

      {isCurrent ? (
        <View className="mt-4 h-10 flex-row items-center justify-center gap-2 rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`${idPrefix}-current-badge`} testID={`${idPrefix}-current-badge`}>
          <MaterialCommunityIcons color="#8cc63e" name="check-circle" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-on-primary-tint dark:text-primary" nativeID={`${idPrefix}-current-badge-label`} testID={`${idPrefix}-current-badge-label`}>
            Tier actual
          </Text>
        </View>
      ) : tier.paymentRequired ? (
        <Pressable
          className={`mt-4 h-10 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${loading ? 'opacity-60' : ''}`}
          disabled={loading}
          nativeID={`${idPrefix}-upgrade-button`}
          onPress={() => onUpgrade(tier)}
          testID={`${idPrefix}-upgrade-button`}
        >
          {loading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-upgrade-button-label`} testID={`${idPrefix}-upgrade-button-label`}>
              Mejorar
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

// Banner de pago pendiente — aparece si ya existe una suscripción
// first_payment_pending (el usuario cambió de tier antes pero nunca
// completó/confirmó el pago). Lleva directo al checkout reusando la
// cuota existente, sin volver a llamar changeTier.
function PendingPaymentBanner({ subscription, onResume, loading }) {
  return (
    <View className="mb-4 flex-row items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20" nativeID="tier-upgrade-pending-banner" testID="tier-upgrade-pending-banner">
      <View className="flex-1" nativeID="tier-upgrade-pending-banner-text" testID="tier-upgrade-pending-banner-text">
        <Text className="text-sm font-semibold text-amber-800 dark:text-amber-300" nativeID="tier-upgrade-pending-banner-title" testID="tier-upgrade-pending-banner-title">
          Tenés un pago pendiente
        </Text>
        <Text className="mt-0.5 text-xs text-amber-700 dark:text-amber-400" nativeID="tier-upgrade-pending-banner-subtitle" testID="tier-upgrade-pending-banner-subtitle">
          {formatTierPrice(subscription.installmentAmount, true)} para activar {subscription.tier?.name}
        </Text>
      </View>
      <Pressable
        className={`h-9 flex-row items-center justify-center rounded-full bg-amber-600 px-4 ${loading ? 'opacity-60' : ''}`}
        disabled={loading}
        nativeID="tier-upgrade-pending-banner-button"
        onPress={onResume}
        testID="tier-upgrade-pending-banner-button"
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text className="text-xs font-semibold uppercase tracking-wide text-white" nativeID="tier-upgrade-pending-banner-button-label" testID="tier-upgrade-pending-banner-button-label">
            Completar pago
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export function TierUpgradeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isDesktopWeb = isWeb && !isNarrowWeb;
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);
  const user = useAuthStore((s) => s.user);
  const fetchPermissions = useAuthStore((s) => s.fetchPermissions);

  const currentRoleName = activeRole === 'runner' ? 'corredor' : 'entrenador';
  const currentTierName = roles.find((r) => r.name === currentRoleName)?.tier;
  const currentRoleId = roles.find((r) => r.name === currentRoleName)?.id;

  const { data: tierDtos, isLoading: loadingTiers } = useQuery({
    queryKey: ['tiers-catalog'],
    queryFn: listTiers,
  });
  const tiers = (tierDtos ?? []).map(toTierModel);

  const { subscription, refetchSubscription, changeTier, isChangingTier } = useTierSubscription(user?.userId, currentRoleId);

  const [processingTierId, setProcessingTierId] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const roleTiers = tiers
    .filter((t) => t.roleName === currentRoleName)
    .sort((a, b) => a.tierAmount - b.tierAmount);

  const startCheckout = ({ installmentId, amount, tierId }) => {
    setProcessingTierId(tierId);
    createPreference(toCreatePreferencePayload({
      concept: 'subscription',
      description: 'Cuota de suscripción de tier',
      items: [{ title: 'Cuota mensual de tier', quantity: 1, unitPrice: amount }],
      installmentId,
    }))
      .then((dto) => {
        const preference = toPreferenceResponseModel(dto);
        setCheckoutData({ preferenceId: preference.preferenceId, publicKey: preference.publicKey, amount, tierId, installmentId });
      })
      .catch((error) => {
        Toast.show({ type: 'error', text1: 'No pudimos iniciar el pago', text2: error.message });
      })
      .finally(() => setProcessingTierId(null));
  };

  const handleUpgrade = async (tier) => {
    setProcessingTierId(tier.id);
    try {
      const sub = await changeTier(Number(tier.id));
      startCheckout({ installmentId: sub.installmentId, amount: sub.installmentAmount, tierId: sub.tier.id });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos cambiar de tier', text2: error.message });
      setProcessingTierId(null);
    }
  };

  const handleResumePending = () => {
    if (!subscription) return;
    startCheckout({ installmentId: subscription.installmentId, amount: subscription.installmentAmount, tierId: subscription.tier.id });
  };

  const handleApproved = async () => {
    const expectedTierId = checkoutData?.tierId;
    setCheckoutData(null);
    setConfirming(true);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const { data } = await refetchSubscription();
      if (data?.subscriptionStatus === 'active' && data?.tier?.id === expectedTierId) {
        Toast.show({ type: 'success', text1: 'Tier actualizado', text2: `Ahora tenés ${data.tier.name}.` });
        await fetchPermissions();
      } else {
        Toast.show({ type: 'info', text1: 'Tu pago fue recibido', text2: 'Puede tardar unos minutos en reflejarse.' });
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleCheckoutError = (error) => {
    setCheckoutData(null);
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  const handleCheckoutCancel = () => {
    setCheckoutData(null);
  };

  const loading = loadingTiers;
  const showPendingBanner = subscription?.subscriptionStatus === 'first_payment_pending';

  return (
    <ScrollView
      nativeID="tier-upgrade-screen-scroll"
      testID="tier-upgrade-screen-scroll"
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      showsVerticalScrollIndicator={false}
    >
      <View nativeID="tier-upgrade-screen-container" testID="tier-upgrade-screen-container" className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View nativeID="tier-upgrade-screen-header" testID="tier-upgrade-screen-header" className="mb-8 flex-row items-center gap-2">
          <Pressable
            nativeID="tier-upgrade-screen-back-button"
            testID="tier-upgrade-screen-back-button"
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            onPress={() => router.replace('/profile')}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text nativeID="tier-upgrade-screen-back-label" testID="tier-upgrade-screen-back-label" className="text-sm font-medium text-slate-500 dark:text-slate-400">Mi perfil</Text>
          </Pressable>
          <Text nativeID="tier-upgrade-screen-breadcrumb-separator" testID="tier-upgrade-screen-breadcrumb-separator" className="text-sm text-slate-400 dark:text-slate-600">/</Text>
          <Text nativeID="tier-upgrade-screen-title" testID="tier-upgrade-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} className="text-xl text-slate-900 dark:text-white">
            Mejorar tier
          </Text>
        </View>

        {showPendingBanner && (
          <PendingPaymentBanner loading={processingTierId !== null} onResume={handleResumePending} subscription={subscription} />
        )}

        {confirming && (
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="tier-upgrade-confirming-banner" testID="tier-upgrade-confirming-banner">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-sm text-slate-600 dark:text-slate-300" nativeID="tier-upgrade-confirming-banner-label" testID="tier-upgrade-confirming-banner-label">
              Confirmando pago…
            </Text>
          </View>
        )}

        <SectionCard icon="star-four-points" title={`Tiers de ${ROLE_LABEL[activeRole]}`}>
          {loading ? (
            <View className="items-center py-6" nativeID="tier-upgrade-screen-loading" testID="tier-upgrade-screen-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : roleTiers.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="tier-upgrade-screen-empty" testID="tier-upgrade-screen-empty">
              Todavía no hay tiers configurados para este rol.
            </Text>
          ) : (
            <View className={isDesktopWeb ? 'flex-row flex-wrap gap-4' : 'gap-3'} nativeID="tier-upgrade-screen-cards" testID="tier-upgrade-screen-cards">
              {roleTiers.map((tier) => (
                <TierCard
                  isCurrent={tier.name === currentTierName}
                  isDesktopWeb={isDesktopWeb}
                  key={tier.id}
                  loading={isChangingTier && processingTierId === tier.id}
                  onUpgrade={handleUpgrade}
                  tier={tier}
                />
              ))}
            </View>
          )}
        </SectionCard>

        {checkoutData && (
          <SectionCard icon="credit-card-outline" title="Checkout">
            <CheckoutFlow
              amount={checkoutData.amount}
              installmentId={checkoutData.installmentId}
              key={checkoutData.preferenceId}
              onApproved={handleApproved}
              onCancel={handleCheckoutCancel}
              onError={handleCheckoutError}
              preferenceId={checkoutData.preferenceId}
              publicKey={checkoutData.publicKey}
            />
          </SectionCard>
        )}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Correr tests y lint**

Run: `npm test && npm run lint`
Expected: PASS / limpio. Ningún test debería romperse — este archivo no tenía test propio antes ni lo tiene ahora.

- [ ] **Step 4: Commit**

```bash
git add components/profile/tier-upgrade-screen.jsx
git commit -m "feat(payments): wire real tier-upgrade flow (change tier + checkout + confirm)"
```

- [ ] **Step 5: Verificación manual con mocks**

Con `EXPO_PUBLIC_USE_MOCKS=true`, `npx expo start` (web): ir a
`/profile/tier-upgrade`, click "Mejorar" en el tier premium → se abre
el Brick de Mercado Pago (sandbox) dentro de la `SectionCard`
"Checkout" → completar con cualquier dato de prueba del Brick →
aprobado → banner "Confirmando pago…" ~5s → como el mock no activa
sola la suscripción (ver Task 1 Step 5), debería caer en el fallback
"Tu pago fue recibido, puede tardar unos minutos en reflejarse" — es
el comportamiento esperado en mock, no un bug. Recargar la pantalla:
debería verse el banner ámbar "Tenés un pago pendiente" (la
suscripción quedó en `first_payment_pending`).

- [ ] **Step 6: Verificación manual contra backend real (local)**

Con el backend local del compañero corriendo y
`EXPO_PUBLIC_API_URL=http://192.168.1.4:8080/api/v1` (sin
`USE_MOCKS`): mismo flujo, tarjeta de sandbox
`5031755734530604`/`11/2030`/`123`. Si el webhook no llega solo (sin
túnel a localhost), usar el request de Bruno "Simular webhook MP" que
compartió el compañero, y volver a entrar a la pantalla para confirmar
que el banner pendiente desaparece y la card muestra "Tier actual" en
el tier pago.

---

### Task 5: Version bump + cierre de rama

**Files:**
- Modify: `package.json` (campo `version`)
- Modify: `package-lock.json` (campos `version`, líneas 2-3 del archivo — nombre+versión del paquete raíz, **no** tocar ninguna otra ocurrencia de una versión igual que pertenezca a una dependencia de terceros)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: nada — último task de la rama.

- [ ] **Step 1: Bump de versión**

`package.json` tiene hoy `"version": "0.7.0"`. Cambiar a
`"version": "0.8.0"` (bump menor — feature real y visible: primer
flujo de pago end-to-end del repo, no un fix chico). En
`package-lock.json`, cambiar **únicamente** las dos ocurrencias de
`"version": "0.7.0"` en las primeras 10 líneas del archivo (la raíz del
paquete `paceron-frontend`, aparece 2 veces: una en el nivel superior
del JSON y otra dentro de `packages[""]`) — **no** tocar ninguna otra
ocurrencia de `"version": "0.7.0"` en el resto del archivo (son de
dependencias de terceros que coinciden de casualidad en el número).
Nunca correr `npm install` para este bump — reescribe el lockfile
entero sin necesidad.

- [ ] **Step 2: Correr toda la suite una vez más**

Run: `npm test && npm run lint`
Expected: PASS / limpio.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to 0.8.0"
```
