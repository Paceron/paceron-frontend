# Fase 0 de pagos — catálogo de tiers + plomería de checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el placeholder de "Mejorar tier" por un catálogo real de tiers (`GET /tiers`), y construir la plomería de checkout de Fase 0 (`services/payments.js` + `CheckoutFlow` reusable) probada solo con mocks — sin conectar el botón de pago a nada real todavía y sin verificación en vivo contra Mercado Pago (el backend no tiene sandbox configurado aún).

**Architecture:** Dos piezas independientes que no dependen una de la otra. El catálogo de tiers es fetch directo (sin store, sin Zustand) contra un servicio nuevo `services/tiers.js`. La plomería de pagos es `services/payments.js` + un componente `CheckoutFlow` con split por archivo (`.web.jsx` real con `@mercadopago/sdk-react`, `.jsx` nativo placeholder), montado desde una pantalla-testbed sin entrada de navegación. Ambas siguen el patrón `USE_MOCKS` ya establecido en todo el repo (`services/teams.js`, `services/trainingPlans.js`).

**Tech Stack:** Expo/React Native + React Native Web, Zustand (no se agrega ninguno nuevo en este plan), `@mercadopago/sdk-react` (dependencia nueva, solo rama web), Jest.

**Spec:** `docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md`

## Global Constraints

- `public_key` de Mercado Pago viaja **dinámico** en la respuesta de `POST /payments/preference` — no se crea ninguna env var nueva (corrige al spec de 2026-08-12).
- Entrada de menú/link "Mejorar tier" queda **fija**, sin sufijo de rol (antes `"Mejorar tier de {roleLabel}"`).
- El botón de cada tier card que **no** es el tier actual del usuario queda **"Próximamente"** (deshabilitado) — ninguna card dispara un pago real en esta entrega.
- `GET /tiers` no filtra por rol en el backend — el filtro por rol activo se hace **client-side**.
- Sin `hierarchy` en el backend todavía — las cards se ordenan por `tierAmount` ascendente.
- Ni tiers ni pagos usan un store Zustand nuevo — fetch directo con `useState`/`useEffect` en el componente que los consume (dominio de una sola pantalla cada uno, no hay estado compartido entre pantallas que lo justifique).
- `CheckoutFlow` tiene split por archivo (`.web.jsx`/`.jsx`), mismo patrón que `app/(tabs)/index.jsx`/`index.web.jsx` — la rama nativa es un placeholder "Próximamente en la app" (pill `clock-outline`/`bg-slate-100`), no un throw.
- Pantalla-testbed sin entrada en `routes/catalog.js` — solo alcanzable tipeando la URL.
- Todo componente visual (`View`/`Text`/`Pressable`/etc., incluidas sus variantes `Animated.*`) lleva `nativeID` y `testID` únicos — regla obligatoria del proyecto (`local/require-native-id`), sin excepción salvo spread de props.
- Sin tests de render de componentes — convención del proyecto. Cobertura vía tests de servicio, mock y normalizers.
- `npm test` y `npm run lint` en verde antes de cerrar cada tarea.

---

### Task 1: Servicio de tiers (`services/tiers.js` + mock + normalizer)

**Files:**
- Create: `services/__mocks__/tiers-mock.js`
- Create: `services/tiers.js`
- Modify: `services/normalizers.js` (agrega `toTierModel` al final del archivo)
- Test: `__tests__/tiers-mock.test.js`
- Test: `__tests__/normalizers.test.js` (agrega tests de `toTierModel`, extiende el import de arriba)

**Interfaces:**
- Produces: `listTiers()` (async, sin args, devuelve array de DTOs snake_case tal cual `TierResponse` del backend) desde `services/tiers.js`. `toTierModel(dto)` desde `services/normalizers.js` → `{id: string, name: string, description: string|null, paymentRequired: boolean, roleId: number, roleName: string, tierAmount: number}`.

- [ ] **Step 1: Escribir el mock con datos sembrados**

```js
// services/__mocks__/tiers-mock.js
// Catálogo de tiers — GET /api/v1/tiers ya es un endpoint real del
// backend (no es parte de Fase 0/1/2 de pagos, existe desde antes), pero
// sin consumidor en el frontend hasta ahora. Sin filtro de rol en el
// backend: devuelve todos los tiers de todos los roles, el filtro por
// rol activo se hace client-side (ver
// components/profile/tier-upgrade-screen.jsx). Mismo patrón in-memory
// que el resto de los mocks del repo (teams-mock.js).
function buildSeedTiers() {
  const now = new Date().toISOString();
  return [
    {
      id: 1, name: 'base', description: 'Acceso a equipos, grupos e invitaciones — todo lo esencial de Paceron para arrancar a correr.',
      payment_required: false, role_id: 1, role_name: 'corredor', tier_amount: 0,
      created_at: now, updated_at: now,
    },
    {
      id: 2, name: 'premium', description: 'Estadísticas avanzadas de entrenamiento, prioridad en invitaciones y soporte directo con tu entrenador.',
      payment_required: true, role_id: 1, role_name: 'corredor', tier_amount: 4999,
      created_at: now, updated_at: now,
    },
    {
      id: 3, name: 'base', description: 'Gestión de un equipo, grupos ilimitados e invitaciones — todo lo esencial para arrancar a entrenar corredores.',
      payment_required: false, role_id: 2, role_name: 'entrenador', tier_amount: 0,
      created_at: now, updated_at: now,
    },
    {
      id: 4, name: 'premium', description: 'Más de un equipo, límite de corredores ampliado y planes de entrenamiento sin restricciones.',
      payment_required: true, role_id: 2, role_name: 'entrenador', tier_amount: 9999,
      created_at: now, updated_at: now,
    },
  ];
}

const mockTiers = buildSeedTiers();

export async function mockListTiers() {
  return [...mockTiers];
}
```

