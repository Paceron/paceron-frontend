# Checkout Modal Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CheckoutFlow` a self-contained modal on both platforms — web goes from an inline `SectionCard` section to a centered modal dialog, matching the fullscreen modal nativo already has, so any future caller (e.g. the team-join payment flow) can open it without building its own chrome.

**Architecture:** Split the current web Brick component into a chrome-less `CheckoutBrick` (`checkout-brick.web.jsx`) and a thin modal wrapper `CheckoutFlow` (`checkout-flow.web.jsx`) that renders `CheckoutBrick` inside a `Modal`. `checkout-web-page.jsx` (loaded by the native WebView) switches to importing `CheckoutBrick` directly, so it keeps rendering chrome-less inside the native modal it's already nested in — avoiding double chrome. Native `checkout-flow.jsx` is untouched except for a stale comment. Both existing callers (`tier-upgrade-screen.jsx`, `payments-testbed-screen.jsx`) drop their `SectionCard` wrapper around `CheckoutFlow`.

**Tech Stack:** Expo/React Native + React Native Web, NativeWind, `@mercadopago/sdk-react` (web-only Brick), `react-native-webview` (native-only).

**Spec:** `docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md`

## Global Constraints

- Every `View`/`Text`/`Pressable` (and their `Animated.*` variants) needs unique `nativeID` + `testID` (`local/require-native-id` ESLint rule, no exceptions except spread props).
- No render tests for screens/components — repo convention, not a gap (see CLAUDE.md "Testing"). Verification is manual preview + `npm test`/`npm run lint` green.
- Metro platform-split imports (`.web.jsx`/`.jsx`) must be written **without** a file extension when relying on per-platform resolution; `checkout-web-page.jsx`'s new import of `CheckoutBrick` is the one deliberate exception — it always wants the web-only file regardless of platform, so it uses the explicit `.web.jsx` extension (see spec, "Problema a resolver").
- Version bump is incremental, inside this same branch's own commits — no separate version-bump branch (CLAUDE.md).

---

### Task 1: Extract the chrome-less Brick into `checkout-brick.web.jsx`

**Files:**
- Create: `components/payments/checkout-brick.web.jsx`

**Interfaces:**
- Consumes: `processPayment` from `services/payments.js`, `toProcessPaymentPayload`/`toPaymentModel` from `services/normalizers.js` (both already exist, unchanged).
- Produces: `CheckoutBrick({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError })` — a named export, no `onCancel` (the Brick has no concept of closing itself). Task 2 and Task 3 both import this.

- [ ] **Step 1: Create the file with the Brick content moved out of `checkout-flow.web.jsx`, renamed to `CheckoutBrick`**

```jsx
// components/payments/checkout-brick.web.jsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react';
import { processPayment } from '../../services/payments.js';
import { toProcessPaymentPayload, toPaymentModel } from '../../services/normalizers.js';

// Brick real de Mercado Pago, sin chrome propio — lo envuelve
// checkout-flow.web.jsx (modal) para los callers normales de la app web, o
// se usa directo (sin chrome) desde checkout-web-page.jsx, que ya corre
// dentro del modal nativo de checkout-flow.jsx. Ver
// docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md.
// El wrapper de React del SDK desmonta el brick solo al desmontar este
// componente — no hace falta llamar unmount() a mano (eso es necesario
// con el SDK vanilla JS, no con este wrapper).
export function CheckoutBrick({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError }) {
  const [approvedPaymentId, setApprovedPaymentId] = useState(null);

  useEffect(() => {
    initMercadoPago(publicKey);
  }, [publicKey]);

  // El Brick espera que onSubmit devuelva una Promise: resuelve para que
  // el brick muestre su propio estado de éxito, rechaza para que
  // muestre su propio estado de error (contrato de @mercadopago/sdk-react).
  const handleSubmit = ({ formData }) => processPayment(toProcessPaymentPayload({
    token: formData.token,
    transactionAmount: formData.transaction_amount,
    paymentMethodId: formData.payment_method_id,
    installments: formData.installments,
    payerEmail: formData.payer.email,
    preferenceId,
    installmentId,
  }))
    .then((dto) => {
      const payment = toPaymentModel(dto);
      setApprovedPaymentId(payment.paymentId);
      onApproved?.(payment);
    })
    .catch((error) => {
      onError?.(error);
      throw error;
    });

  const handleError = (error) => {
    onError?.(error);
  };

  if (approvedPaymentId) {
    return (
      <View nativeID="checkout-brick-status" testID="checkout-brick-status">
        <StatusScreen initialization={{ paymentId: approvedPaymentId }} />
      </View>
    );
  }

  return (
    <View nativeID="checkout-brick-payment" testID="checkout-brick-payment">
      <Payment
        initialization={{ amount, preferenceId, ...(marketplace ? { marketplace: true } : {}) }}
        onError={handleError}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/payments/checkout-brick.web.jsx
git commit -m "refactor(payments): extract chrome-less CheckoutBrick from web CheckoutFlow"
```