- [ ] **Step 2: Servicio real+mock**

```js
// services/tiers.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockListTiers } from './__mocks__/tiers-mock.js';

// GET /api/v1/tiers — endpoint real ya existente (no es parte del
// dominio de pagos, es del sistema de roles/tiers). Sin parámetro de
// filtro por rol en el backend — devuelve todos los tiers de todos los
// roles, el caller filtra por rol activo (ver
// components/profile/tier-upgrade-screen.jsx).
export async function listTiers() {
  if (USE_MOCKS) return await mockListTiers();
  return await api.get('/tiers');
}
```

- [ ] **Step 3: Normalizer**

Agregar al final de `services/normalizers.js`:

```js
// ---------------------------------------------------------------------
// Tiers — catálogo real GET /api/v1/tiers (ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md).
// ---------------------------------------------------------------------

export function toTierModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description ?? null,
    paymentRequired: Boolean(dto.payment_required),
    roleId: dto.role_id,
    roleName: dto.role_name,
    tierAmount: dto.tier_amount ?? 0,
  };
}
```

- [ ] **Step 4: Tests del mock**

```js
// __tests__/tiers-mock.test.js
import { mockListTiers } from '../services/__mocks__/tiers-mock.js';

describe('mockListTiers', () => {
  test('devuelve tiers de ambos roles, sin filtrar', async () => {
    const tiers = await mockListTiers();
    expect(tiers.length).toBeGreaterThanOrEqual(4);
    expect(tiers.some((t) => t.role_name === 'corredor')).toBe(true);
    expect(tiers.some((t) => t.role_name === 'entrenador')).toBe(true);
  });

  test('incluye un tier base gratis y uno premium pago por rol', async () => {
    const tiers = await mockListTiers();
    const corredorTiers = tiers.filter((t) => t.role_name === 'corredor');
    expect(corredorTiers.find((t) => t.name === 'base').payment_required).toBe(false);
    expect(corredorTiers.find((t) => t.name === 'premium').payment_required).toBe(true);
  });
});
```

- [ ] **Step 5: Test del normalizer**

Extender el import de `__tests__/normalizers.test.js`:

```js
import {
  toUserModel, toRegisterPayload, toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload,
  toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel, toInvitePayload, toTierModel,
} from '../services/normalizers.js';
```

Agregar al final del archivo:

```js
describe('toTierModel', () => {
  test('maps snake_case fields to camelCase', () => {
    const dto = {
      id: 2, name: 'premium', description: 'Beneficios premium', payment_required: true,
      role_id: 1, role_name: 'corredor', tier_amount: 4999,
    };
    expect(toTierModel(dto)).toEqual({
      id: '2', name: 'premium', description: 'Beneficios premium', paymentRequired: true,
      roleId: 1, roleName: 'corredor', tierAmount: 4999,
    });
  });

  test('defaults tierAmount to 0 and description to null when absent', () => {
    const dto = { id: 1, name: 'base', payment_required: false, role_id: 1, role_name: 'corredor' };
    const model = toTierModel(dto);
    expect(model.tierAmount).toBe(0);
    expect(model.description).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toTierModel(null)).toBeNull();
    expect(toTierModel(undefined)).toBeNull();
  });
});
```

- [ ] **Step 6: Correr los tests**

Run: `npx jest __tests__/tiers-mock.test.js __tests__/normalizers.test.js`
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add services/__mocks__/tiers-mock.js services/tiers.js services/normalizers.js __tests__/tiers-mock.test.js __tests__/normalizers.test.js
git commit -m "feat(payments): add tiers service, mock and normalizer"
```

---

### Task 2: Pantalla de catálogo de tiers

**Files:**
- Modify: `components/profile/tier-upgrade-screen.jsx` (reescritura completa)
- Modify: `components/profile/role-switch-toggle.jsx:16-28,121,170`

**Interfaces:**
- Consumes: `listTiers()` y `toTierModel` de Task 1. `useAuthStore((s) => s.activeRole)`, `useAuthStore((s) => s.roles)` (ya existentes, `roles[].tier` es el nombre del tier actual, ej. `'base'`/`'premium'`). `useIsNarrowWeb()` de `hooks/use-is-narrow-web.js` (ya existente).

- [ ] **Step 1: Reescribir `tier-upgrade-screen.jsx`**

```jsx
// components/profile/tier-upgrade-screen.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { listTiers } from '../../services/tiers.js';
import { toTierModel } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';

const ROLE_LABEL = { runner: 'Corredor', trainer: 'Entrenador' };

function formatTierPrice(tierAmount, paymentRequired) {
  if (!paymentRequired || !tierAmount) return 'Gratis';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tierAmount);
}

// Card de un tier — "Tier actual" si coincide con roles[].tier del rol
// activo, si no "Próximamente" (sin acción de pago conectada: Fase 1 del
// backend, que gatearía el acceso tras el primer pago, todavía no
// existe — ver docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md).
function TierCard({ tier, isCurrent, isDesktopWeb }) {
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
      ) : (
        <View className="mt-4 h-10 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800" nativeID={`${idPrefix}-coming-soon`} testID={`${idPrefix}-coming-soon`}>
          <MaterialCommunityIcons color="#94a3b8" name="clock-outline" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-coming-soon-label`} testID={`${idPrefix}-coming-soon-label`}>
            Próximamente
          </Text>
        </View>
      )}
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

  const currentRoleName = activeRole === 'runner' ? 'corredor' : 'entrenador';
  const currentTierName = roles.find((r) => r.name === currentRoleName)?.tier;

  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTiers()
      .then((dtos) => { if (!cancelled) setTiers(dtos.map(toTierModel)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const roleTiers = tiers
    .filter((t) => t.roleName === currentRoleName)
    .sort((a, b) => a.tierAmount - b.tierAmount);

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
                <TierCard isCurrent={tier.name === currentTierName} isDesktopWeb={isDesktopWeb} key={tier.id} tier={tier} />
              ))}
            </View>
          )}
        </SectionCard>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Unificar el link de entrada en `role-switch-toggle.jsx`**

Reemplazar la función `TierUpgradeLink` (líneas 16-28):

```jsx
// El texto ya no indica el rol — la pantalla de destino muestra los
// tiers del rol activo, no hace falta anticiparlo en el link (antes
// "Mejorar tier de {roleLabel}", una entrada de menú por rol).
function TierUpgradeLink({ onPress, className }) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`hover:opacity-70 active:opacity-70 ${className ?? ''}`}
      nativeID="role-switch-toggle-tier-upgrade-link"
      onPress={onPress}
      testID="role-switch-toggle-tier-upgrade-link"
    >
      <Text className="text-[11px] font-semibold text-primary" nativeID="role-switch-toggle-tier-upgrade-link-text" testID="role-switch-toggle-tier-upgrade-link-text">Mejorar tier</Text>
    </Pressable>
  );
}
```

Reemplazar la línea 121:
```jsx
        {showTierLink && <TierUpgradeLink className="mt-2" onPress={onUpgradeTier} />}
```

Reemplazar la línea 170:
```jsx
      {showTierLink && <TierUpgradeLink className="mt-2" onPress={onUpgradeTier} />}
```

- [ ] **Step 3: Lint**

Run: `npx eslint components/profile/tier-upgrade-screen.jsx components/profile/role-switch-toggle.jsx`
Expected: sin errores (regla `local/require-native-id` en verde — todo elemento visual nuevo lleva `nativeID`/`testID`).

- [ ] **Step 4: Verificación manual en preview (mobile y desktop web)**

Con `EXPO_PUBLIC_USE_MOCKS=true`: `/profile` → el link dice "Mejorar tier" (sin rol) → `/profile/tier-upgrade` muestra cards reales (Base/Premium) del rol activo, la del tier actual con badge, la otra con "Próximamente". Switchear a entrenador (si el usuario mock lo tiene activado) → las cards cambian a los tiers de entrenador. Viewport angosto (375px): cards apiladas a ancho completo; viewport ancho (>1024px): cards en fila.

- [ ] **Step 5: Commit**

```bash
git add components/profile/tier-upgrade-screen.jsx components/profile/role-switch-toggle.jsx
git commit -m "feat(profile): replace tier-upgrade placeholder with real tier catalog"
```

---

### Task 3: Servicio de pagos (`services/payments.js` + mock + normalizers)

**Files:**
- Create: `services/__mocks__/payments-mock.js`
- Create: `services/payments.js`
- Modify: `services/normalizers.js` (agrega 4 funciones al final)
- Test: `__tests__/payments-mock.test.js`
- Test: `__tests__/normalizers.test.js` (agrega tests de los 4 normalizers nuevos)

**Interfaces:**
- Produces: `createPreference(payload)`, `processPayment(payload)`, `getPayment(paymentId)`, `createTestCardToken(payload)` desde `services/payments.js` (payloads/respuestas en snake_case, tal cual contrato del backend). `toCreatePreferencePayload(form)`, `toPreferenceResponseModel(dto)`, `toProcessPaymentPayload(form)`, `toPaymentModel(dto)` desde `services/normalizers.js` — `toPreferenceResponseModel` produce `{preferenceId: string, publicKey: string}`; `toPaymentModel` produce `{id, amount, concept, createdAt, currencyId, description, externalReference, installments, payerEmail, paymentId, paymentMethodId, preferenceId, status, statusDetail}`.

- [ ] **Step 1: Escribir el mock**

```js
// services/__mocks__/payments-mock.js
// Simula POST /payments/preference, POST /payments, GET /payments/:id,
// POST /payments/test-card-token para EXPO_PUBLIC_USE_MOCKS=true — el
// backend real de Fase 0 ya existe (ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md),
// esto es solo para probar la plomería sin pegarle a Mercado Pago.
// mockProcessPayment siempre aprueba (estado determinístico) — no hay
// necesidad de simular rechazos en esta ronda, sin verificación en vivo
// contra MP todavía.
// `mockPreferences` guarda concept/description por preference_id — el
// backend real los persiste server-side al crear la preferencia y los
// recupera al procesar el pago (ProcessPaymentRequest NO lleva concept,
// solo preference_id, ver swagger); sin este mapa el mock no podría
// reflejar el concept real en la respuesta de mockProcessPayment.
let mockPreferences = {};
let mockPayments = [];
let nextPreferenceId = 1;
let nextPaymentId = 1;