---

### Task 2: Rewrite `checkout-flow.web.jsx` as a modal wrapper around `CheckoutBrick`

**Files:**
- Modify: `components/payments/checkout-flow.web.jsx` (full rewrite — replace the entire file content)
- Modify: `components/payments/checkout-flow.jsx:7-16` (native — drop the stale "asimetría real y aceptada" comment now that both platform variants accept `onCancel`)

**Interfaces:**
- Consumes: `CheckoutBrick` from `./checkout-brick.web.jsx` (Task 1) — import with the explicit `.web.jsx` extension, as shown in Step 1. This file itself is already the `.web.jsx` variant (only ever bundled for web), so there's no per-platform ambiguity to resolve here.
- Produces: `CheckoutFlow({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError, onCancel })` — same full signature as the native variant now. Tasks 4 and 5 (existing callers) already pass all of these props; no caller-side signature change needed.

- [ ] **Step 1: Replace the full content of `checkout-flow.web.jsx`**

```jsx
// components/payments/checkout-flow.web.jsx
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { CheckoutBrick } from './checkout-brick.web.jsx';

// Wrapper de chrome para CheckoutBrick — modal centrado (no fullscreen,
// a diferencia de la rama nativa) porque en web hay más ancho disponible
// y este mismo patrón (Modal transparent + backdrop + card centrada) ya
// es el establecido en el repo para diálogos (ver
// components/team/delete-team-modal.jsx). Firma idéntica a checkout-flow.jsx
// (nativo) — ambas variantes de plataforma aceptan las mismas props. Ver
// docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md.
export function CheckoutFlow({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError, onCancel }) {
  const colors = useThemeColors();

  return (
    <Modal animationType="fade" nativeID="checkout-flow-modal" onRequestClose={onCancel} testID="checkout-flow-modal" transparent visible>
      <View className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="checkout-flow-modal-backdrop" testID="checkout-flow-modal-backdrop">
        <View className="w-full max-w-lg rounded-2xl bg-white p-4 dark:bg-surface" nativeID="checkout-flow-modal-card" testID="checkout-flow-modal-card">
          <View className="mb-3 flex-row items-center justify-between" nativeID="checkout-flow-modal-header" testID="checkout-flow-modal-header">
            <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="checkout-flow-modal-title" testID="checkout-flow-modal-title">
              Checkout
            </Text>
            <Pressable
              accessibilityLabel="Cerrar"
              className="p-1 hover:opacity-70 active:opacity-70"
              nativeID="checkout-flow-modal-close-button"
              onPress={onCancel}
              testID="checkout-flow-modal-close-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
            </Pressable>
          </View>
          <CheckoutBrick
            amount={amount}
            installmentId={installmentId}
            marketplace={marketplace}
            onApproved={onApproved}
            onError={onError}
            preferenceId={preferenceId}
            publicKey={publicKey}
          />
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Update the stale comment in native `checkout-flow.jsx`**

In `components/payments/checkout-flow.jsx`, replace:

```jsx
// Rama nativa de CheckoutFlow — WebView cargando la misma página web del
// checkout (app/checkout.jsx), en vez de duplicar UI nativa o salir a un
// navegador externo (Checkout Pro). Firma idéntica a la variante web más
// un `onCancel` opcional — asimetría real y aceptada: el brick inline en
// web no tiene concepto de "cerrar", el modal nativo sí. Ver
// docs/superpowers/specs/2026-09-03-payments-checkout-webview-design.md.
```

with:

```jsx
// Rama nativa de CheckoutFlow — WebView cargando la misma página web del
// checkout (app/checkout.jsx), en vez de duplicar UI nativa o salir a un
// navegador externo (Checkout Pro). Firma idéntica a la variante web
// (ambas son modal + onCancel) — ver
// docs/superpowers/specs/2026-09-03-payments-checkout-webview-design.md y
// docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md.
```

- [ ] **Step 3: Commit**

```bash
git add components/payments/checkout-flow.web.jsx components/payments/checkout-flow.jsx
git commit -m "refactor(payments): make web CheckoutFlow a centered modal wrapper"
```

---

### Task 3: Point `checkout-web-page.jsx` at the chrome-less `CheckoutBrick`

**Files:**
- Modify: `components/payments/checkout-web-page.jsx:9,53-61`

**Interfaces:**
- Consumes: `CheckoutBrick` from `./checkout-brick.web.jsx` (Task 1), explicit extension per Global Constraints.

- [ ] **Step 1: Swap the import**

In `components/payments/checkout-web-page.jsx`, replace:

```jsx
// Sin extensión a propósito: Metro solo aplica resolución por plataforma
// (.web.jsx antes que .jsx) cuando el specifier NO trae extensión — un
// import con '.jsx' explícito carga ese archivo literal en cualquier
// plataforma, incluida web, rompiendo el split.
import { CheckoutFlow } from './checkout-flow';
```

with:

```jsx
// Con extensión explícita, a propósito: esta página siempre corre en un
// bundle web (la carga el WebView nativo de checkout-flow.jsx, que ya
// provee su propio chrome de modal) — quiere siempre el Brick sin chrome,
// nunca el CheckoutFlow.web.jsx que se envuelve a sí mismo en un modal
// (eso duplicaría el chrome). No aplica el quirk de resolución por
// plataforma de Metro porque no hay ambigüedad de plataforma a resolver.
import { CheckoutBrick } from './checkout-brick.web.jsx';
```

- [ ] **Step 2: Update the render call**

In the same file, replace:

```jsx
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