export async function mockCreatePreference({ concept, description, items } = {}) {
  if (!concept || !Array.isArray(items) || items.length === 0) {
    const error = new Error('concept e items son requeridos.');
    error.status = 400;
    throw error;
  }
  for (const item of items) {
    if (!item.title || !item.quantity || item.quantity < 1 || item.unit_price == null || item.unit_price < 0) {
      const error = new Error('Cada item necesita title, quantity >= 1 y unit_price >= 0.');
      error.status = 400;
      throw error;
    }
  }
  const preferenceId = `mock-pref-${nextPreferenceId++}`;
  mockPreferences[preferenceId] = { concept, description: description ?? null };
  return {
    preference_id: preferenceId,
    public_key: 'TEST-mock-public-key',
  };
}

export async function mockProcessPayment(payload = {}) {
  const required = ['token', 'transaction_amount', 'payment_method_id', 'installments', 'payer_email'];
  if (required.some((key) => payload[key] == null)) {
    const error = new Error(`Faltan campos requeridos: ${required.join(', ')}.`);
    error.status = 400;
    throw error;
  }
  const preference = payload.preference_id ? mockPreferences[payload.preference_id] : null;
  const now = new Date().toISOString();
  const payment = {
    id: nextPaymentId,
    payment_id: `mock-payment-${nextPaymentId}`,
    preference_id: payload.preference_id ?? null,
    external_reference: `mock-ext-ref-${nextPaymentId}`,
    concept: preference?.concept ?? 'order',
    description: preference?.description ?? null,
    amount: payload.transaction_amount,
    currency_id: 'ARS',
    status: 'approved',
    status_detail: 'accredited',
    payment_method_id: payload.payment_method_id,
    installments: payload.installments,
    payer_email: payload.payer_email,
    created_at: now,
  };
  nextPaymentId += 1;
  mockPayments.push(payment);
  return payment;
}

export async function mockGetPayment(paymentId) {
  const payment = mockPayments.find((p) => String(p.id) === String(paymentId) || p.payment_id === String(paymentId));
  if (!payment) {
    const error = new Error('Pago no encontrado.');
    error.status = 404;
    throw error;
  }
  return payment;
}

export async function mockCreateTestCardToken(payload = {}) {
  const required = ['card_number', 'cardholder_name', 'expiration_month', 'expiration_year', 'identification_number', 'identification_type', 'security_code'];
  if (required.some((key) => !payload[key])) {
    const error = new Error(`Faltan campos requeridos: ${required.join(', ')}.`);
    error.status = 400;
    throw error;
  }
  return { token: `mock-card-token-${Date.now()}` };
}

export function __resetMockPayments() {
  mockPreferences = {};
  mockPayments = [];
  nextPreferenceId = 1;
  nextPaymentId = 1;
}
```

- [ ] **Step 2: Servicio real+mock**

```js
// services/payments.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockCreatePreference,
  mockProcessPayment,
  mockGetPayment,
  mockCreateTestCardToken,
} from './__mocks__/payments-mock.js';

// Fase 0 de pagos — contrato real y estable, ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
// `concept` se pasa tal cual lo pida el caller ("order"/"subscription")
// — este servicio no le asume ningún comportamiento especial, el
// backend tampoco lo tiene todavía.

// POST /api/v1/payments/preference.
export async function createPreference(payload) {
  if (USE_MOCKS) return await mockCreatePreference(payload);
  return await api.post('/payments/preference', payload);
}

// POST /api/v1/payments.
export async function processPayment(payload) {
  if (USE_MOCKS) return await mockProcessPayment(payload);
  return await api.post('/payments', payload);
}

// GET /api/v1/payments/{id}.
export async function getPayment(paymentId) {
  if (USE_MOCKS) return await mockGetPayment(paymentId);
  return await api.get(`/payments/${paymentId}`);
}