with:

```jsx
      <CheckoutBrick
        amount={Number(params.amount)}
        installmentId={params.installmentId ? Number(params.installmentId) : undefined}
        marketplace={params.marketplace === 'true'}
        onApproved={(payment) => postToNative({ status: 'approved', payment })}
        onError={(error) => postToNative({ status: 'error', message: error?.message ?? 'Error desconocido' })}
        preferenceId={params.preferenceId}
        publicKey={params.publicKey}
      />
```

- [ ] **Step 3: Commit**

```bash
git add components/payments/checkout-web-page.jsx
git commit -m "refactor(payments): checkout-web-page renders chrome-less CheckoutBrick"
```

---

### Task 4: Drop the `SectionCard` wrapper in `tier-upgrade-screen.jsx`

**Files:**
- Modify: `components/profile/tier-upgrade-screen.jsx:276-289`

**Interfaces:**
- Consumes: `CheckoutFlow` from `../payments/checkout-flow` (unchanged import, no extension — this file runs on both platforms, keeps relying on Metro's per-platform resolution between Task 2's new `checkout-flow.web.jsx` and the untouched native `checkout-flow.jsx`).

- [ ] **Step 1: Remove the `SectionCard` wrapper around `CheckoutFlow`**

Replace:

```jsx
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
```

with:

```jsx
        {checkoutData && (
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
        )}
```

`SectionCard` stays imported in this file — it's still used above for the `"Tiers de ${ROLE_LABEL[activeRole]}"` card (line 251). Don't remove the import.