// POST /api/v1/payments/test-card-token — sandbox only, sin UI propia
// todavía (ver spec).
export async function createTestCardToken(payload) {
  if (USE_MOCKS) return await mockCreateTestCardToken(payload);
  return await api.post('/payments/test-card-token', payload);
}
```

- [ ] **Step 3: Normalizers**

Agregar al final de `services/normalizers.js`:

```js
// ---------------------------------------------------------------------
// Pagos — Fase 0 (checkout genérico, sin split). Ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
// ---------------------------------------------------------------------

export function toCreatePreferencePayload(form) {
  const payload = {
    concept: form.concept,
    items: form.items.map((item) => ({ title: item.title, quantity: item.quantity, unit_price: item.unitPrice })),
  };
  if (form.description) payload.description = form.description;
  return payload;
}

export function toPreferenceResponseModel(dto) {
  if (!dto) return null;
  return { preferenceId: dto.preference_id, publicKey: dto.public_key };
}

export function toProcessPaymentPayload(form) {
  const payload = {
    token: form.token,
    transaction_amount: form.transactionAmount,
    payment_method_id: form.paymentMethodId,
    installments: form.installments,
    payer_email: form.payerEmail,
  };
  if (form.preferenceId) payload.preference_id = form.preferenceId;
  return payload;
}

export function toPaymentModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    amount: dto.amount,
    concept: dto.concept,
    createdAt: dto.created_at,
    currencyId: dto.currency_id,
    description: dto.description,
    externalReference: dto.external_reference,
    installments: dto.installments,
    payerEmail: dto.payer_email,
    paymentId: dto.payment_id,
    paymentMethodId: dto.payment_method_id,
    preferenceId: dto.preference_id,
    status: dto.status,
    statusDetail: dto.status_detail,
  };
}
```

- [ ] **Step 4: Tests del mock**

```js
// __tests__/payments-mock.test.js
import {
  mockCreatePreference, mockProcessPayment, mockGetPayment, mockCreateTestCardToken, __resetMockPayments,
} from '../services/__mocks__/payments-mock.js';

beforeEach(() => {
  __resetMockPayments();
});

describe('mockCreatePreference', () => {
  test('crea una preferencia con items válidos', async () => {
    const result = await mockCreatePreference({
      concept: 'order',
      items: [{ title: 'Item de prueba', quantity: 1, unit_price: 1000 }],
    });
    expect(result.preference_id).toMatch(/^mock-pref-/);
    expect(result.public_key).toBe('TEST-mock-public-key');
  });

  test('rechaza sin concept', async () => {
    await expect(mockCreatePreference({ items: [{ title: 'x', quantity: 1, unit_price: 1 }] })).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza un item sin title', async () => {
    await expect(mockCreatePreference({ concept: 'order', items: [{ quantity: 1, unit_price: 1 }] })).rejects.toMatchObject({ status: 400 });
  });
});

describe('mockProcessPayment', () => {
  test('aprueba un pago con todos los campos requeridos', async () => {
    const payment = await mockProcessPayment({
      token: 'card-token', transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com',
    });
    expect(payment.status).toBe('approved');
    expect(payment.payment_id).toMatch(/^mock-payment-/);
  });

  test('rechaza sin token', async () => {
    await expect(mockProcessPayment({ transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('mockGetPayment', () => {
  test('devuelve el pago creado, por id o payment_id', async () => {
    const created = await mockProcessPayment({
      token: 'card-token', transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com',
    });
    const byId = await mockGetPayment(created.id);
    expect(byId).toEqual(created);
    const byPaymentId = await mockGetPayment(created.payment_id);
    expect(byPaymentId).toEqual(created);
  });

  test('tira 404-like para un id desconocido', async () => {
    await expect(mockGetPayment(9999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('mockCreateTestCardToken', () => {
  test('genera un token con datos de tarjeta completos', async () => {
    const result = await mockCreateTestCardToken({
      card_number: '4509953566233704', cardholder_name: 'APRO', expiration_month: '11', expiration_year: '30',
      identification_number: '12345678', identification_type: 'DNI', security_code: '123',
    });
    expect(result.token).toMatch(/^mock-card-token-/);
  });

  test('rechaza con datos incompletos', async () => {
    await expect(mockCreateTestCardToken({ card_number: '123' })).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 5: Tests de los normalizers**

Extender el import de `__tests__/normalizers.test.js` (mismo import que Task 1 ya extendió, sumar estos 4 nombres):

```js
import {
  toUserModel, toRegisterPayload, toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload,
  toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel, toInvitePayload, toTierModel,
  toCreatePreferencePayload, toPreferenceResponseModel, toProcessPaymentPayload, toPaymentModel,
} from '../services/normalizers.js';
```

Agregar al final del archivo:

```js
describe('toCreatePreferencePayload', () => {
  test('mapea items a snake_case, omite description si no viene', () => {
    const form = { concept: 'order', items: [{ title: 'Item', quantity: 2, unitPrice: 500 }] };
    expect(toCreatePreferencePayload(form)).toEqual({
      concept: 'order',
      items: [{ title: 'Item', quantity: 2, unit_price: 500 }],
    });
  });

  test('incluye description cuando viene', () => {
    const form = { concept: 'order', description: 'Compra de prueba', items: [{ title: 'Item', quantity: 1, unitPrice: 100 }] };
    expect(toCreatePreferencePayload(form).description).toBe('Compra de prueba');
  });
});

describe('toPreferenceResponseModel', () => {
  test('mapea preference_id/public_key a camelCase', () => {
    expect(toPreferenceResponseModel({ preference_id: 'pref-1', public_key: 'PUB-KEY' })).toEqual({
      preferenceId: 'pref-1', publicKey: 'PUB-KEY',
    });
  });

  test('returns null for falsy dto', () => {
    expect(toPreferenceResponseModel(null)).toBeNull();
  });
});

describe('toProcessPaymentPayload', () => {
  test('mapea a snake_case, incluye preference_id cuando viene', () => {
    const form = {
      token: 'tok', transactionAmount: 1000, paymentMethodId: 'visa', installments: 1, payerEmail: 'a@b.com', preferenceId: 'pref-1',
    };
    expect(toProcessPaymentPayload(form)).toEqual({
      token: 'tok', transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com', preference_id: 'pref-1',
    });
  });

  test('omite preference_id si no viene', () => {
    const form = { token: 'tok', transactionAmount: 1000, paymentMethodId: 'visa', installments: 1, payerEmail: 'a@b.com' };
    expect(toProcessPaymentPayload(form).preference_id).toBeUndefined();
  });
});

describe('toPaymentModel', () => {
  test('maps snake_case fields to camelCase', () => {
    const dto = {
      id: 1, amount: 1000, concept: 'order', created_at: '2026-09-02T00:00:00.000Z', currency_id: 'ARS',
      description: 'desc', external_reference: 'ext-1', installments: 1, payer_email: 'a@b.com',
      payment_id: 'mp-1', payment_method_id: 'visa', preference_id: 'pref-1', status: 'approved', status_detail: 'accredited',
    };
    expect(toPaymentModel(dto)).toEqual({
      id: '1', amount: 1000, concept: 'order', createdAt: '2026-09-02T00:00:00.000Z', currencyId: 'ARS',
      description: 'desc', externalReference: 'ext-1', installments: 1, payerEmail: 'a@b.com',
      paymentId: 'mp-1', paymentMethodId: 'visa', preferenceId: 'pref-1', status: 'approved', statusDetail: 'accredited',
    });
  });

  test('returns null for falsy dto', () => {
    expect(toPaymentModel(null)).toBeNull();
  });
});
```

- [ ] **Step 6: Correr los tests**

Run: `npx jest __tests__/payments-mock.test.js __tests__/normalizers.test.js`
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add services/__mocks__/payments-mock.js services/payments.js services/normalizers.js __tests__/payments-mock.test.js __tests__/normalizers.test.js
git commit -m "feat(payments): add payments service, mock and normalizers"
```

---

### Task 4: `CheckoutFlow` — dependencia + componente web/nativo

**Files:**
- Modify: `package.json` (agrega `@mercadopago/sdk-react`)
- Create: `components/payments/checkout-flow.web.jsx`
- Create: `components/payments/checkout-flow.jsx`

**Interfaces:**
- Consumes: `processPayment`, `toProcessPaymentPayload`, `toPaymentModel` de Task 3.
- Produces: `CheckoutFlow({ preferenceId, publicKey, amount, marketplace, onApproved, onError })` — mismo nombre/props en ambos archivos (`.web.jsx`/`.jsx`), consumido por Task 5. `onApproved(payment)` recibe el modelo de `toPaymentModel`. `marketplace` es `boolean|undefined`, no usado por ninguna rama todavía (Fase 2 lo pasará en `true`).

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install @mercadopago/sdk-react@^1.0.7 --legacy-peer-deps`
Expected: `package.json`/`package-lock.json` actualizados, sin errores. Verificar que solo se agregó esta dependencia:

Run: `git diff --stat package.json package-lock.json`
Expected: `package.json` con 1 línea nueva; `package-lock.json` con el árbol de esta dependencia (no un diff masivo de otras versiones — si aparecen cambios en paquetes no relacionados, revisar antes de continuar).

- [ ] **Step 2: Rama web — brick real**

```jsx
// components/payments/checkout-flow.web.jsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react';
import { processPayment } from '../../services/payments.js';
import { toProcessPaymentPayload, toPaymentModel } from '../../services/normalizers.js';

// Único componente de checkout para las 3 fases de pagos — la firma no
// cambia entre Fase 0/1/2, ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
// Solo web: Payment Brick es un componente HTML/JS
// (@mercadopago/sdk-react) — ver checkout-flow.jsx para la rama nativa
// (placeholder, sin WebView todavía). El wrapper de React del SDK
// desmonta el brick solo al desmontar este componente — no hace falta
// llamar unmount() a mano (eso es necesario con el SDK vanilla JS, no
// con este wrapper).
export function CheckoutFlow({ preferenceId, publicKey, amount, marketplace, onApproved, onError }) {
  const [approvedPaymentId, setApprovedPaymentId] = useState(null);

  useEffect(() => {
    initMercadoPago(publicKey);
  }, [publicKey]);

  // El Brick espera que onSubmit devuelva una Promise: resuelve para que
  // el brick muestre su propio estado de éxito, rechaza para que
  // muestre su propio estado de error (contrato de @mercadopago/sdk-react).
  const handleSubmit = ({ formData }) => new Promise((resolve, reject) => {
    processPayment(toProcessPaymentPayload({
      token: formData.token,
      transactionAmount: formData.transaction_amount,
      paymentMethodId: formData.payment_method_id,
      installments: formData.installments,
      payerEmail: formData.payer.email,
      preferenceId,
    }))
      .then((dto) => {
        const payment = toPaymentModel(dto);
        setApprovedPaymentId(payment.paymentId);
        onApproved?.(payment);
        resolve();
      })
      .catch((error) => {
        onError?.(error);
        reject(error);
      });
  });

  const handleError = (error) => {
    onError?.(error);
  };

  if (approvedPaymentId) {
    return (
      <View nativeID="checkout-flow-status" testID="checkout-flow-status">
        <StatusScreen initialization={{ paymentId: approvedPaymentId }} />
      </View>
    );
  }

  return (
    <View nativeID="checkout-flow-brick" testID="checkout-flow-brick">
      <Payment
        initialization={{ amount, preferenceId, ...(marketplace ? { marketplace: true } : {}) }}
        onError={handleError}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
```

- [ ] **Step 3: Rama nativa — placeholder**

```jsx
// components/payments/checkout-flow.jsx
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Rama nativa de CheckoutFlow — Payment Brick es un componente web
// (HTML/JS), sin equivalente nativo. Decisión WebView vs Checkout Pro
// sigue pendiente (ver docs/superpowers/specs/2026-08-12-subscription-tier-checkout-design.md)
// — mismo pill "Próximamente" que el resto del repo usa para
// funcionalidad no lista todavía, no un throw ni pantalla en blanco.
export function CheckoutFlow() {
  const colors = useThemeColors();
  return (
    <View className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800" nativeID="checkout-flow-native-coming-soon" testID="checkout-flow-native-coming-soon">
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={18} />
      <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="checkout-flow-native-coming-soon-label" testID="checkout-flow-native-coming-soon-label">
        Próximamente en la app
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Lint**

Run: `npx eslint components/payments/checkout-flow.web.jsx components/payments/checkout-flow.jsx`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/payments/checkout-flow.web.jsx components/payments/checkout-flow.jsx
git commit -m "feat(payments): add CheckoutFlow component (web brick + native placeholder)"
```

---

### Task 5: Pantalla-testbed de pagos

**Files:**
- Create: `components/payments/payments-testbed-screen.jsx`
- Create: `app/(tabs)/profile/payments-testbed.jsx`

**Interfaces:**
- Consumes: `createPreference`, `getPayment` de Task 3; `toCreatePreferencePayload`, `toPreferenceResponseModel`, `toPaymentModel` de Task 3; `CheckoutFlow` de Task 4; `RequireAuth` de `components/guards/require-auth.jsx` (ya existente).

- [ ] **Step 1: Pantalla**

```jsx
// components/payments/payments-testbed-screen.jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { createPreference, getPayment } from '../../services/payments.js';
import { toCreatePreferencePayload, toPreferenceResponseModel, toPaymentModel } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField } from '../forms/fields.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { CheckoutFlow } from './checkout-flow.jsx';

const CONCEPT_OPTIONS = [
  { id: 'order', name: 'order' },
  { id: 'subscription', name: 'subscription' },
];

// Pantalla interna sin entrada en routes/catalog.js — solo alcanzable
// tipeando /profile/payments-testbed. Prueba la plomería de Fase 0
// (services/payments.js + CheckoutFlow) contra los mocks; sin
// verificación en vivo contra Mercado Pago todavía (el backend no tiene
// sandbox configurado). Ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
function PaymentsTestbedScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();

  const [itemTitle, setItemTitle] = useState('Item de prueba');
  const [amount, setAmount] = useState('1000');
  const [concept, setConcept] = useState('order');
  const [creating, setCreating] = useState(false);
  const [preference, setPreference] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);

  const handleCreatePreference = async () => {
    if (creating) return;
    const unitPrice = Number(amount);
    if (!itemTitle.trim() || !unitPrice || unitPrice <= 0) {
      Toast.show({ type: 'error', text1: 'Completá título y un monto mayor a 0' });
      return;
    }
    setCreating(true);
    try {
      const dto = await createPreference(toCreatePreferencePayload({
        concept,
        description: itemTitle.trim(),
        items: [{ title: itemTitle.trim(), quantity: 1, unitPrice }],
      }));
      setPreference(toPreferenceResponseModel(dto));
      setLastPayment(null);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos crear la preferencia', text2: error.message });
    } finally {
      setCreating(false);
    }
  };

  const handleApproved = async (payment) => {
    Toast.show({ type: 'success', text1: 'Pago aprobado' });
    try {
      const dto = await getPayment(payment.paymentId ?? payment.id);
      setLastPayment(toPaymentModel(dto));
    } catch {
      setLastPayment(payment);
    }
  };

  const handleError = (error) => {
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="payments-testbed-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="payments-testbed-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="payments-testbed-screen-container" testID="payments-testbed-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="payments-testbed-screen-header" testID="payments-testbed-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="payments-testbed-screen-back-button"
            onPress={() => router.back()}
            testID="payments-testbed-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="payments-testbed-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="payments-testbed-screen-title">
            Testbed de pagos
          </Text>
        </View>

        <SectionCard icon="flask-outline" title="Crear preferencia">
          <InputField dense label="Título del item" onChange={setItemTitle} value={itemTitle} />
          <InputField dense keyboardType="number-pad" label="Monto" onChange={setAmount} value={amount} />
          <PickerField dense label="Concept" onChange={setConcept} options={CONCEPT_OPTIONS} value={concept} />

          <Pressable
            className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${creating ? 'opacity-60' : ''}`}
            disabled={creating}
            nativeID="payments-testbed-create-preference-button"
            onPress={handleCreatePreference}
            testID="payments-testbed-create-preference-button"
          >
            {creating ? <ActivityIndicator color={colors.onPrimary} /> : (
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="payments-testbed-create-preference-button-label" testID="payments-testbed-create-preference-button-label">
                Crear preferencia
              </Text>
            )}
          </Pressable>
        </SectionCard>

        {preference && (
          <SectionCard icon="credit-card-outline" title="Checkout">
            <CheckoutFlow
              amount={Number(amount)}
              onApproved={handleApproved}
              onError={handleError}
              preferenceId={preference.preferenceId}
              publicKey={preference.publicKey}
            />
          </SectionCard>
        )}

        {lastPayment && (
          <SectionCard icon="code-json" title="Última respuesta de pago">
            <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID="payments-testbed-last-payment" testID="payments-testbed-last-payment">
              {JSON.stringify(lastPayment, null, 2)}
            </Text>
          </SectionCard>
        )}
      </View>
    </ScrollView>
  );
}

export function PaymentsTestbedScreen() {
  return (
    <RequireAuth>
      <PaymentsTestbedScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 2: Ruta**

```jsx
// app/(tabs)/profile/payments-testbed.jsx
import { PaymentsTestbedScreen } from '../../../components/payments/payments-testbed-screen.jsx';

export default function ProfilePaymentsTestbed() {
  return <PaymentsTestbedScreen />;
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint components/payments/payments-testbed-screen.jsx "app/(tabs)/profile/payments-testbed.jsx"`
Expected: sin errores.

- [ ] **Step 4: Verificación manual en preview (mocks, sin sandbox real)**

Con `EXPO_PUBLIC_USE_MOCKS=true`, navegar directo a `/profile/payments-testbed` (sin link en el menú, es esperado): completar título/monto → "Crear preferencia" → aparece la sección "Checkout" con el brick de `@mercadopago/sdk-react` montado (sin completar el formulario del brick contra MP real, alcanza con confirmar que monta sin errores de consola — el submit real requiere sandbox, fuera de esta ronda). Confirmar que no hay errores en `preview_console_logs`.

- [ ] **Step 5: Commit**

```bash
git add components/payments/payments-testbed-screen.jsx "app/(tabs)/profile/payments-testbed.jsx"
git commit -m "feat(payments): add unlisted payments testbed screen"
```

---

### Task 6: Bump de versión y cierre

**Files:**
- Modify: `package.json:3`
- Modify: `package-lock.json:3,9`

**Interfaces:**
- Ninguna — tarea de cierre, sin código de producto.

- [ ] **Step 1: Confirmar versión actual**

Run: `grep '"version"' package.json`
Expected: `"version": "0.5.2",`

- [ ] **Step 2: Bump menor (feature nueva: dependencia + ~10 archivos nuevos)**

Editar manualmente **solo** la línea `"version"` en `package.json` (línea 3) de `"0.5.2"` a `"0.6.0"`, y las dos apariciones de `"version": "0.5.2"` en `package-lock.json` (líneas 3 y 9, root + `packages[""]`) a `"0.6.0"` — **sin correr `npm install`** para este paso (esa reescritura del lockfile ya pasó en la Task 4 al instalar la dependencia real; este paso es edición de texto pura). Verificar con:

Run: `git diff --stat package.json package-lock.json`
Expected: exactamente 1 línea cambiada en `package.json`, exactamente 2 líneas cambiadas en `package-lock.json` — si aparece más, revisar que no se haya tocado la entrada de `@mercadopago/sdk-react` u otra dependencia por accidente (mismo riesgo que ya pasó una vez en este repo con `react-native-worklets`, ver `docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md` si hace falta contexto — igual no debería repetirse acá porque no se usa `replace_all` sobre un string de versión genérico).

- [ ] **Step 3: Suite completa**

Run: `npm test`
Expected: todos los tests en verde, incluidos los de Tasks 1 y 3.

Run: `npm run lint`
Expected: sin errores (warnings preexistentes de `react-hooks/exhaustive-deps` no bloquean, es la convención ya establecida del repo).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to 0.6.0 for Fase 0 payments plumbing"
```