- [ ] **Step 2: Commit**

```bash
git add components/profile/tier-upgrade-screen.jsx
git commit -m "refactor(payments): tier-upgrade checkout renders as modal, not inline section"
```

---

### Task 5: Drop the `SectionCard` wrapper in `payments-testbed-screen.jsx` and wire `onCancel`

**Files:**
- Modify: `components/payments/payments-testbed-screen.jsx:120-131`

**Interfaces:**
- Consumes: `CheckoutFlow` from `./checkout-flow` (unchanged import).
- Produces: a new `handleCheckoutCancel` closure, local to this file — no other task depends on it.

- [ ] **Step 1: Add a cancel handler and remove the `SectionCard` wrapper**

Replace:

```jsx
  const handleError = (error) => {
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };
```

with:

```jsx
  const handleError = (error) => {
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  const handleCheckoutCancel = () => {
    setPreference(null);
  };
```

Then replace:

```jsx
        {preference && (
          <SectionCard icon="credit-card-outline" title="Checkout">
            <CheckoutFlow
              amount={Number(amount)}
              key={preference.preferenceId}
              onApproved={handleApproved}
              onError={handleError}
              preferenceId={preference.preferenceId}
              publicKey={preference.publicKey}
            />
          </SectionCard>
        )}
```

with:

```jsx
        {preference && (
          <CheckoutFlow
            amount={Number(amount)}
            key={preference.preferenceId}
            onApproved={handleApproved}
            onCancel={handleCheckoutCancel}
            onError={handleError}
            preferenceId={preference.preferenceId}
            publicKey={preference.publicKey}
          />
        )}
```

`SectionCard` stays imported — still used above for "Crear preferencia" (line 100) and below for "Última respuesta de pago" (line 134).

- [ ] **Step 2: Commit**

```bash
git add components/payments/payments-testbed-screen.jsx
git commit -m "refactor(payments): testbed checkout renders as modal, adds cancel handler"
```

---

### Task 6: Version bump, lint/test verification, manual preview check

**Files:**
- Modify: `package.json:3`
- Modify: `package-lock.json:3,9`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Bump the version**

In `package.json`, change line 3 from:

```json
  "version": "0.9.0",
```

to:

```json
  "version": "0.9.1",
```

In `package-lock.json`, make the identical change on **both** line 3 and line 9 (root package name/version block appears twice at the top of the file — do not run `npm install`, which would rewrite the whole lockfile; edit both `"version": "0.9.0"` occurrences directly to `"0.9.1"`).

Patch bump (not minor): this is an internal refactor of an existing component's presentation (inline section → modal) — no new user-facing capability ships in this branch, consistent with the project convention of patch bumps for narrow, non-feature changes (see memory `versioning-scheme.md`).

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: all tests pass (no test in this repo covers component rendering, per CLAUDE.md's "Testing" convention — this run is a regression check on services/store/normalizer logic untouched by this branch, not a check on the new files).

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors (pre-existing `react-hooks/exhaustive-deps` warnings elsewhere in the repo are not blocking, per CLAUDE.md).

- [ ] **Step 4: Manual preview verification (web, with mocks)**

Start the web dev server with `EXPO_PUBLIC_USE_MOCKS=true` (already the `.claude/launch.json` "expo-web" configuration's default env). Log in with any email/password (mock auth accepts anything), navigate to `/profile/tier-upgrade`, click "MEJORAR" on the Premium tier card. Confirm:
- The checkout now renders as a **centered modal with a dimmed backdrop** (not an inline section below the tier cards).
- The modal header shows "Checkout" and a close (X) button.
- Clicking the X closes the modal and returns to the tier list without navigating away from `/profile/tier-upgrade`.
- No visual double-chrome or nested modal anywhere (there's only one checkout entry point reachable from normal web navigation, so this is mainly a code-review check on `checkout-web-page.jsx`, not something directly clickable from the UI — confirm by reading the diff, not by finding a UI path to it).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to 0.9.1"
```
